import json
import re
from pathlib import Path

from jsonschema import Draft202012Validator

from agenda_intelligence import services
from agenda_intelligence.a2a_adapter import (
    CIS_SECONDARY_SANCTIONS_ENDPOINT,
    CIS_SECONDARY_SANCTIONS_SCHEMA,
    LIVE_RETRIEVAL_PROFILES,
    SUPPORTED_CAPABILITIES,
    a2a_result_for_cis_secondary_sanctions,
)

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_DIR = ROOT / "examples" / "cis-secondary-sanctions" / "contract"
REQUEST_SCHEMA_PATH = ROOT / "schemas" / "v1" / "cis-secondary-sanctions-request.schema.json"
RESPONSE_SCHEMA_PATH = ROOT / "schemas" / "v1" / "cis-secondary-sanctions-response.schema.json"
TAXONOMY_PATH = ROOT / "source-requirements" / "cis-secondary-sanctions.json"

REQUIRED_BEFORE_REVIEW = {
    "ofac_sdn_extract",
    "eu_consolidated_extract",
    "ownership_chain_evidence",
    "bank_correspondent_evidence",
    "transit_or_invoice_evidence",
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


def test_cis_request_fixtures_validate():
    request_fixtures = sorted(CONTRACT_DIR.glob("*.request.json"))
    assert request_fixtures
    for fixture_path in request_fixtures:
        assert_valid(REQUEST_SCHEMA_PATH, fixture_path)


def test_cis_response_fixtures_validate():
    response_fixtures = sorted(CONTRACT_DIR.glob("*.response.json"))
    assert response_fixtures
    for fixture_path in response_fixtures:
        assert_valid(RESPONSE_SCHEMA_PATH, fixture_path)


def test_cis_taxonomy_contains_required_sources():
    taxonomy = load_json(TAXONOMY_PATH)
    assert taxonomy["category"] == "cis-secondary-sanctions"
    assert REQUIRED_BEFORE_REVIEW <= set(taxonomy["required_before_go"])
    assert "pre-compliance evidence triage" in taxonomy["boundary"]


def test_cis_service_runs_golden_request(monkeypatch):
    monkeypatch.setenv("OPENSANCTIONS_DISABLED", "1")
    request_json = load_json(CONTRACT_DIR / "escalate_before_onboarding.request.json")
    result = services.cis_secondary_sanctions_exposure(request_json)
    assert result["implemented"] is True
    assert result["valid"] is True
    response = result["response"]
    assert response["triage_recommendation"] == "escalate_before_onboarding"
    assert response["human_review_required"] is True
    assert "Not legal" in response["not_advice_notice"]
    for pattern in FORBIDDEN_CLEARANCE_WORDING:
        assert not any(
            pattern.search(value)
            for value in response.get("top_exposure_dimensions", []) + response.get("evidence_gaps", [])
        )


def test_cis_service_rejects_invalid_request(monkeypatch):
    monkeypatch.setenv("OPENSANCTIONS_DISABLED", "1")
    bad = {"counterparty": {"jurisdiction": "Kazakhstan"}}  # missing name + required fields
    result = services.cis_secondary_sanctions_exposure(bad)
    assert result["implemented"] is True
    assert result["valid"] is False
    assert result["errors"]


def test_cis_service_degrades_gracefully_when_upstream_unavailable(monkeypatch):
    monkeypatch.delenv("OPENSANCTIONS_API_KEY", raising=False)
    monkeypatch.delenv("OPENSANCTIONS_DISABLED", raising=False)
    request_json = load_json(CONTRACT_DIR / "escalate_before_onboarding.request.json")
    result = services.cis_secondary_sanctions_exposure(request_json)
    assert result["valid"] is True
    assert result["live_retrieval_status"] in {"disabled", "degraded"}
    response = result["response"]
    assert any("OpenSanctions" in note for note in response["limitations"])
    assert response["human_review_required"] is True


def test_cis_a2a_adapter_capability_registered():
    assert "cis_secondary_sanctions_exposure" in SUPPORTED_CAPABILITIES
    assert "cis_secondary_sanctions" in LIVE_RETRIEVAL_PROFILES
    profile = LIVE_RETRIEVAL_PROFILES["cis_secondary_sanctions"]
    assert "OpenSanctions" in profile["upstreams"]
    assert profile["license"].startswith("CC-BY")
    # Per the 2026-05-27 update to ADR 0014, activation requires an env var.
    assert profile["activation_env_var"] == "OPENSANCTIONS_API_KEY"
    assert profile["disable_env_var"] == "OPENSANCTIONS_DISABLED"


def test_is_live_retrieval_active_requires_api_key(monkeypatch):
    from agenda_intelligence.a2a_adapter import is_live_retrieval_active

    monkeypatch.delenv("OPENSANCTIONS_API_KEY", raising=False)
    monkeypatch.delenv("OPENSANCTIONS_DISABLED", raising=False)
    assert is_live_retrieval_active("cis_secondary_sanctions") is False

    monkeypatch.setenv("OPENSANCTIONS_API_KEY", "test-key")
    assert is_live_retrieval_active("cis_secondary_sanctions") is True

    monkeypatch.setenv("OPENSANCTIONS_DISABLED", "1")
    assert is_live_retrieval_active("cis_secondary_sanctions") is False

    # Unknown profile is always False.
    monkeypatch.setenv("OPENSANCTIONS_API_KEY", "test-key")
    monkeypatch.delenv("OPENSANCTIONS_DISABLED", raising=False)
    assert is_live_retrieval_active("agenda") is False


def test_agent_card_per_profile_live_retrieval_reports_capability_and_active(monkeypatch):
    from agenda_intelligence.a2a_adapter import agent_card

    monkeypatch.delenv("OPENSANCTIONS_API_KEY", raising=False)
    monkeypatch.delenv("OPENSANCTIONS_DISABLED", raising=False)
    card = agent_card()
    block = card["x_agenda_intelligence"]["per_profile_live_retrieval"]["cis_secondary_sanctions"]
    assert block["capability_declared"] is True
    assert block["active"] is False
    assert block["upstreams"] == ["OpenSanctions"]
    assert block["activation_env_var"] == "OPENSANCTIONS_API_KEY"

    monkeypatch.setenv("OPENSANCTIONS_API_KEY", "test-key")
    card = agent_card()
    block = card["x_agenda_intelligence"]["per_profile_live_retrieval"]["cis_secondary_sanctions"]
    assert block["active"] is True


def test_cis_a2a_result_shape(monkeypatch):
    monkeypatch.setenv("OPENSANCTIONS_DISABLED", "1")
    request_json = load_json(CONTRACT_DIR / "escalate_before_onboarding.request.json")
    result = a2a_result_for_cis_secondary_sanctions(request_json)
    assert result["status"]["state"] == "completed"
    metadata = result["metadata"]
    assert metadata["product_profile"] == "cis_secondary_sanctions"
    assert metadata["canonical_http_endpoint"] == CIS_SECONDARY_SANCTIONS_ENDPOINT
    assert metadata["schema"] == CIS_SECONDARY_SANCTIONS_SCHEMA
    assert metadata["live_retrieval_status"] in {"disabled", "degraded"}
    assert metadata["human_review_required"] is True
