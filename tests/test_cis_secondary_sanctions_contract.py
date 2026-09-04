import json
import re
from pathlib import Path

from jsonschema import Draft202012Validator

from agenda_intelligence import services, upstream_opensanctions
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
    # The degrade note must be surfaced so the caller knows retrieval is off...
    assert any("Live sanctions-list retrieval" in note for note in response["limitations"])
    # ...but the CC-BY attribution must NOT appear when nothing was fetched: no
    # upstream data was used, so there is no attribution obligation and no match to
    # imply. Regression guard for the disabled / degraded / zero-match path.
    assert result["auto_fetched_sources"] == []
    assert not any("via OpenSanctions" in note for note in response["limitations"])
    assert response["human_review_required"] is True


def test_opensanctions_without_key_never_invents_a_match(monkeypatch):
    monkeypatch.delenv("OPENSANCTIONS_API_KEY", raising=False)
    monkeypatch.delenv("OPENSANCTIONS_DISABLED", raising=False)

    result = upstream_opensanctions.match_counterparty(
        name="Any Nonempty Counterparty",
        jurisdiction="kz",
    )

    assert result["status"] == "degraded"
    assert result["matches"] == []
    assert "not configured" in result["degrade_reason"]


def test_cis_a2a_adapter_capability_registered():
    assert "cis_secondary_sanctions_exposure" in SUPPORTED_CAPABILITIES
    assert "cis_secondary_sanctions" in LIVE_RETRIEVAL_PROFILES
    profile = LIVE_RETRIEVAL_PROFILES["cis_secondary_sanctions"]
    # Per ADR 0020, Snapshot is the first $0 upstream; Watchman and
    # OpenSanctions remain alternates.
    options = profile["upstream_options"]
    assert [o["name"] for o in options] == ["Snapshot", "Watchman", "OpenSanctions"]
    assert options[0]["activation_env_var"] == "SNAPSHOT_INDEX_URL"
    assert options[1]["license"] == "Apache-2.0"
    assert options[1]["activation_env_var"] == "WATCHMAN_URL"
    assert options[2]["license"] == "CC-BY-4.0"
    assert options[2]["activation_env_var"] == "OPENSANCTIONS_API_KEY"


def test_is_live_retrieval_active_requires_an_upstream(monkeypatch):
    from agenda_intelligence.a2a_adapter import (
        active_upstream_option,
        is_live_retrieval_active,
    )

    for var in [
        "SNAPSHOT_INDEX_URL",
        "SNAPSHOT_DISABLED",
        "WATCHMAN_URL",
        "WATCHMAN_DISABLED",
        "OPENSANCTIONS_API_KEY",
        "OPENSANCTIONS_DISABLED",
    ]:
        monkeypatch.delenv(var, raising=False)
    assert is_live_retrieval_active("cis_secondary_sanctions") is False
    assert active_upstream_option("cis_secondary_sanctions") is None

    monkeypatch.setenv("SNAPSHOT_INDEX_URL", "https://example.github.io/sanctions-name-index-compact.json")
    assert is_live_retrieval_active("cis_secondary_sanctions") is True
    active = active_upstream_option("cis_secondary_sanctions")
    assert active is not None and active["name"] == "Snapshot"

    monkeypatch.setenv("SNAPSHOT_DISABLED", "1")
    monkeypatch.setenv("OPENSANCTIONS_API_KEY", "test-key")
    active = active_upstream_option("cis_secondary_sanctions")
    assert active is not None and active["name"] == "OpenSanctions"

    # Watchman is preferred over OpenSanctions when Snapshot is disabled.
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

    for var in [
        "SNAPSHOT_INDEX_URL",
        "SNAPSHOT_DISABLED",
        "WATCHMAN_URL",
        "WATCHMAN_DISABLED",
        "OPENSANCTIONS_API_KEY",
        "OPENSANCTIONS_DISABLED",
    ]:
        monkeypatch.delenv(var, raising=False)
    card = agent_card()
    block = card["x_agenda_intelligence"]["per_profile_live_retrieval"]["cis_secondary_sanctions"]
    assert block["capability_declared"] is True
    assert block["active"] is False
    assert block["active_upstream"] is None
    assert [o["name"] for o in block["upstream_options"]] == ["Snapshot", "Watchman", "OpenSanctions"]
    assert block["upstream_options"][0]["active"] is False

    monkeypatch.setenv("SNAPSHOT_INDEX_URL", "https://example.github.io/sanctions-name-index-compact.json")
    card = agent_card()
    block = card["x_agenda_intelligence"]["per_profile_live_retrieval"]["cis_secondary_sanctions"]
    assert block["active"] is True
    assert block["active_upstream"] == "Snapshot"


