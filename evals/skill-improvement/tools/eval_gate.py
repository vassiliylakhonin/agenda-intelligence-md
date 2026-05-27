#!/usr/bin/env python3
"""Structural skill-anchor gate for skill-improvement iterations.

Reads an anchors config (e.g. `evals/skill-improvement/anchors/agenda-intelligence.json`)
and a candidate SKILL.md, then checks whether each declared discipline anchor
is still present in the skill text. If a **critical** anchor is missing, the
gate rejects the edit (exit 1). Soft anchors emit warnings only.

This does NOT run an LLM-judge or score generated responses. It catches the
predictable failure mode where an LLM-driven skill editor silently removes
the dimensional anchors the rubric depends on. Use it as the last step of
every skill-edit iteration:

    python3 evals/skill-improvement/tools/eval_gate.py \\
        --anchors evals/skill-improvement/anchors/agenda-intelligence.json

Exit codes:
    0 — accept (all critical anchors present)
    1 — reject (one or more critical anchors missing)
    2 — usage / I/O error

Output is a JSON document on stdout suitable for piping into another tool.

The gate is intentionally narrow. It does not certify that a skill edit is
good — only that it has not lost the discipline anchors that the rubric
already scores. Pair it with the existing manual rubric scoring (per
`evals/skill-improvement/README.md`) for soft-dimension judgment.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any


@dataclass
class AnchorResult:
    id: str
    severity: str
    present: bool
    matched_patterns: list[str]
    missing_patterns: list[str]
    rubric_dimensions: list[str]
    rationale: str


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"eval_gate: file not found: {path}", file=sys.stderr)
        sys.exit(2)
    except json.JSONDecodeError as exc:
        print(f"eval_gate: invalid JSON in {path}: {exc}", file=sys.stderr)
        sys.exit(2)


def find_pattern(pattern: str, text: str) -> bool:
    """Return True if pattern matches text. Patterns are case-insensitive."""
    try:
        return re.search(pattern, text, flags=re.IGNORECASE) is not None
    except re.error as exc:
        print(f"eval_gate: invalid regex {pattern!r}: {exc}", file=sys.stderr)
        sys.exit(2)


def check_anchor(anchor: dict[str, Any], skill_text: str) -> AnchorResult:
    anchor_id = anchor.get("id", "<unknown>")
    severity = anchor.get("severity", "soft")
    rubric_dimensions = anchor.get("rubric_dimensions", []) or []
    rationale = anchor.get("rationale", "")

    any_of = anchor.get("any_of") or []
    all_of = anchor.get("all_of") or []

    if not any_of and not all_of:
        print(f"eval_gate: anchor {anchor_id} declares neither any_of nor all_of", file=sys.stderr)
        sys.exit(2)

    matched: list[str] = []
    missing: list[str] = []

    if any_of:
        any_matches = [p for p in any_of if find_pattern(p, skill_text)]
        if any_matches:
            matched.extend(any_matches)
        else:
            missing.extend(any_of)

    if all_of:
        for p in all_of:
            if find_pattern(p, skill_text):
                matched.append(p)
            else:
                missing.append(p)

    present = bool(matched) and not (all_of and any(p in missing for p in all_of))

    return AnchorResult(
        id=anchor_id,
        severity=severity,
        present=present,
        matched_patterns=matched,
        missing_patterns=missing if not present else [],
        rubric_dimensions=rubric_dimensions,
        rationale=rationale,
    )


def evaluate(anchors_config: dict[str, Any], skill_text: str) -> dict[str, Any]:
    anchors = anchors_config.get("anchors", [])
    if not anchors:
        print("eval_gate: anchors config contains no anchors", file=sys.stderr)
        sys.exit(2)

    results = [check_anchor(a, skill_text) for a in anchors]

    critical_missing = [r for r in results if r.severity == "critical" and not r.present]
    soft_missing = [r for r in results if r.severity == "soft" and not r.present]
    present = [r for r in results if r.present]

    decision = "reject" if critical_missing else "accept"

    return {
        "decision": decision,
        "skill_path": anchors_config.get("skill_path"),
        "anchors_total": len(results),
        "anchors_present": len(present),
        "critical_missing_count": len(critical_missing),
        "soft_missing_count": len(soft_missing),
        "critical_missing": [asdict(r) for r in critical_missing],
        "soft_missing": [asdict(r) for r in soft_missing],
        "present": [{"id": r.id, "severity": r.severity, "rubric_dimensions": r.rubric_dimensions} for r in present],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--anchors",
        type=Path,
        required=True,
        help="Path to anchors config (e.g. evals/skill-improvement/anchors/agenda-intelligence.json).",
    )
    parser.add_argument(
        "--skill",
        type=Path,
        default=None,
        help="Path to candidate SKILL.md. Defaults to anchors_config.skill_path resolved against repo root.",
    )
    parser.add_argument(
        "--format",
        choices=["json", "text"],
        default="json",
        help="Output format. Default: json.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="On accept, print nothing to stdout (still exits 0).",
    )
    args = parser.parse_args(argv)

    anchors_config = load_json(args.anchors)

    skill_path = args.skill
    if skill_path is None:
        rel = anchors_config.get("skill_path")
        if not rel:
            print("eval_gate: --skill not given and anchors config has no skill_path", file=sys.stderr)
            return 2
        # Resolve relative to repo root (anchors file lives in evals/skill-improvement/anchors/)
        repo_root = args.anchors.resolve().parents[3]
        skill_path = repo_root / rel

    try:
        skill_text = skill_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"eval_gate: skill file not found: {skill_path}", file=sys.stderr)
        return 2

    result = evaluate(anchors_config, skill_text)

    if args.quiet and result["decision"] == "accept":
        pass
    elif args.format == "json":
        print(json.dumps(result, indent=2, sort_keys=False))
    else:
        print(f"decision: {result['decision']}")
        print(f"  anchors present: {result['anchors_present']}/{result['anchors_total']}")
        print(f"  critical missing: {result['critical_missing_count']}")
        print(f"  soft missing: {result['soft_missing_count']}")
        for r in result["critical_missing"]:
            print(f"  ❌ CRITICAL {r['id']}: {r['rationale']}")
            print(f"     missing patterns: {r['missing_patterns']}")
            print(f"     rubric dimensions affected: {r['rubric_dimensions']}")
        for r in result["soft_missing"]:
            print(f"  ⚠ SOFT {r['id']}: {r['rationale']}")

    return 0 if result["decision"] == "accept" else 1


if __name__ == "__main__":
    sys.exit(main())
