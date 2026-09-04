#!/usr/bin/env python3
"""Compare the published sanctions index against a freshly built one.

Publishing the index needs a Cloudflare credential. Noticing that it stopped
being published does not, and noticing is the part that failed before: the
previous index disappeared with the repository that hosted it and stayed gone
for a month, because a worker that degrades gracefully degrades silently.

So this checks three things a person would otherwise have to remember to look
at, and fails loudly when any of them is wrong:

  * the URL the worker reads still serves something;
  * what it serves still has the shape of a sanctions corpus;
  * what it serves is not older than the operator is willing to screen against.

It never writes anything. When it fails, the fix is the republish command in
deploy/snapshot-site/README.md.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

USER_AGENT = "agenda-intelligence-md index watchdog/1.0"
# Roughly the drop that would mean a source stopped contributing, rather than
# the ordinary churn of designations being added and removed.
MAX_NAME_DRIFT_RATIO = 0.10


def fetch(url: str, timeout: int) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        return json.loads(response.read().decode("utf-8"))


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--published", required=True, help="URL the worker reads")
    parser.add_argument("--built", type=Path, required=True, help="index just rebuilt from the sources")
    parser.add_argument("--max-age-days", type=int, default=7)
    parser.add_argument("--timeout", type=int, default=60)
    args = parser.parse_args()

    built = json.loads(args.built.read_text())
    built_names = (built.get("summary") or {}).get("name_count", 0)

    try:
        published = fetch(args.published, args.timeout)
    except (urllib.error.URLError, urllib.error.HTTPError, RuntimeError, ValueError) as exc:
        print(f"the index the worker reads is not being served: {args.published}", file=sys.stderr)
        print(f"  {type(exc).__name__}: {exc}", file=sys.stderr)
        print("  the worker is screening on caller-supplied evidence only until this is republished", file=sys.stderr)
        return 1

    problems: list[str] = []

    generated = (published.get("generated_at_utc") or "").strip()
    if not generated:
        problems.append("the published index carries no generated_at_utc, so its freshness cannot be stated")
    else:
        age = datetime.now(timezone.utc) - parse_timestamp(generated)
        print(f"published index built {generated} ({age.days}d old)")
        if age > timedelta(days=args.max_age_days):
            problems.append(
                f"the published index is {age.days} days old (limit {args.max_age_days}) — "
                "the gate is still reporting success against it"
            )

    published_names = (published.get("summary") or {}).get("name_count", 0)
    print(f"published names: {published_names} | rebuilt from sources today: {built_names}")
    if built_names and published_names:
        drift = abs(published_names - built_names) / built_names
        if drift > MAX_NAME_DRIFT_RATIO:
            problems.append(
                f"published index has {published_names} names against {built_names} rebuilt today "
                f"({drift:.0%} apart) — a source has probably stopped contributing to one of them"
            )

    if problems:
        print("the published index needs attention:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        print("  republish with the command in deploy/snapshot-site/README.md", file=sys.stderr)
        return 1

    print("published index is current and matches what the sources give today")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
