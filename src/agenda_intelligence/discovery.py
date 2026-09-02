"""Deterministic candidate discovery: find where a claim could be supported.

The evidence-packet contract asks the caller to declare, per claim, which
sources it relies on. On a handful of documents a person or a model assigns
those by reading. On four hundred it guesses, and the linter then checks only
what the guess named: a claim whose real support sits in an undeclared document
comes back ``packet_incomplete``, and a claim citing the wrong document comes
back with weak lexical support and no explanation of why.

This module separates the two halves of that job. Discovery is exhaustive and
deterministic — literal patterns derived from the claim, matched against every
source, with the line that matched. Judgement stays with the model or the
reviewer, and now runs over a bounded candidate list instead of a corpus. The
split is what makes the same behaviour hold on 40 sources and on 4,000.

Scope. This finds lexical overlap, not meaning. A source that supports a claim
without sharing a number, a name, or a content term with it will not appear,
and no ranking here is a judgement that a candidate supports the claim — that
is what the reviewer is for. The limit is pinned by
``test_discovery_does_not_claim_to_find_paraphrase``.
"""

from __future__ import annotations

import re
from typing import Any, Iterable

from agenda_intelligence.services import _grounded_content_terms, _grounded_normalize

__all__ = [
    "MAX_PATTERNS_PER_CLAIM",
    "claim_patterns",
    "discover_sources",
]

# A claim contributes at most this many patterns. The cap keeps the scan linear
# in corpus size for a long claim and makes the pattern list readable in a
# report; numbers and quoted spans are admitted before terms, so the cap drops
# the least discriminating patterns first.
MAX_PATTERNS_PER_CLAIM = 12

# A token carrying a digit: figures, dates, percentages, monetary amounts. These
# are the most discriminating thing a claim can contain and the cheapest to
# match exactly, so they are ranked first and never dropped by the cap.
_NUMERIC = re.compile(r"\d")
_QUOTED = re.compile(r"[\"“„«]([^\"”“»«]{8,120})[\"”»]")


def _document_frequency(sources: list[dict]) -> dict[str, int]:
    """How many sources each term appears in, for rarity ranking."""

    frequency: dict[str, int] = {}
    for source in sources:
        for term in set(_grounded_content_terms(source.get("text", ""))):
            frequency[term] = frequency.get(term, 0) + 1
    return frequency


def claim_patterns(claim_text: str, *, frequency: dict[str, int] | None = None) -> list[dict[str, Any]]:
    """Literal search patterns for a claim, most discriminating first.

    Ordering is numbers, then quoted spans, then content terms rarest first.
    Rarity uses document frequency over the corpus when it is supplied, so the
    same claim yields the same patterns for the same corpus and a different
    order for a different one. With no corpus, terms keep claim order.
    """

    patterns: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(kind: str, literal: str) -> None:
        key = kind + "\x00" + literal
        if literal and key not in seen:
            seen.add(key)
            patterns.append({"kind": kind, "literal": literal})

    terms = _grounded_content_terms(claim_text)
    for term in terms:
        if _NUMERIC.search(term):
            add("number", term)
    for match in _QUOTED.finditer(claim_text):
        add("quote", _grounded_normalize(match.group(1)))

    words = [term for term in terms if not _NUMERIC.search(term)]
    if frequency:
        # Rarest first, ties broken by claim order so the output is stable.
        words.sort(key=lambda term: (frequency.get(term, 0), terms.index(term)))
    for term in words:
        add("term", term)

    return patterns[:MAX_PATTERNS_PER_CLAIM]


def _lines(text: str) -> list[str]:
    return text.splitlines()


def _match_source(patterns: list[dict[str, Any]], text: str) -> dict[str, Any]:
    """Which patterns occur in a source, and the line carrying the most of them."""

    normalized_lines = [_grounded_normalize(line) for line in _lines(text)]
    whole = _grounded_normalize(text)

    matched = [pattern for pattern in patterns if pattern["literal"] in whole]
    if not matched:
        return {"matched": [], "line": 0, "text": ""}

    literals = [pattern["literal"] for pattern in matched]
    best_index, best_hits = 0, 0
    for index, line in enumerate(normalized_lines):
        hits = sum(1 for literal in literals if literal in line)
        if hits > best_hits:
            best_index, best_hits = index, hits
    raw_lines = _lines(text)
    return {
        "matched": matched,
        "line": best_index + 1 if best_hits else 0,
        "text": raw_lines[best_index].strip()[:300] if best_hits else "",
    }


