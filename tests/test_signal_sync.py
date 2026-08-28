"""Guard that the packaged data/signals/ snapshot stays in sync with the
local GTTA checkout, when present.

The Global Think Tank Analyst repository is the canonical source of the
signal archive. Agenda Intelligence vendors a snapshot under
``src/agenda_intelligence/data/signals/`` so the MCP ``list_signals`` and
``get_signal`` tools work from a self-contained wheel.

This test is skipped automatically when the local GTTA checkout is not
present (e.g. on CI without that repo cloned). Locally it enforces that
``scripts/sync_signals.py`` has been re-run after upstream changes.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
PACKAGED = ROOT / "src" / "agenda_intelligence" / "data" / "signals"

# The source path is resolved by the sync script rather than repeated here. The
# two used to hold the same hard-coded ~/work path; when the checkout moved, the
# script started failing loudly and this test started skipping silently, so the
# guard was off for every run that mattered.
SPEC = importlib.util.spec_from_file_location("sync_signals", ROOT / "scripts" / "sync_signals.py")
assert SPEC and SPEC.loader
SYNC = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SYNC)

LOCAL_SOURCE = SYNC.resolve_source()


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def test_signals_packaged_index_present():
    assert (PACKAGED / "index.json").is_file(), "vendored signals/index.json missing"


def test_signal_feed_content_matches_packaged_markdown():
    feed = json.loads((PACKAGED / "feed.json").read_text(encoding="utf-8"))
    mismatches = []
    for item in feed.get("items", []):
        signal_name = item["id"].rstrip("/").split("/")[-1]
        signal_path = PACKAGED / "2026" / signal_name
        if not signal_path.is_file():
            mismatches.append(f"missing markdown for feed item: {signal_name}")
            continue
        if item.get("content_text") != signal_path.read_text(encoding="utf-8"):
            mismatches.append(signal_name)

    assert not mismatches, "data/signals/feed.json content_text drifted from packaged markdown: " + ", ".join(
        mismatches
    )


@pytest.mark.skipif(LOCAL_SOURCE is None, reason="GTTA checkout not available")
def test_signals_index_matches_source():
    src = LOCAL_SOURCE / "index.json"
    dst = PACKAGED / "index.json"
    assert _read(src) == _read(dst), (
        "data/signals/index.json drifted from GTTA source. " "Run: python scripts/sync_signals.py"
    )


@pytest.mark.skipif(LOCAL_SOURCE is None, reason="GTTA checkout not available")
def test_signal_markdown_count_matches():
    src_count = sum(1 for _ in LOCAL_SOURCE.rglob("20*/*.md"))
    dst_count = sum(1 for _ in PACKAGED.rglob("20*/*.md"))
    assert src_count == dst_count, (
        f"signal markdown count drift: source={src_count}, packaged={dst_count}. " "Run: python scripts/sync_signals.py"
    )
