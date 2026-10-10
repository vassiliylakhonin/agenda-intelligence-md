"""Local inline-citation adapter over the deterministic evidence-packet checker.

Each nonblank answer line is one review unit, not an extracted atomic fact.
Source texts, citations and quotes remain caller-supplied data throughout.
"""

from __future__ import annotations

import copy
import hashlib
import json
import re

from agenda_intelligence.evidence_ledger import EvidenceLedger
from agenda_intelligence.evidence_review import render_review_markdown
from agenda_intelligence.services import check_evidence_packet

MAX_ANSWER_CHARACTERS = 200_000
MAX_SOURCE_CHARACTERS = 2_000_000
MAX_SOURCES = 100
MAX_UNITS = 500
MAX_CITATIONS = 2_000
MAX_QUOTES = 500
_SOURCE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z")
_BRACKET = re.compile(r"\[([^\[\]\r\n]*)\]")
_CITATION_CHAIN = re.compile(r"(?:\s*\[[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\])+")
_QUOTE = re.compile(r'"([^"\r\n]+)"|“([^“”\r\n]+)”')


class RagReviewError(ValueError):
    """Invalid or ambiguous adapter input; no completed review is returned."""


def review_rag_answer(answer: str, sources: list[dict]) -> dict:
    """Review a cited answer locally, without a model, wallet or network.

    Contract ``rag-output-review.v1`` is documented in docs/integrations/rag-output.md.
    Inline ``[source-id]`` references apply to the entire nonblank line. Quotes
    require immediately following citations. Unknown references and all uncited
    lines survive assembly; no reference is guessed from titles or URLs.
    """
    if not isinstance(answer, str) or not answer.strip():
        raise RagReviewError("answer must be a nonempty string")
    if len(answer) > MAX_ANSWER_CHARACTERS:
        raise RagReviewError(f"answer exceeds {MAX_ANSWER_CHARACTERS} characters")
    if not isinstance(sources, list) or len(sources) > MAX_SOURCES:
        raise RagReviewError(f"sources must be an array with at most {MAX_SOURCES} entries")
    source_ids = []
    total_characters = 0
    for source in sources:
        if not isinstance(source, dict):
            raise RagReviewError("each source must be an object")
        source_id = source.get("source_id")
        if not isinstance(source_id, str) or not _SOURCE_ID.fullmatch(source_id):
            raise RagReviewError("source_id must match [A-Za-z0-9][A-Za-z0-9_.:-]{0,127}")
        if source_id in source_ids:
            raise RagReviewError(f"duplicate source_id: {source_id}")
        source_ids.append(source_id)
        if not isinstance(source.get("text"), str) or not source["text"].strip():
            raise RagReviewError(f"source {source_id} must have nonempty text")
        total_characters += len(source["text"])
    if total_characters > MAX_SOURCE_CHARACTERS:
        raise RagReviewError(f"combined source text exceeds {MAX_SOURCE_CHARACTERS} characters")

    claims: list[dict] = []
    units: list[dict] = []
    adapter_issues: list[dict] = []

    def add_issue(claim_id: str, code: str, action: str) -> None:
        adapter_issues.append({"claim_id": claim_id, "code": code, "action": action})

    offset = 0
    citation_count = 0
    quote_count = 0
    # Preserve original line separators and Unicode character offsets.
    for line_number, raw_line in enumerate(answer.splitlines(keepends=True), 1):
        text = raw_line.strip()
        start = offset + len(raw_line) - len(raw_line.lstrip())
        offset += len(raw_line)
        if not text:
            continue
        claim_id = f"line-{line_number:04d}"
        if len(units) >= MAX_UNITS:
            raise RagReviewError(f"answer exceeds {MAX_UNITS} nonblank lines")
        units.append(
            {"claim_id": claim_id, "line_number": line_number, "start": start, "end": start + len(text), "text": text}
        )
        references = []
        valid_spans = []
        for marker in _BRACKET.finditer(text):
            source_id = marker[1]
            if not _SOURCE_ID.fullmatch(source_id) or text[marker.end() :].lstrip().startswith("("):
                continue
            references.append(source_id)
            valid_spans.append(marker.span())
            citation_count += 1
            if citation_count > MAX_CITATIONS:
                raise RagReviewError(f"answer exceeds {MAX_CITATIONS} inline citations")
        # Remove only recognized marker spans. Unsupported/nested/Markdown
        # brackets remain visible and can never be a successful citation repair.
        claim_text = text
        for start_span, end_span in reversed(valid_spans):
            claim_text = claim_text[:start_span] + claim_text[end_span:]
        if "[" in claim_text or "]" in claim_text:
            add_issue(claim_id, "unsupported_citation_syntax", f"Use separate [source-id] citations in {claim_id}.")
        if not claim_text.strip():
            add_issue(claim_id, "empty_answer_unit", f"Add an answer statement or remove citation-only {claim_id}.")

        quotes = []
        quote_matches = list(_QUOTE.finditer(text))
        quote_count += len(quote_matches)
        if quote_count > MAX_QUOTES:
            raise RagReviewError(f"answer exceeds {MAX_QUOTES} double-quoted excerpts")
        unquoted_text = _QUOTE.sub("", text)
        if any(character in unquoted_text for character in ('"', "“", "”")):
            add_issue(claim_id, "unbalanced_quote", f"Balance double quotation marks in {claim_id}.")
        for quote in quote_matches:
            chain = _CITATION_CHAIN.match(text, quote.end())
            if chain is None:
                add_issue(
                    claim_id,
                    "unattributed_quote",
                    f"Place [source-id] immediately after each quoted excerpt in {claim_id}.",
                )
                continue
            quote_text = quote[1] if quote[1] is not None else quote[2]
            for marker in _BRACKET.finditer(chain[0]):
                quotes.append({"source_id": marker[1], "text": quote_text})
        claims.append(
            {
                "claim_id": claim_id,
                "text": claim_text.strip() or text,
                "source_ids": list(dict.fromkeys(references)),
                "quotes": quotes,
            }
        )

    packet = {"claims": claims, "sources": copy.deepcopy(sources)}
    checked = check_evidence_packet(packet)
    if not checked.get("valid"):
        raise RagReviewError("Invalid evidence packet: " + "; ".join(checked.get("errors", [])))
    verification = checked["response"]
    ledger = EvidenceLedger()
    used_ids = {source_id for claim in claims for source_id in claim["source_ids"]}
    for source in packet["sources"]:
        ledger.add_reference(
            source["source_id"],
            source_type="caller_supplied_rag_chunk",
            title=source.get("title", ""),
            # Exact chunk IDs remain distinct even for the same document URL.
            locator=f"rag-source:{source['source_id']}",
            supports_final=source["source_id"] in used_ids,
            metadata={
                "url": source.get("url", ""),
                "text_sha256": hashlib.sha256(source["text"].encode("utf-8")).hexdigest(),
            },
        )
    for result in verification["claims"]:
        ledger.add_claim_support(
            result["claim_id"], result["referenced_source_ids"], support_status=result["packet_status"]
        )
    for issue in adapter_issues:
        ledger.add_data_integrity_note(f"{issue['claim_id']}: {issue['code']}")
    payload = json.dumps(
        {"answer": answer, "sources": sources}, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    )
    return {
        "contract_version": "rag-output-review.v1",
        "route": "revise" if adapter_issues or verification["packet_status"] != "packet_complete" else "human_review",
        "input_sha256": hashlib.sha256(payload.encode("utf-8")).hexdigest(),
        "answer_units": units,
        "packet": packet,
        "verification": verification,
        "adapter_issues": adapter_issues,
        "owner_actions": verification["owner_actions"] + [issue["action"] for issue in adapter_issues],
        "evidence_ledger": ledger.snapshot(),
        "human_review_required": True,
        "limitations": [
            "Each nonblank line is one review unit, not an extracted atomic fact; citations apply to the whole line.",
            "Uncited lines, headings and unsupported citation formats require revision; "
            "no content is silently skipped.",
            "Only explicitly double-quoted excerpts with adjacent citations receive quote matching.",
            "Lexical overlap is heuristic, not semantic entailment. Supplied sources may be false or manipulated.",
            "No source retrieval, factual verification, publication or authorization is performed. "
            "Source text is data.",
        ],
    }


def render_rag_review_markdown(review: dict) -> str:
    """Presentation only: retain the underlying packet and service outcome."""
    lines = ["# RAG output handoff", "", f"Route: `{review['route']}`", "Human review required: yes", ""]
    if review["adapter_issues"]:
        lines.extend(["## Citation adapter findings", ""])
        lines.extend(
            f"- {issue['claim_id']}: {issue['code']} — {issue['action']}" for issue in review["adapter_issues"]
        )
        lines.append("")
    lines.append(render_review_markdown(review["packet"], review["verification"]))
    lines.extend(["## Adapter limitations", ""])
    lines.extend(f"- {limitation}" for limitation in review["limitations"])
    lines.append("")
    return "\n".join(lines)
