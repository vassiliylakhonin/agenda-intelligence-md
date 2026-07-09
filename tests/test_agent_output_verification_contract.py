import json
from pathlib import Path

from jsonschema import Draft202012Validator

from agenda_intelligence import a2a_adapter, http_api, services

ROOT = Path(__file__).resolve().parents[1]
RESPONSE_SCHEMA_PATH = ROOT / "schemas" / "v1" / "agent-output-verification-response.schema.json"
RESPONSE_SCHEMA = json.loads(RESPONSE_SCHEMA_PATH.read_text())


def _grounded_audit() -> dict:
    return {
        "topic": "corridor status",
        "claims": [
            {
                "claim_id": "c1",
                "claim": "The regulation entered into force on 1 May 2026.",
                "support_level": "direct",
                "evidence_ids": ["e1"],
                "supporting_quotes": [{"evidence_id": "e1", "quote": "in force from 1 May 2026"}],
            }
        ],
        "evidence": [
            {"evidence_id": "e1", "source_type": "official_document", "name": "Official gazette"},
        ],
    }


def test_grounded_output_allows_relay():
    result = services.agent_output_verification(_grounded_audit())
    assert result["valid"] is True
    response = result["response"]
    Draft202012Validator(RESPONSE_SCHEMA).validate(response)
    assert response["verdict"] == "allow_relay"
    assert response["trust_signal"] == "high"
    assert response["human_review_required"] is False
    assert response["unsafe_claims"] == []


def test_unsupported_claim_blocks_relay():
    audit = _grounded_audit()
    audit["claims"].append({"claim_id": "c2", "claim": "Volumes tripled last quarter.", "support_level": "unsupported"})
    result = services.agent_output_verification(audit)
    response = result["response"]
    Draft202012Validator(RESPONSE_SCHEMA).validate(response)
    assert response["verdict"] == "block_unsafe_claims"
    assert response["trust_signal"] == "low"
    assert response["human_review_required"] is True
    assert any(item["claim_id"] == "c2" for item in response["unsafe_claims"])
    assert response["readiness_score"] <= 49


def test_orphan_evidence_reference_is_unsafe():
    audit = _grounded_audit()
    audit["claims"][0]["evidence_ids"] = ["e_missing"]
    audit["claims"][0].pop("supporting_quotes", None)
    result = services.agent_output_verification(audit)
    response = result["response"]
    assert response["verdict"] == "block_unsafe_claims"
    assert any("not present" in item["reason"] for item in response["unsafe_claims"])
    assert response["evidence_gaps"]


def test_weak_claim_requires_verification():
    audit = _grounded_audit()
    audit["claims"][0]["support_level"] = "weak"
    result = services.agent_output_verification(audit)
    response = result["response"]
    assert response["verdict"] == "verify_before_relay"
    assert response["human_review_required"] is True
    assert any(item["claim_id"] == "c1" for item in response["weak_claims"])


def test_invalid_input_reports_validation_failure():
    result = services.agent_output_verification({"claims": []})
    assert result["valid"] is False
    assert result["errors"]
    assert result["response"] is None


def test_http_route_returns_verdict():
    status, body = http_api.handle_post("/v1/agent-output/verification", _grounded_audit())
    assert status == 200
    assert body["verdict"] == "allow_relay"


def test_http_route_rejects_invalid_request():
    status, body = http_api.handle_post("/v1/agent-output/verification", {"claims": []})
    assert status == 400
    assert body["ok"] is False


def test_a2a_dispatch_returns_completed_artifact():
    payload = {
        "jsonrpc": "2.0",
        "id": "1",
        "method": "message/send",
        "params": {"capability": "agent_output_verification", "request": _grounded_audit()},
    }
    response = a2a_adapter.handle_jsonrpc(payload)
    result = response["result"]
    assert result["status"]["state"] == "TASK_STATE_COMPLETED"
    assert result["metadata"]["product_profile"] == "agent_output_verification"
    assert result["metadata"]["response"]["verdict"] == "allow_relay"


def test_a2a_dispatch_missing_request_errors():
    payload = {
        "jsonrpc": "2.0",
        "id": "2",
        "method": "message/send",
        "params": {"capability": "agent_output_verification", "request": {"not": "an audit"}},
    }
    response = a2a_adapter.handle_jsonrpc(payload)
    assert response["error"]["code"] == -32602
