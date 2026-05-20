#!/usr/bin/env python3
"""Sync GTTA signal archive into packaged data/signals/.

Mirror of the schemas/ <-> data/schemas/ dual-copy pattern. The Global Think
Tank Analyst repository owns the signal canon. Agenda Intelligence vendors a
snapshot under ``src/agenda_intelligence/data/signals/`` so the MCP tools
``list_signals`` and ``get_signal`` work from a self-contained wheel.

Default source: ``~/work/global-think-tank-analyst/signals``. Override with
``--source PATH`` if your checkout lives elsewhere.

Files copied:

- ``index.json``, ``feed.json``, ``latest.md``, ``TEMPLATE.md``, ``README.md``
- every ``YYYY/`` directory (signal markdown files)

CI freshness is enforced by ``tests/test_signal_sync.py``: any drift between
the vendored snapshot and the local source path (when present) will fail.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

DEFAULT_SOURCE = Path.home() / "work" / "global-think-tank-analyst" / "signals"
TARGET = Path(__file__).resolve().parents[1] / "src" / "agenda_intelligence" / "data" / "signals"

TOP_LEVEL_FILES = ["index.json", "feed.json", "latest.md", "TEMPLATE.md", "README.md"]


def sync(source: Path, target: Path, verbose: bool = True) -> None:
    if not source.is_dir():
        raise SystemExit(f"source signals dir not found: {source}")
    target.mkdir(parents=True, exist_ok=True)

    for name in TOP_LEVEL_FILES:
        src_file = source / name
        if not src_file.is_file():
            if verbose:
                print(f"skip (missing in source): {name}")
            continue
        shutil.copy2(src_file, target / name)
        if verbose:
            print(f"copied: {name}")

    for year_dir in sorted(p for p in source.iterdir() if p.is_dir() and p.name.isdigit()):
        out_year = target / year_dir.name
        if out_year.exists():
            shutil.rmtree(out_year)
        shutil.copytree(year_dir, out_year)
        if verbose:
            print(f"copied dir: {year_dir.name}/ ({sum(1 for _ in out_year.glob('*.md'))} signals)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"Path to GTTA signals/ directory (default: {DEFAULT_SOURCE})",
    )
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    sync(args.source, TARGET, verbose=not args.quiet)
    print(f"OK: signals synced to {TARGET}")


if __name__ == "__main__":
    main()
