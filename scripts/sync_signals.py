#!/usr/bin/env python3
"""Sync GTTA signal archive into packaged data/signals/.

Mirror of the schemas/ <-> data/schemas/ dual-copy pattern. The Global Think
Tank Analyst repository owns the signal canon. Agenda Intelligence vendors a
snapshot under ``src/agenda_intelligence/data/signals/`` so the MCP tools
``list_signals`` and ``get_signal`` work from a self-contained wheel.

Source resolution, first hit wins: ``$GTTA_SIGNALS``, a ``global-think-tank-analyst``
checkout beside this repository, then ``~/work`` and ``~/projects``. Override with
``--source PATH`` if your checkout lives somewhere else again.

Files copied:

- ``index.json``, ``feed.json``, ``latest.md``, ``TEMPLATE.md``, ``README.md``
- every ``YYYY/`` directory (signal markdown files)

CI freshness is enforced by ``tests/test_signal_sync.py``: any drift between
the vendored snapshot and the local source path (when present) will fail.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
TARGET = REPO_ROOT / "src" / "agenda_intelligence" / "data" / "signals"

# One hard-coded home directory used to decide this. The checkout moved to
# ~/projects and the path here did not, so `sync_signals.py` stopped finding it
# and the freshness test in tests/test_signal_sync.py -- which skips when the
# source is absent -- went quiet instead of failing. It stayed quiet through a
# sweep that edited the vendored snapshot directly, which is exactly the drift
# it exists to catch. Several candidates, checked in order, so a moved checkout
# degrades to the next one rather than to silence. An explicit GTTA_SIGNALS is
# used alone: a typo in it should surface, not fall through to a guess.


def candidate_sources() -> list[Path]:
    override = os.environ.get("GTTA_SIGNALS")
    if override:
        return [Path(override)]
    candidates = [REPO_ROOT.parent / "global-think-tank-analyst" / "signals"]
    candidates += [Path.home() / parent / "global-think-tank-analyst" / "signals" for parent in ("work", "projects")]
    return candidates


def resolve_source() -> Path | None:
    """The first candidate that exists, or None when no checkout is present."""
    return next((path for path in candidate_sources() if path.is_dir()), None)


DEFAULT_SOURCE = resolve_source() or candidate_sources()[-1]

TOP_LEVEL_FILES = ["index.json", "feed.json", "latest.md", "TEMPLATE.md", "README.md"]


# A signal links to its own repository with paths like ../../README.md. Those
# resolve in the canon, where signals sit two levels below the repository root.
# Vendored here they sit five levels down inside a package and point at nothing,
# which is what tests/test_markdown_links.py reports. The link is not wrong, the
# move is: so the move translates it to the canonical URL rather than leaving a
# path that only worked where it came from.
CANON_BLOB_URL = "https://github.com/vassiliylakhonin/global-think-tank-analyst/blob/main"
ESCAPING_LINK = re.compile(r"\]\(\.\./\.\./([^)\s]+)\)")


def rewrite_escaping_links(text: str) -> str:
    return ESCAPING_LINK.sub(lambda match: f"]({CANON_BLOB_URL}/{match.group(1)})", text)


# feed.json embeds a copy of each signal's markdown, and a guard test asserts the
# two are identical. Rewriting one without the other would trade a broken link
# for a broken invariant.
def retranslate_snapshot(target: Path, verbose: bool = True) -> int:
    rewritten = 0
    for path in sorted(target.rglob("*.md")):
        original = path.read_text(encoding="utf-8")
        translated = rewrite_escaping_links(original)
        if translated != original:
            path.write_text(translated, encoding="utf-8")
            rewritten += 1

    feed_path = target / "feed.json"
    if feed_path.is_file():
        feed = json.loads(feed_path.read_text(encoding="utf-8"))
        for item in feed.get("items", []):
            name = str(item.get("id", "")).rstrip("/").split("/")[-1]
            markdown = target / "2026" / name
            if markdown.is_file():
                item["content_text"] = markdown.read_text(encoding="utf-8")
        feed_path.write_text(json.dumps(feed, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    if verbose and rewritten:
        print(f"rewrote repository-relative links in {rewritten} file(s)")
    return rewritten


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

    retranslate_snapshot(target, verbose=verbose)


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
