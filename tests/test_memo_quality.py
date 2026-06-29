import json
from pathlib import Path

import pytest

from agenda_intelligence.memo_quality import check_memo_quality
from agenda_intelligence.product import validate_memo

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "memo_quality"
GOLDEN = sorted((FIXTURE_ROOT / "golden").glob("*.json"))
FAILURE = sorted((FIXTURE_ROOT / "failure").glob("*.json"))


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_fixture_sets_non_empty():
    assert GOLDEN, f"no golden fixtures under {FIXTURE_ROOT / 'golden'}"
    assert FAILURE, f"no failure fixtures under {FIXTURE_ROOT / 'failure'}"


@pytest.mark.parametrize("path", GOLDEN, ids=[p.stem for p in GOLDEN])
def test_golden_memos_pass_schema_and_quality(path: Path):
    memo = load_json(path)

    schema_result = validate_memo(memo)
    assert schema_result["valid"], schema_result["errors"]

    quality = check_memo_quality(memo)
    assert quality["ok"], quality["errors"]


@pytest.mark.parametrize("path", FAILURE, ids=[p.stem for p in FAILURE])
def test_bad_memos_pass_schema_but_fail_quality(path: Path):
    memo = load_json(path)

    schema_result = validate_memo(memo)
    assert schema_result["valid"], schema_result["errors"]

    quality = check_memo_quality(memo)
    assert not quality["ok"]
    assert quality["errors"]