def test_cis_a2a_result_shape(monkeypatch):
    monkeypatch.setenv("OPENSANCTIONS_DISABLED", "1")
    request_json = load_json(CONTRACT_DIR / "escalate_before_onboarding.request.json")
    result = a2a_result_for_cis_secondary_sanctions(request_json)
    assert result["status"]["state"] == "TASK_STATE_COMPLETED"
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


def test_cis_country_level_anti_circumvention_flag(monkeypatch):
    """A counterparty domiciled in a jurisdiction under EU country-level anti-circumvention
    (Kyrgyzstan, 20th package) raises a sharper limitation; a non-listed jurisdiction does not."""
    monkeypatch.setenv("OPENSANCTIONS_DISABLED", "1")

    def _req(jurisdiction: str) -> dict:
        return {
            "counterparty": {"name": "Example Trading LLP", "jurisdiction": jurisdiction},
            "exposure_facets": ["transit_or_re_export"],
            "dated_sources": [{"id": "s1", "source_type": "ofac_sdn_extract", "title": "x", "date": "2026-05-20"}],
            "risk_question": "q",
            "decision_stage": "onboarding",
        }

    kg = services.cis_secondary_sanctions_exposure(_req("Kyrgyzstan"))["response"]
    assert any("country-level anti-circumvention" in line for line in kg["limitations"])

    kz = services.cis_secondary_sanctions_exposure(_req("Kazakhstan"))["response"]
    assert not any("country-level anti-circumvention" in line for line in kz["limitations"])


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


def test_cis_vessel_match_is_not_reported_as_a_counterparty_match():
    """A ship or aircraft named after a person is not that person.

    OFAC SDN carries a Russian supply vessel named after a former head of state.
    Reporting a hit on it as a direct match on the counterparty states something
    the record does not support. It is still surfaced, named for what it is.
    Parity with the worker (deploy/cloudflare-worker/src/index.js).
    """
    vessel = [{"entity_type": "vessel", "datasets": ["US OFAC / SDN"]}]
    dims = services._cis_top_exposure_dimensions([], [], vessel)
    assert not any(d.startswith("direct or near-direct match") for d in dims)
    assert any("listed vessel or aircraft" in d and "not a match on the counterparty itself" in d for d in dims)
    assert any("US OFAC / SDN" in d for d in dims)

    company = [{"entity_type": "entity", "datasets": ["US OFAC / SDN"]}]
    dims = services._cis_top_exposure_dimensions([], [], company)
    assert any(d.startswith("direct or near-direct match") and "US OFAC / SDN" in d for d in dims)
    assert not any("listed vessel or aircraft" in d for d in dims)


def test_cis_dimension_names_the_upstream_that_answered():
    """The dimension used to say OpenSanctions whichever upstream produced the
    match, which misstated provenance once Snapshot or Watchman was active."""
    matches = [{"entity_type": "entity", "datasets": ["United Kingdom FCDO / UK Sanctions List"]}]
    dims = services._cis_top_exposure_dimensions([], [], matches)
    assert any("United Kingdom FCDO / UK Sanctions List" in d for d in dims)
    assert not any("OpenSanctions" in d for d in dims)

    unlabelled = [{"entity_type": "entity"}]
    dims = services._cis_top_exposure_dimensions([], [], unlabelled)
    assert any("the active sanctions-list upstream" in d for d in dims)


