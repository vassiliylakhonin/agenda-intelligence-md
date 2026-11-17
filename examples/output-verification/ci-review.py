"""Review a local RAG answer and emit a limited CI artifact."""

import argparse
import json
import sys
from pathlib import Path

from agenda_intelligence import review_rag_answer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="JSON with answer and retrieved sources")
    parser.add_argument("--strict", action="store_true", help="Exit 1 after emitting findings")
    parser.add_argument("--include-source-ids", action="store_true", help="Include IDs when safe to share")
    args = parser.parse_args()
    try:
        with args.input.open("rb") as stream:
            data = stream.read(16 * 1024 * 1024 + 1)
        if len(data) > 16 * 1024 * 1024:
            raise ValueError("Oversized input")
        request = json.loads(data.decode("utf-8"))
        if not isinstance(request, dict) or set(request) != {"answer", "sources"}:
            raise ValueError("Unexpected input fields")
        review = review_rag_answer(request["answer"], request["sources"])
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
        "route": review["route"],
        "claim_count": review["verification"]["claim_count"],
        "human_review_required": True,
        "findings": findings,
    }
    print(json.dumps(summary, indent=2))
    return int(args.strict and review["route"] == "revise")


if __name__ == "__main__":
    raise SystemExit(main())