def _score(matched: list[dict[str, Any]], patterns: list[dict[str, Any]]) -> float:
    """Weighted share of a claim's patterns present in a source.

    A number or a quoted span is worth more than a term because it is far less
    likely to co-occur by accident. The score orders candidates; it is not a
    probability and not a judgement that the source supports the claim.
    """

    weights = {"number": 3.0, "quote": 3.0, "term": 1.0}
    total = sum(weights[pattern["kind"]] for pattern in patterns)
    if not total:
        return 0.0
    hit = sum(weights[pattern["kind"]] for pattern in matched)
    return round(hit / total, 4)


def discover_sources(request_json: dict, *, limit: int = 5) -> dict:
    """Rank every source in the corpus against every claim, exhaustively.

    Takes the evidence-packet request shape — ``claims`` and ``sources`` — and
    returns, per claim, the patterns it produced and the sources those patterns
    reached. Every source is scanned for every claim; nothing is sampled and no
    model is called.

    Two fields carry the findings a caller acts on: ``undeclared_candidates``
    are sources a claim did not cite but its own numbers and terms reach, and
    ``declared_without_match`` are sources a claim cites where not one pattern
    occurs, which is usually a citation attached to the wrong document.
    """

    claims = list(request_json.get("claims") or [])
    sources = list(request_json.get("sources") or [])
    frequency = _document_frequency(sources)

    results: list[dict[str, Any]] = []
    for claim in claims:
        text = str(claim.get("text") or claim.get("claim") or "")
        patterns = claim_patterns(text, frequency=frequency)
        declared = [str(sid) for sid in (claim.get("source_ids") or [])]

        candidates: list[dict[str, Any]] = []
        for source in sources:
            source_id = str(source.get("source_id") or "")
            found = _match_source(patterns, str(source.get("text") or ""))
            if not found["matched"]:
                continue
            candidates.append(
                {
                    "source_id": source_id,
                    "declared": source_id in declared,
                    "score": _score(found["matched"], patterns),
                    "matched_patterns": len(found["matched"]),
                    "of_patterns": len(patterns),
                    "kinds": sorted({pattern["kind"] for pattern in found["matched"]}),
                    "best_line": {"line": found["line"], "text": found["text"]},
                }
            )
        # Deterministic order: score, then pattern count, then source_id.
        candidates.sort(
            key=lambda item: (-float(item["score"]), -int(item["matched_patterns"]), str(item["source_id"]))
        )
        reached = {item["source_id"] for item in candidates}

        results.append(
            {
                "claim_id": str(claim.get("claim_id") or ""),
                "patterns": patterns,
                "declared_source_ids": declared,
                "candidates": candidates[:limit],
                "undeclared_candidates": [item["source_id"] for item in candidates[:limit] if not item["declared"]],
                "declared_without_match": [sid for sid in declared if sid not in reached],
            }
        )

    return {
        "packet_id": str(request_json.get("packet_id") or ""),
        "corpus": {"sources_scanned": len(sources), "claims": len(claims), "pattern_cap": MAX_PATTERNS_PER_CLAIM},
        "claims": results,
        "discovery_status": "candidates_only",
        "limitations": [
            "Lexical overlap only: a source that supports a claim without sharing a number, name, or content "
            "term with it does not appear here.",
            "A candidate is a place to look, not a finding. Ranking is not a judgement that the source supports "
            "the claim, and no claim is verified by appearing in this report.",
            "Discovery does not read the corpus for meaning, resolve morphology or translation, or follow "
            "references between documents.",
        ],
    }


def format_discovery_text(response: dict, *, sources: Iterable[dict] = ()) -> str:
    """Human-readable summary for the CLI."""

    titles = {str(item.get("source_id")): str(item.get("title") or "") for item in sources}
    corpus = response["corpus"]
    lines = [
        f"sources_scanned={corpus['sources_scanned']} claims={corpus['claims']} status={response['discovery_status']}"
    ]
    for claim in response["claims"]:
        lines.append(
            f"  {claim['claim_id']}: {len(claim['candidates'])} candidate(s) from {len(claim['patterns'])} pattern(s)"
        )
        for candidate in claim["candidates"]:
            flag = "declared" if candidate["declared"] else "UNDECLARED"
            title = titles.get(candidate["source_id"], "")
            lines.append(
                f"    {candidate['score']:.2f} {candidate['source_id']}"
                f"{' — ' + title if title else ''} [{flag}] "
                f"{candidate['matched_patterns']}/{candidate['of_patterns']} {','.join(candidate['kinds'])}"
            )
            if candidate["best_line"]["line"]:
                lines.append(f"         L{candidate['best_line']['line']}: {candidate['best_line']['text'][:120]}")
        for source_id in claim["declared_without_match"]:
            lines.append(f"    !! {source_id} is cited by this claim and no pattern occurs in it")
    return "\n".join(lines)
