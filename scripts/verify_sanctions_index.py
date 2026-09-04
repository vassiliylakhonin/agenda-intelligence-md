#!/usr/bin/env python3
"""Sanity-gate a freshly built sanctions name index before it is published.

The index is the only thing standing between a caller and an unscreened name,
and it is rebuilt unattended. The failure that matters is not a crash — it is a
source quietly serving an error page or a truncated body with HTTP 200, which
yields a valid-looking index with most of the names missing. That would not
break anything visibly; it would just stop matching, and the gate would keep
reporting success. So refuse to publish unless the shape still looks like the
corpus we know.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Well below the 84k observed on 2026-09-04: a floor that catches a collapsed
# build, not a threshold that needs updating whenever a list shifts.
MIN_NAMES = 60_000
EXPECTED_SOURCES = 4

# Long-standing designations across three different authorities. If a source
# silently dropped out, at least one of these stops resolving.
CANARIES = [
    "SBERBANK OF RUSSIA",
    "GAZPROM NEFT",
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("index", type=Path)
    args = parser.parse_args()

    data = json.loads(args.index.read_text())
    summary = data.get("summary") or {}
    names = summary.get("name_count", 0)
    sources = summary.get("source_count", 0)
    problems: list[str] = []

    if names < MIN_NAMES:
        problems.append(f"name_count {names} is below the {MIN_NAMES} floor — a source probably failed silently")
    if sources != EXPECTED_SOURCES:
        problems.append(f"source_count is {sources}, expected {EXPECTED_SOURCES}")
    if not data.get("generated_at_utc"):
        problems.append("generated_at_utc is missing — callers are told how fresh the screening is from this field")

    present = {str(entry[0]).upper() for entry in data.get("entries", []) if entry}
    for canary in CANARIES:
        if canary not in present:
            problems.append(f"canary {canary!r} is missing from the index")

    if problems:
        print("index rejected, not publishing:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    print(f"index ok: {names} names, {sources} sources, built {data['generated_at_utc']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
