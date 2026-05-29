import json
import re
from pathlib import Path

from jsonschema import Draft202012Validator

from agenda_intelligence import services
from agenda_intelligence.mcp_server import source_plan

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_DIR = ROOT / "examples" / "agentic-interaction-trust" / "contract"
REQUEST_SCHEMA_PATH = ROOT / "schemas" / "v1" / "agentic-interaction-trust-request.schema.json"
RESPONSE_SCHEMA_PATH = ROOT / "schemas" / "v1" / "agentic-interaction-trust-response.schema.json"
TAXONOMY_PATH = ROOT / "source-requirements" / "agentic-interaction-trust.json"

REQUIRED_BEFORE_GO = {
    "agent_identity_claim",
    "operator_or_principal_authorization",
    "agent_card_or_manifest",
    "tool_scope_or_permission_evidence",
    "session_authentication_evidence",
    "action_intent_evidence",
    "transaction_or_target_action_evidence",
}

FORBIDDEN_AUTHORIZATION_WORDING = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bverified identity\b",
        r"\bidentity verified\b",
        r"\bauthorized transaction\b",
        r"\btransaction authorized\b",
        r"\bfraud cleared\b",
        r"\bcybersecurity clearance\b",
        r"\baccess approved\b",
    ]
]


def load_json(path: Path):
    return json.loads(path.read_text())


def assert_valid(schema_path: Path, fixture_path: Path):
    schema = load_json(schema_path)
    fixture = load_json(fixture_path)
    Draft202012Validator(schema).validate(fixture)


def test_agentic_interaction_trust_request_fixtures_validate():
    request_fixtures = sorted(CONTRACT_DIR.glob("*.request.json"))
    assert request_fixtures

    for fixture_path in request_fixtures:
        assert_valid(REQUEST_SCHEMA_PATH, fixture_path)


def test_agentic_interaction_trust_response_fixtures_validate():
    response_fixtures = sorted(CONTRACT_DIR.glob("*.response.json"))
    assert response_fixtures

    for fixture_path in response_fixtures:
        assert_valid(RESPONSE_SCHEMA_PATH, fixture_path)


def test_agentic_interaction_trust_taxonomy_contains_required_sources():
    taxonomy = load_json(TAXONOMY_PATH)

    assert taxonomy["category"] == "agentic-interaction-trust"
    assert REQUIRED_BEFORE_GO <= set(taxonomy["required_before_go"])
    assert "evidence triage" in taxonomy["boundary"]


def test_agentic_interaction_trust_source_plan_is_discoverable():
    result = source_plan("agentic-interaction-trust")

    assert result["implemented"] is True
    assert result["error"] is None
    assert result["plan"]["category"] == "agentic-interaction-trust"
    assert REQUIRED_BEFORE_GO <= set(result["plan"]["required_before_go"])


def test_agentic_interaction_trust_response_fixtures_include_boundary_notice():
    for fixture_path in sorted(CONTRACT_DIR.glob("*.response.json")):
        response = load_json(fixture_path)
        assert response["not_advice_notice"]
        assert "Not cybersecurity monitoring" in response["not_advice_notice"]
        assert "identity verification" in response["not_advice_notice"]
        assert "transaction authorization" in response["not_advice_notice"]


def test_agentic_interaction_trust_response_fixtures_do_not_imply_authorization():
    for fixture_path in sorted(CONTRACT_DIR.glob("*.response.json")):
        text = json.dumps(load_json(fixture_path), sort_keys=True)
        for pattern in FORBIDDEN_AUTHORIZATION_WORDING:
            assert not pattern.search(text), f"{fixture_path.name} contains forbidden wording: {pattern.pattern}"


def test_agentic_interaction_trust_response_fixtures_match_service_output():
    for request_path in sorted(CONTRACT_DIR.glob("*.request.json")):
        expected_response = load_json(request_path.with_suffix("").with_suffix(".response.json"))

        result = services.agentic_interaction_trust(load_json(request_path))

        assert result["valid"] is True
        assert result["response"] == expected_response
