"""Service-level tests for the Kazakhstan market-entry readiness gate worker.

These complement the static contract test (tests/test_market_entry_readiness_contract.py)
by exercising the service function, the HTTP route, and the A2A profile against a
golden request and a failure case.
"""

import json
from pathlib import Path

from jsonschema import Draft202012Validator

from agenda_intelligence import a2a_adapter, http_api, services

ROOT = Path(__file__).resolve().parents[1]
RESPONSE_SCHEMA_PATH = ROOT / "schemas" / "v1" / "market-entry-readiness-response.schema.json"
EXAMPLE_DIR = ROOT / "examples" / "kazakhstan-market-entry-readiness" / "contract"


def load_json(path: Path):
    return json.loads(path.read_text())


GOLDEN_REQUEST = load_json(EXAMPLE_DIR / "pre_signature_validation.request.json")


def test_golden_request_is_schema_valid_and_validation_ready():
    result = services.kazakhstan_market_entry_readiness(GOLDEN_REQUEST)
    assert result["valid"] is True, result["errors"]
    response = result["response"]
    Draft202012Validator(load_json(RESPONSE_SCHEMA_PATH)).validate(response)
    assert response["gate_decision"] == "proceed_to_validation"
    assert response["readiness_label"] == "validation_ready"
    assert response["human_review_required"] is True
    # signature-tier gaps must surface for a pre-signature file missing legal/tax/banking evidence
    gap_types = {gap["source_type"] for gap in response["evidence_gaps"]}
    assert "law_firm_opinion" in gap_types
    assert "permanent_establishment_or_tax_residency_assessment" in gap_types
    assert response["run_provenance"]["input_digest"].startswith("sha256:")


def test_empty_evidence_at_commitment_stage_stops():
    request = {
        "project_name": "Bare file",
        "partner_or_company": "Example Co",
        "market": "Kazakhstan",
        "decision_question": "Can we sign now?",
        "decision_stage": "pre_signature",
        "supplied_sources": [],
    }
    result = services.kazakhstan_market_entry_readiness(request)
    assert result["valid"] is True, result["errors"]
    assert result["response"]["readiness_label"] == "insufficient_information"
    assert result["response"]["gate_decision"] == "stop"


def test_invalid_request_is_rejected():
    # missing required fields (decision_stage, supplied_sources, ...)
    result = services.kazakhstan_market_entry_readiness({"project_name": "x"})
    assert result["valid"] is False
    assert result["errors"]
    assert result["response"] is None


def test_http_route_returns_response():
    status, body = http_api.handle_post("/v1/market-entry/readiness", GOLDEN_REQUEST)
    assert status == 200
    assert body["readiness_label"] == "validation_ready"
    assert body["boundary_notice"]


def test_http_route_rejects_invalid_request():
    status, body = http_api.handle_post("/v1/market-entry/readiness", {"project_name": "x"})
    assert status == 400
    assert body["ok"] is False


def test_readyz_lists_market_entry():
    status, body = http_api.handle_get("/readyz")
    assert status == 200
    assert "kazakhstan_market_entry_readiness" in body["service_layer"]


def test_a2a_profile_dispatches():
    payload = {
        "jsonrpc": "2.0",
        "id": "1",
        "method": "message/send",
        "params": {"capability": "market_entry_readiness", "request": GOLDEN_REQUEST},
    }
    rpc = a2a_adapter.handle_jsonrpc(payload, "https://example.test")
    result = rpc["result"]
    assert result["status"]["state"] == "TASK_STATE_COMPLETED"
    assert result["metadata"]["product_profile"] == "kazakhstan_market_entry_readiness"
    assert result["metadata"]["response"]["readiness_label"] == "validation_ready"


def test_agent_card_advertises_market_entry():
    card = a2a_adapter.agent_card("https://example.test")
    skill_ids = {skill["id"] for skill in card["skills"]}
    assert "kazakhstan-market-entry-readiness" in skill_ids
    assert "kazakhstan_market_entry_readiness" in card["x_agenda_intelligence"]["supported_capabilities"]


