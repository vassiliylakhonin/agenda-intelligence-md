#!/usr/bin/env python3
"""Reproducible benchmark over the bundled examples.

This is intentionally LLM-free. It walks `examples/source-backed/` for
`*.brief.json` (with optional sibling `.evidence.json` / `.audit.json`)
and runs the same validate + audit + score pipeline that
`agenda-intelligence bench` exposes.

Real benchmark numbers from this project should come from running the
same pipeline against agent-generated outputs (baseline / structured /
agenda-intelligence-md) on a real public-event set. That step needs an
LLM and is owned by the contributor running it; this script just gives
a deterministic reference run on the bundled examples.

Usage:
    python evals/run_benchmark.py [--dir <dir>] [--out <path.json>] [--md <path.md>]

Defaults: input dir = examples/source-backed, prints Markdown to stdout.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agenda_intelligence.bench import (  # noqa: E402
    discover_cases,
    render_markdown,
    run_case,
    summarize,
    to_json,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", default=str(ROOT / "examples" / "source-backed"))
    parser.add_argument("--out", help="Write JSON report to this path")
    parser.add_argument("--md", help="Write Markdown report to this path")
    args = parser.parse_args()

    root = Path(args.dir)
    cases = discover_cases(root)
    if not cases:
        print(f"No *.brief.json files found under {root}", file=sys.stderr)
        raise SystemExit(2)

    results = [run_case(c["brief"], c["evidence"], c["audit"]) for c in cases]
    summary = summarize(results)
    md = render_markdown(results, summary)

    if args.md:
        Path(args.md).write_text(md, encoding="utf-8")
    else:
        print(md)
    if args.out:
        Path(args.out).write_text(
            json.dumps(to_json(results, summary), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
