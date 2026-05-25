import json
import re
from pathlib import Path

from jsonschema import Draft202012Validator

from agenda_intelligence.mcp_server import source_plan

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_DIR = ROOT / "examples" / "kazakhstan-middle-corridor" / "contract"
REQUEST_SCHEMA_PATH = ROOT / "schemas" / "v1" / "middle-corridor-deal-risk-request.schema.json"
RESPONSE_SCHEMA_PATH = ROOT / "schemas" / "v1" / "middle-corridor-deal-risk-response.schema.json"
TAXONOMY_PATH = ROOT / "source-requirements" / "middle-corridor-deal-risk.json"

REQUIRED_BEFORE_GO = {
    "counterparty_registry_extract",
    "beneficial_ownership_source",
    "sanctions_list_extract",
    "customs_or_regulatory_source",
    "insurance_clause_or_underwriter_note",
    "vessel_or_carrier_history",
}

FORBIDDEN_CLEARANCE_WORDING = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bcleared\b",
        r"\bapproved\b",
        r"\bcompliant\b",
        r"\bsanctions safe\b",
        r"\blegal conclusion\b",
        r"\bcompliance approval\b",
        r"\bno sanctions risk\b",
    ]
]


def load_json(path: Path):
    return json.loads(path.read_text())


def assert_valid(schema_path: Path, fixture_path: Path):
    schema = load_json(schema_path)
    fixture = load_json(fixture_path)
    Draft202012Validator(schema).validate(fixture)


def test_middle_corridor_request_fixtures_validate():
    request_fixtures = sorted(CONTRACT_DIR.glob("*.request.json"))
    assert request_fixtures

    for fixture_path in request_fixtures:
        assert_valid(REQUEST_SCHEMA_PATH, fixture_path)


def test_middle_corridor_response_fixtures_validate():
    response_fixtures = sorted(CONTRACT_DIR.glob("*.response.json"))
    assert response_fixtures

    for fixture_path in response_fixtures:
        assert_valid(RESPONSE_SCHEMA_PATH, fixture_path)


def test_middle_corridor_taxonomy_contains_required_before_go_sources():
    taxonomy = load_json(TAXONOMY_PATH)

    assert taxonomy["category"] == "middle-corridor-deal-risk"
    assert REQUIRED_BEFORE_GO <= set(taxonomy["required_before_go"])
    assert "pre-compliance evidence triage" in taxonomy["boundary"]


def test_middle_corridor_source_plan_is_discoverable():
    result = source_plan("middle-corridor-deal-risk")

    assert result["implemented"] is True
    assert result["error"] is None
    assert result["plan"]["category"] == "middle-corridor-deal-risk"
    assert REQUIRED_BEFORE_GO <= set(result["plan"]["required_before_go"])


def test_middle_corridor_response_fixtures_include_not_advice_notice():
    for fixture_path in sorted(CONTRACT_DIR.glob("*.response.json")):
        response = load_json(fixture_path)
        assert response["not_advice_notice"]
        assert (
            "Not legal, sanctions, compliance, financial, investment, insurance, or trading advice."
            in response["not_advice_notice"]
        )


def test_middle_corridor_response_fixtures_do_not_imply_clearance():
    for fixture_path in sorted(CONTRACT_DIR.glob("*.response.json")):
        text = json.dumps(load_json(fixture_path), sort_keys=True)
        for pattern in FORBIDDEN_CLEARANCE_WORDING:
            assert not pattern.search(text), f"{fixture_path.name} contains forbidden wording: {pattern.pattern}"
