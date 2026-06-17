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
