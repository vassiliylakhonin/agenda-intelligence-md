#!/usr/bin/env python3
"""Fail closed unless a sanctions-index candidate is a safe production update.

The shape/canary validator catches a collapsed fresh build. This second gate
compares that candidate with the snapshot users are currently served. It does
not reject an old production timestamp -- replacing stale data is its purpose --
but it does reject an unavailable or malformed baseline, a timestamp rollback,
and material name-count drift. Those cases need a person to decide whether the
candidate or the baseline is wrong.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

USER_AGENT = "agenda-intelligence-md index publish gate/1.0"
EXPECTED_SCHEMA = "sanctions-name-index-compact.v1"
EXPECTED_SOURCES = 4
DEFAULT_MAX_NAME_DRIFT_RATIO = 0.10


def fetch(url: str, timeout: int) -> dict[str, object]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        payload = json.loads(response.read().decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("published index root must be an object")
        return payload


def parse_timestamp(value: object, label: str) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} generated_at_utc is missing")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError(f"{label} generated_at_utc has no timezone")
    return parsed


def read_summary(index: dict[str, object], label: str) -> tuple[int, int]:
    if index.get("schema_version") != EXPECTED_SCHEMA:
        raise ValueError(f"{label} schema_version is {index.get('schema_version')!r}, expected {EXPECTED_SCHEMA!r}")
    summary = index.get("summary")
    if not isinstance(summary, dict):
        raise ValueError(f"{label} summary is missing")
    names = summary.get("name_count")
    sources = summary.get("source_count")
    if not isinstance(names, int) or isinstance(names, bool) or names <= 0:
        raise ValueError(f"{label} name_count is invalid: {names!r}")
    if sources != EXPECTED_SOURCES:
        raise ValueError(f"{label} source_count is {sources!r}, expected {EXPECTED_SOURCES}")
    return names, sources


def gate(candidate: dict[str, object], published: dict[str, object], max_drift_ratio: float) -> list[str]:
    problems: list[str] = []
    try:
        candidate_names, _ = read_summary(candidate, "candidate")
        candidate_time = parse_timestamp(candidate.get("generated_at_utc"), "candidate")
    except (TypeError, ValueError) as exc:
        return [str(exc)]

    try:
        published_names, _ = read_summary(published, "published index")
        published_time = parse_timestamp(published.get("generated_at_utc"), "published index")
    except (TypeError, ValueError) as exc:
        return [str(exc)]

    if candidate_time <= published_time:
        problems.append(
            "candidate generated_at_utc is not newer than production "
            f"({candidate_time.isoformat()} <= {published_time.isoformat()})"
        )

    drift = abs(candidate_names - published_names) / published_names
    if drift > max_drift_ratio:
        problems.append(
            f"candidate has {candidate_names} names against {published_names} in production "
            f"({drift:.1%} drift; limit {max_drift_ratio:.1%})"
        )
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--published", required=True)
    parser.add_argument("--max-name-drift-ratio", type=float, default=DEFAULT_MAX_NAME_DRIFT_RATIO)
    parser.add_argument("--timeout", type=int, default=60)
    args = parser.parse_args()

    if not 0 <= args.max_name_drift_ratio < 1:
        parser.error("--max-name-drift-ratio must be between 0 (inclusive) and 1 (exclusive)")

    try:
        candidate = json.loads(args.candidate.read_text(encoding="utf-8"))
        if not isinstance(candidate, dict):
            raise ValueError("candidate index root must be an object")
        published = fetch(args.published, args.timeout)
    except (OSError, UnicodeError, ValueError, urllib.error.URLError, urllib.error.HTTPError, RuntimeError) as exc:
        print("automatic publish refused: the candidate cannot be compared with production", file=sys.stderr)
        print(f"  {type(exc).__name__}: {exc}", file=sys.stderr)
        print("  keep the current deployment and review the recovery artifact", file=sys.stderr)
        return 1

    problems = gate(candidate, published, args.max_name_drift_ratio)
    if problems:
        print("automatic publish refused:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        print("  keep the current deployment and review the recovery artifact", file=sys.stderr)
        return 1

    candidate_names, _ = read_summary(candidate, "candidate")
    published_names, _ = read_summary(published, "published index")
    print(f"publish candidate accepted: {candidate_names} names vs {published_names} currently served")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
