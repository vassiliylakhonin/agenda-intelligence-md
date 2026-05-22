"""Evidence-mode discipline tests.

Fixtures under ``tests/fixtures/evidence_mode/{golden,failure}`` are
schema-valid agenda memos that differ only in declared
``evidence_mode`` and ``audit.provenance``. Golden memos must pass
both ``validate_memo`` (schema) and
``check_evidence_mode_discipline`` (post-hoc rule). Failure memos
must pass the schema but fail the discipline check — the rule must
not regress to "every memo passes".
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from agenda_intelligence.evidence_mode import check_evidence_mode_discipline
from agenda_intelligence.product import validate_memo

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "evidence_mode"
GOLDEN = sorted((FIXTURE_ROOT / "golden").glob("*.json"))
FAILURE = sorted((FIXTURE_ROOT / "failure").glob("*.json"))


def _load(path: Path) -> dict:
    return json.loads(path.read_text())


def test_fixture_sets_non_empty():
    assert GOLDEN, f"no golden fixtures under {FIXTURE_ROOT / 'golden'}"
    assert FAILURE, f"no failure fixtures under {FIXTURE_ROOT / 'failure'}"


@pytest.mark.parametrize("path", GOLDEN, ids=[p.stem for p in GOLDEN])
def test_golden_passes_schema_and_discipline(path: Path) -> None:
    memo = _load(path)
    schema_result = validate_memo(memo)
    assert schema_result["valid"], (
        f"{path.name}: schema validation failed (golden fixture must be schema-valid)\n"
        f"errors: {schema_result.get('errors')}"
    )
    discipline = check_evidence_mode_discipline(memo)
    assert discipline["ok"], f"{path.name}: discipline check failed (expected pass)\n" f"errors: {discipline['errors']}"


@pytest.mark.parametrize("path", FAILURE, ids=[p.stem for p in FAILURE])
def test_failure_passes_schema_but_fails_discipline(path: Path) -> None:
    memo = _load(path)
    schema_result = validate_memo(memo)
    assert schema_result["valid"], (
        f"{path.name}: failure fixture must still be schema-valid "
        f"(the discipline rule is post-hoc, not a schema replacement)\n"
        f"errors: {schema_result.get('errors')}"
    )
    discipline = check_evidence_mode_discipline(memo)
    assert not discipline["ok"], f"{path.name}: discipline check unexpectedly passed"
    assert discipline["errors"], f"{path.name}: discipline failed with no errors recorded"
