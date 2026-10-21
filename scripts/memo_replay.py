#!/usr/bin/env python3
"""Capture local memo files once, then rescore without model calls or tool execution."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agenda_intelligence.memo_replay import capture, rescore  # noqa: E402


def revision() -> str:
    try:
        sha = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
        dirty = subprocess.check_output(
            ["git", "status", "--porcelain", "--untracked-files=normal"], cwd=ROOT, text=True
        )
        return sha + ("+dirty" if dirty else "")
    except (OSError, subprocess.CalledProcessError):
        return "unavailable"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    record = subparsers.add_parser("capture")
    record.add_argument("--manifest", type=Path, required=True)
    record.add_argument("--run-dir", type=Path, required=True)
    score = subparsers.add_parser("score")
    score.add_argument("--run-dir", type=Path, required=True)
    score.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "capture":
            meta = capture(args.manifest, args.run_dir, revision=revision())
            print(json.dumps({"captured_records": len(meta["cases"]), "model_invoked": False}))
            return 0
        if args.output.resolve() in {(args.run_dir / name).resolve() for name in ["raw.jsonl", "meta.json"]}:
            raise ValueError("Summary output must not overwrite captured artifacts.")
        result = rescore(args.run_dir, revision=revision())
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(
            json.dumps(
                {key: result[key] for key in ["coverage_complete", "all_expectations_met", "expectation_match_pct"]}
            )
        )
        return 0 if result["coverage_complete"] and result["all_expectations_met"] else 1
    except (ValueError, OSError) as error:
        # A local path/configuration diagnostic; no raw model output is printed.
        print(f"memo replay failed: {type(error).__name__}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