def test_cis_entity_type_mapping_does_not_guess():
    assert services._entity_type_for_schema("Person") == "individual"
    assert services._entity_type_for_schema("Vessel") == "vessel"
    assert services._entity_type_for_schema("Airplane") == "aircraft"
    assert services._entity_type_for_schema("Company") == "entity"
    assert services._entity_type_for_schema(None) == "unknown"
    assert services._entity_type_for_schema("SomethingNew") == "unknown"


def _success_upstream(match_source_type: str = "ofac_sdn_extract"):
    """Stub upstream: one successful public-list name match on the counterparty."""

    def _match_counterparty(**_kwargs) -> dict:
        return {
            "status": "success",
            "matches": [
                {
                    "source_type": match_source_type,
                    "name": "EXAMPLE KZ HOLDING LLP",
                    "schema": "Company",
                    "datasets": ["us_ofac_sdn"],
                    "opensanctions_id": "NK-contract-test",
                    "score": 1.0,
                    "topics": ["sanction"],
                    "jurisdictions": ["kz"],
                }
            ],
            "attribution": {"notice": "Contains information from OpenSanctions, CC-BY 4.0."},
        }

    return _match_counterparty


def test_cis_service_scores_a_merged_name_match_rather_than_reporting_nothing(monkeypatch):
    """A merged screening match has to reach the verdict, not only the evidence list.

    The scorers used to gate on ``request_json["dated_sources"]`` while live
    retrieval merged its matches into ``supplied_sources``. A request carrying no
    dated sources of its own then came back naming an OFAC SDN entry on the
    counterparty under ``unknown`` / ``insufficient_information`` / 0 — the two
    halves of one response contradicting each other.
    """
    monkeypatch.setattr(services.upstream_opensanctions, "match_counterparty", _success_upstream())
    request_json = load_json(CONTRACT_DIR / "insufficient_information.request.json")
    assert request_json["dated_sources"] == [], "this fixture is the no-caller-evidence case"

    result = services.cis_secondary_sanctions_exposure(request_json)
    assert result["valid"] is True
    assert result["live_retrieval_status"] == "success"
    assert len(result["auto_fetched_sources"]) == 1

    response = result["response"]
    # The evidence half.
    assert "ofac_sdn_extract" in response["supplied_sources"]
    assert "ofac_sdn_extract" not in response["minimum_sources_before_review"]
    # The verdict half, which must agree with it.
    assert response["secondary_exposure_signal"] == "high"
    assert response["triage_recommendation"] != "insufficient_information"
    assert response["decision_readiness_score"] > 0
    assert response["decision_readiness_label"] != "insufficient_information"
    # Scoring the match does not upgrade what the gate claims about it.
    assert response["human_review_required"] is True
    assert any(
        "resembles this counterparty" in note and "not a determination" in note for note in response["limitations"]
    )
    Draft202012Validator(load_json(RESPONSE_SCHEMA_PATH)).validate(response)


def test_cis_service_still_reports_nothing_when_screening_merges_no_match(monkeypatch):
    """The other half of the invariant: scoring the effective pack invents nothing.

    A successful screening run that matched no list leaves the evidence pack
    empty, and the verdict must stay the honest "we have nothing" it always was.
    """

    def _no_match(**_kwargs) -> dict:
        return {
            "status": "success",
            "matches": [],
            "attribution": {"notice": "Contains information from OpenSanctions, CC-BY 4.0."},
        }

    monkeypatch.setattr(services.upstream_opensanctions, "match_counterparty", _no_match)
    request_json = load_json(CONTRACT_DIR / "insufficient_information.request.json")

    result = services.cis_secondary_sanctions_exposure(request_json)
    response = result["response"]
    assert result["auto_fetched_sources"] == []
    assert response["supplied_sources"] == []
    assert response["secondary_exposure_signal"] == "unknown"
    assert response["triage_recommendation"] == "insufficient_information"
    assert response["decision_readiness_score"] == 0
    assert not any("Live name screening merged" in note for note in response["limitations"])
