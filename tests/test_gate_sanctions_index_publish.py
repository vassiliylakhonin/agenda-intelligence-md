"""Tests for the fail-closed sanctions-index publication gate."""

from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "gate_sanctions_index_publish.py"
SPEC = importlib.util.spec_from_file_location("gate_sanctions_index_publish", SCRIPT)
assert SPEC and SPEC.loader
GATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)


def index(timestamp: str, names: int = 84_000, sources: int = 4) -> dict[str, object]:
    return {
        "schema_version": "sanctions-name-index-compact.v1",
        "generated_at_utc": timestamp,
        "summary": {"source_count": sources, "name_count": names},
    }


def test_new_candidate_with_bounded_drift_is_accepted():
    published = index("2026-09-12T04:20:00+00:00", names=84_000)
    candidate = index("2026-09-13T04:20:00+00:00", names=84_500)

    assert GATE.gate(candidate, published, 0.10) == []


def test_material_name_loss_is_rejected():
    published = index("2026-09-12T04:20:00+00:00", names=84_000)
    candidate = index("2026-09-13T04:20:00+00:00", names=60_000)

    problems = GATE.gate(candidate, published, 0.10)

    assert len(problems) == 1
    assert "28.6% drift" in problems[0]


def test_timestamp_rollback_is_rejected():
    published = index("2026-09-13T04:20:00+00:00")
    candidate = index("2026-09-12T04:20:00+00:00")

    problems = GATE.gate(candidate, published, 0.10)

    assert len(problems) == 1
    assert "not newer than production" in problems[0]


def test_malformed_production_baseline_is_rejected():
    published = index("2026-09-12T04:20:00+00:00", sources=3)
    candidate = index("2026-09-13T04:20:00+00:00")

    problems = GATE.gate(candidate, published, 0.10)

    assert problems == ["published index source_count is 3, expected 4"]
