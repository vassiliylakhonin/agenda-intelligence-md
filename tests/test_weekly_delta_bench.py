import json
from pathlib import Path

from jsonschema import validate

from agenda_intelligence.weekly_delta_bench import run_weekly_delta_bench

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "weekly_delta"
MANIFEST_SCHEMA = ROOT / "schemas" / "v1" / "weekly-delta-fixture-manifest.schema.json"
GOLDEN = sorted((FIXTURE_ROOT / "golden").glob("*.md"))
FAILURE = sorted((FIXTURE_ROOT / "failure").glob("*.md"))


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_weekly_delta_fixture_sets_non_empty():
    assert GOLDEN, f"no golden fixtures under {FIXTURE_ROOT / 'golden'}"
    assert FAILURE, f"no failure fixtures under {FIXTURE_ROOT / 'failure'}"


def test_weekly_delta_fixture_manifest_validates_schema():
    manifest = load_json(FIXTURE_ROOT / "manifest.json")
    schema = load_json(MANIFEST_SCHEMA)

    validate(manifest, schema)


def test_weekly_delta_bench_module_uses_fixture_manifest():
    payload = run_weekly_delta_bench(FIXTURE_ROOT)

    assert payload["summary"]["ok"] is True
    assert payload["summary"]["manifest_present"] is True
    assert payload["summary"]["manifest_errors"] == []
    assert payload["summary"]["golden_total"] == len(GOLDEN)
    assert payload["summary"]["failure_total"] == len(FAILURE)
    named_leak = next(case for case in payload["cases"] if case["case"] == "named-project-leak")
    assert "confidential_alias_discipline" in named_leak["failed_guardrails"]
