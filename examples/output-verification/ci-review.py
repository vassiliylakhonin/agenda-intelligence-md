"""Review a local RAG answer and emit a limited CI artifact."""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

from agenda_intelligence import __version__, review_rag_answer

MAX_INPUT_BYTES = 16 * 1024 * 1024


def read_bounded(path: Path) -> bytes:
    with path.open("rb") as stream:
        data = stream.read(MAX_INPUT_BYTES + 1)
    if len(data) > MAX_INPUT_BYTES:
        raise ValueError("Oversized input")
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="JSON with the answer and, in combined mode, sources")
    parser.add_argument("--sources", type=Path, help="Separate JSON array captured by the retrieval job")
    parser.add_argument("--sources-sha256", help="Expected SHA-256 of the source file, recorded before generation")
    parser.add_argument("--strict", action="store_true", help="Exit 1 after emitting findings")
    parser.add_argument("--include-source-ids", action="store_true", help="Include IDs when safe to share")
    args = parser.parse_args()
    if (args.sources is None) != (args.sources_sha256 is None):
        parser.error("--sources and --sources-sha256 must be supplied together")
    if args.sources_sha256 is not None and not re.fullmatch(r"[0-9a-fA-F]{64}", args.sources_sha256):
        parser.error("--sources-sha256 must contain 64 hexadecimal characters")

    try:
        request = json.loads(read_bounded(args.input).decode("utf-8"))
        expected_fields = {"answer"} if args.sources is not None else {"answer", "sources"}
        if not isinstance(request, dict) or set(request) != expected_fields:
            raise ValueError("Unexpected input fields")
        source_snapshot = "not_checked"
        if args.sources is not None:
            source_bytes = read_bounded(args.sources)
            if hashlib.sha256(source_bytes).hexdigest() != args.sources_sha256.lower():
                print("Source snapshot differs from the recorded retrieval digest.", file=sys.stderr)
                return 2
            # Parse the same bytes that were hashed.
            sources = json.loads(source_bytes.decode("utf-8"))
            source_snapshot = "digest_matched"
        else:
            sources = request["sources"]
        review = review_rag_answer(request["answer"], sources)
    except (OSError, ValueError):
        print("RAG review could not read or validate the input. Inspect it privately.", file=sys.stderr)
        return 2

    units = {unit["claim_id"]: unit for unit in review["answer_units"]}
    findings = []
    for claim in review["verification"]["claims"]:
        line = units[claim["claim_id"]]["line_number"]
        for issue in claim["issues"]:
            code, _, source_id = issue.partition(":")
            finding = {"line": line, "code": code}
            if args.include_source_ids:
                finding["source_ids"] = [source_id] if source_id else claim["referenced_source_ids"]
            findings.append(finding)
    for issue in review["adapter_issues"]:
        findings.append({"line": units[issue["claim_id"]]["line_number"], "code": issue["code"]})
    findings.sort(key=lambda finding: (finding["line"], finding["code"]))
    summary = {
        "contract": "rag-ci-findings.v1",
        "checker_version": __version__,
        "source_snapshot": source_snapshot,
        "route": review["route"],
        "claim_count": review["verification"]["claim_count"],
        "human_review_required": True,
        "findings": findings,
    }
    print(json.dumps(summary, indent=2))
    return int(args.strict and review["route"] == "revise")


if __name__ == "__main__":
    raise SystemExit(main())