def _market_entry_request(sector: str, **overrides) -> dict:
    request = {
        "project_name": "Sector probe",
        "partner_or_company": "EU entrant",
        "market": "Kazakhstan",
        "sector": sector,
        "decision_question": "Ready for the next gate?",
        "decision_stage": "pre_signature",
        "supplied_sources": [
            {"id": "s1", "source_type": "product_or_project_description", "title": "x", "date": "2026-06-17"}
        ],
    }
    request.update(overrides)
    return request


def _gap_types(response: dict) -> set[str]:
    return {gap["source_type"] for gap in response["evidence_gaps"]}


def test_sector_requirements_differentiate_evidence_gaps():
    """The advertised sector breadth must be real: each sector surfaces its own
    required evidence, not one generic distribution-flavoured checklist."""
    renewable = services.kazakhstan_market_entry_readiness(_market_entry_request("renewable_energy"))["response"]
    tech = services.kazakhstan_market_entry_readiness(_market_entry_request("technology_transfer"))["response"]
    distribution = services.kazakhstan_market_entry_readiness(_market_entry_request("distribution"))["response"]

    assert "grid_connection_and_offtake_evidence" in _gap_types(renewable)
    assert "land_or_site_control_evidence" in _gap_types(renewable)
    assert "grid_connection_and_offtake_evidence" not in _gap_types(distribution)

    assert "ip_ownership_and_licensing_evidence" in _gap_types(tech)
    assert "export_control_classification_note" in _gap_types(tech)
    assert "ip_ownership_and_licensing_evidence" not in _gap_types(distribution)

    assert "customs_broker_memo" in _gap_types(distribution)


def test_watch_next_is_sector_tailored_not_static_dump():
    taxonomy = services._market_entry_taxonomy()
    full_static = set(taxonomy["watch_indicators"])
    renewable = services.kazakhstan_market_entry_readiness(_market_entry_request("renewable_energy"))["response"]
    tech = services.kazakhstan_market_entry_readiness(_market_entry_request("technology_transfer"))["response"]

    # tailored, not the full 20-item dump
    assert len(renewable["watch_next"]) < len(full_static)
    assert "auction or PPA tariff change" in renewable["watch_next"]
    assert "export-control or dual-use classification change" in tech["watch_next"]
    # sectors get different watch lists
    assert renewable["watch_next"] != tech["watch_next"]
    # always-on regulator signal is present
    assert "government or regulator signal" in renewable["watch_next"]


def test_claim_audit_reflects_caller_blockers_and_assumptions():
    request = _market_entry_request(
        "distribution",
        known_blockers=["No law-firm opinion supplied.", "No customs-broker memo."],
        known_assumptions=["Public benchmarks are not signed quotes."],
    )
    response = services.kazakhstan_market_entry_readiness(request)["response"]
    Draft202012Validator(load_json(RESPONSE_SCHEMA_PATH)).validate(response)
    claims = {item["claim"]: item for item in response["claim_audit"]}
    blocker_claim = next(c for k, c in claims.items() if "blockers" in k)
    assert blocker_claim["status"] == "unsupported"
    assert "2 open blocker" in blocker_claim["how_to_use_now"]
    assumption_claim = next(c for k, c in claims.items() if "assumptions are decision-grade" in k)
    assert assumption_claim["status"] == "assumption_only"


def test_sector_evidence_caps_launch_commitment():
    """A signature-complete renewable file with no sector evidence cannot reach
    launch_commitment_ready; the sector gap holds it at committee_review_ready."""
    taxonomy = services._market_entry_taxonomy()
    full_signature_pack = taxonomy["required_before_validation"] + taxonomy["required_before_signature"]
    sources = [
        {"id": f"s{i}", "source_type": t, "title": t, "date": "2026-06-17"} for i, t in enumerate(full_signature_pack)
    ]
    request = _market_entry_request("renewable_energy", supplied_sources=sources)
    response = services.kazakhstan_market_entry_readiness(request)["response"]
    assert response["readiness_label"] == "committee_review_ready"
    assert "grid_connection_and_offtake_evidence" in _gap_types(response)
