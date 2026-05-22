"""Fixture-driven geography-routing tests.

Each JSON file in ``tests/fixtures/routing/`` declares one request and the
exact set of modules ``route_modules`` is expected to load. The test set
covers the five canonical cases recorded in ROADMAP v0.9 acceptance
criterion #3: Kazakhstan-only, Iran-only, Russia-Iran-China junction,
EU AI Act, Middle Corridor. Adding or changing a fixture file is a
contract change on routing behaviour.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from agenda_intelligence.product import route_modules

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "routing"
FIXTURES = sorted(FIXTURE_DIR.glob("*.json"))


def _load(path: Path) -> dict:
    return json.loads(path.read_text())


def test_fixture_set_is_non_empty():
    assert FIXTURES, f"no routing fixtures discovered under {FIXTURE_DIR}"


@pytest.mark.parametrize("fixture_path", FIXTURES, ids=[p.stem for p in FIXTURES])
def test_routing_matches_fixture(fixture_path: Path) -> None:
    data = _load(fixture_path)
    request = data["request"]
    expected = sorted(data["expected_modules"])

    modules = route_modules(request.get("geography"), request.get("question", ""))
    actual = sorted(m["module"] for m in modules)

    assert actual == expected, (
        f"{fixture_path.name}: routing diverged from fixture\n" f"  expected: {expected}\n" f"  actual:   {actual}"
    )
