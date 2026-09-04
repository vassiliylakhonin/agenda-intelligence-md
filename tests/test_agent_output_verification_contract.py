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


def test_declared_support_level_scores_nothing_without_evidence():
    """The gate's job is checking that claims are backed.

    Until 2026-09-04 it scored the caller's own declared ``support_level``, so one ``direct``
    claim and an empty evidence array returned ``readiness_score: 100`` / ``review_ready`` —
    full marks for a pack with nothing in it. A declared level is a caller assertion; it
    counts only when the claim cites evidence the caller actually supplied.
    """
    audit = {
        "claims": [{"claim_id": "c1", "claim": "A claim with no evidence behind it.", "support_level": "direct"}],
        "evidence": [],
    }
    result = services.agent_output_verification(audit)
    response = result["response"]
    Draft202012Validator(RESPONSE_SCHEMA).validate(response)
    assert response["verdict"] == "insufficient_information"
    assert response["readiness_score"] == 0
    assert response["readiness_label"] == "insufficient_information"
    assert response["trust_signal"] == "unknown"
    assert response["unsafe_claims"] == []
    assert any("c1" in gap for gap in response["evidence_gaps"])
    assert any("caller assertion" in action for action in response["owner_actions"])


def test_uncorroborated_claim_stays_out_of_the_review_ready_band():
    audit = _grounded_audit()
    audit["claims"].append({"claim_id": "c2", "claim": "Volumes tripled last quarter.", "support_level": "direct"})
    result = services.agent_output_verification(audit)
    response = result["response"]
    Draft202012Validator(RESPONSE_SCHEMA).validate(response)
    assert response["verdict"] == "verify_before_relay"
    assert response["readiness_score"] == 50
    assert response["readiness_label"] == "partial"
    assert response["unsafe_claims"] == []
    assert any("c2" in gap for gap in response["evidence_gaps"])


def test_corroborated_claim_set_still_scores_full_readiness():
    result = services.agent_output_verification(_grounded_audit())
    response = result["response"]
    assert response["readiness_score"] == 100
    assert response["readiness_label"] == "review_ready"


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
