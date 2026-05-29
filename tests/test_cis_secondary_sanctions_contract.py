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
    # Per the 2026-05-27 update to ADR 0014, the profile declares multiple
    # upstream options (free options first, paid options second).
    options = profile["upstream_options"]
    assert [o["name"] for o in options] == ["Watchman", "OpenSanctions"]
    assert options[0]["license"] == "Apache-2.0"
    assert options[0]["activation_env_var"] == "WATCHMAN_URL"
    assert options[1]["license"] == "CC-BY-4.0"
    assert options[1]["activation_env_var"] == "OPENSANCTIONS_API_KEY"


def test_is_live_retrieval_active_requires_an_upstream(monkeypatch):
    from agenda_intelligence.a2a_adapter import (
        active_upstream_option,
        is_live_retrieval_active,
    )

    for var in ["WATCHMAN_URL", "WATCHMAN_DISABLED", "OPENSANCTIONS_API_KEY", "OPENSANCTIONS_DISABLED"]:
        monkeypatch.delenv(var, raising=False)
    assert is_live_retrieval_active("cis_secondary_sanctions") is False
    assert active_upstream_option("cis_secondary_sanctions") is None

    monkeypatch.setenv("OPENSANCTIONS_API_KEY", "test-key")
    assert is_live_retrieval_active("cis_secondary_sanctions") is True
    active = active_upstream_option("cis_secondary_sanctions")
    assert active is not None and active["name"] == "OpenSanctions"

    # Watchman is preferred over OpenSanctions when both are set (free first).
    monkeypatch.setenv("WATCHMAN_URL", "https://watchman.example.com")
    active = active_upstream_option("cis_secondary_sanctions")
    assert active is not None and active["name"] == "Watchman"

    # Disabling Watchman falls back to OpenSanctions.
    monkeypatch.setenv("WATCHMAN_DISABLED", "1")
    active = active_upstream_option("cis_secondary_sanctions")
    assert active is not None and active["name"] == "OpenSanctions"

    # Unknown profile is always False.
    assert is_live_retrieval_active("agenda") is False


def test_agent_card_per_profile_live_retrieval_reports_capability_and_active(monkeypatch):
    from agenda_intelligence.a2a_adapter import agent_card

    for var in ["WATCHMAN_URL", "WATCHMAN_DISABLED", "OPENSANCTIONS_API_KEY", "OPENSANCTIONS_DISABLED"]:
        monkeypatch.delenv(var, raising=False)
    card = agent_card()
    block = card["x_agenda_intelligence"]["per_profile_live_retrieval"]["cis_secondary_sanctions"]
    assert block["capability_declared"] is True
    assert block["active"] is False
    assert block["active_upstream"] is None
    assert [o["name"] for o in block["upstream_options"]] == ["Watchman", "OpenSanctions"]
    assert block["upstream_options"][0]["active"] is False

    monkeypatch.setenv("WATCHMAN_URL", "https://watchman.example.com")
    card = agent_card()
    block = card["x_agenda_intelligence"]["per_profile_live_retrieval"]["cis_secondary_sanctions"]
    assert block["active"] is True
    assert block["active_upstream"] == "Watchman"


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


def test_cis_undisclosed_ubo_flagged(monkeypatch):
    """Undisclosed/unverified UBO in ownership_layers must surface as an explicit
    exposure dimension + limitation. Dogfood finding 2026-05-28."""
    monkeypatch.setenv("OPENSANCTIONS_DISABLED", "1")
    req = {
        "counterparty": {
            "name": "Example Caspian Metals Trading LLP",
            "jurisdiction": "Kazakhstan",
            "sector": "metals_or_mining",
            "ownership_layers": ["Holding A (KZ)", "Aurora Resources FZE (UAE)", "undisclosed UBO"],
        },
        "exposure_facets": ["ownership_or_control", "shell_or_layered_structure"],
        "dated_sources": [
            {"id": "s1", "source_type": "ofac_sdn_extract", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "q",
        "decision_stage": "onboarding",
    }
    resp = services.cis_secondary_sanctions_exposure(req)["response"]
    assert "undisclosed or unverified ultimate beneficial owner" in resp["top_exposure_dimensions"]
    assert any("undisclosed or unverified" in line and "UBO" in line for line in resp["limitations"])


def test_cis_clean_ownership_does_not_flag_ubo(monkeypatch):
    """Negative control: a fully disclosed ownership chain must NOT trigger the UBO flag."""
    monkeypatch.setenv("OPENSANCTIONS_DISABLED", "1")
    req = {
        "counterparty": {
            "name": "Example Clean Trading LLP",
            "jurisdiction": "Kazakhstan",
            "ownership_layers": ["Holding A (KZ)", "Owner B (KZ)"],
        },
        "exposure_facets": ["ownership_or_control"],
        "dated_sources": [
            {"id": "s1", "source_type": "ofac_sdn_extract", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "q",
        "decision_stage": "onboarding",
    }
    resp = services.cis_secondary_sanctions_exposure(req)["response"]
    assert "undisclosed or unverified ultimate beneficial owner" not in resp["top_exposure_dimensions"]
    assert not any("undisclosed or unverified" in line for line in resp["limitations"])


def test_cis_limitations_do_not_leak_env_var_names(monkeypatch):
    """The user-facing limitations array must not echo internal env-var names
    (OPENSANCTIONS_DISABLED / OPENSANCTIONS_API_KEY / WATCHMAN_URL). Dogfood
    finding 2026-05-28."""
    monkeypatch.setenv("OPENSANCTIONS_DISABLED", "1")
    request_json = load_json(CONTRACT_DIR / "escalate_before_onboarding.request.json")
    resp = services.cis_secondary_sanctions_exposure(request_json)["response"]
    joined = " ".join(resp["limitations"])
    for leak in ("OPENSANCTIONS_DISABLED", "OPENSANCTIONS_API_KEY", "WATCHMAN_URL", "env flag", "env var"):
        assert leak not in joined, f"limitations leaked internal token: {leak}"
    # But the degrade is still communicated in user-safe language
    assert any("not currently enabled" in line or "was unavailable" in line for line in resp["limitations"])
