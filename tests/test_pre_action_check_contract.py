import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator

from agenda_intelligence import a2a_adapter, http_api, services

ROOT = Path(__file__).resolve().parents[1]
REQUEST_SCHEMA = json.loads((ROOT / "schemas" / "v1" / "pre-action-check-request.schema.json").read_text())
RESPONSE_SCHEMA = json.loads((ROOT / "schemas" / "v1" / "pre-action-check-response.schema.json").read_text())
REPLAY_CASES = json.loads((ROOT / "examples" / "pre-action-check" / "replay-cases.json").read_text())


def _request(risk_tier: str = "low") -> dict:
    return {
        "run_id": "run-123",
        "actor": {"id": "procurement-agent", "type": "ai_agent", "operator": "Example buyer"},
        "requested_action": "send supplier recommendation",
        "target": {"id": "supplier-456", "type": "counterparty"},
        "risk_tier": risk_tier,
        "claims": [
            {
                "claim_id": "c1",
                "claim": "The supplier holds the declared registration.",
                "support_level": "direct",
                "evidence_ids": ["e1"],
                "supporting_quotes": [{"evidence_id": "e1", "quote": "Registration active"}],
            }
        ],
        "evidence": [{"evidence_id": "e1", "source_type": "official_document", "name": "Registry extract"}],
    }


def _replay_request(case: dict) -> dict:
    request = copy.deepcopy(REPLAY_CASES["base_request"])
    request["run_id"] = f"replay-{case['name']}"
    if "risk_tier" in case:
        request["risk_tier"] = case["risk_tier"]
    if "support_level" in case:
        request["claims"][0]["support_level"] = case["support_level"]
    if "evidence_ids" in case:
        request["claims"][0]["evidence_ids"] = case["evidence_ids"]
    if case.get("drop_supporting_quotes"):
        request["claims"][0].pop("supporting_quotes", None)
    if "quote_evidence_id" in case:
        request["claims"][0]["supporting_quotes"][0]["evidence_id"] = case["quote_evidence_id"]
    if "unsupported_claims" in case:
        request["unsupported_claims"] = case["unsupported_claims"]
    if "approval_status" in case:
        request["approval"] = {"status": case["approval_status"], "reference": f"approval-{case['name']}"}
    if "policy_profile" in case or "policy_check_status" in case:
        request["policy_context"] = {"profile": case.get("policy_profile", "default")}
        if "policy_check_status" in case:
            request["policy_context"]["checks"] = [
                {
                    "check_id": "delegated-authority",
                    "status": case["policy_check_status"],
                    "evidence_gap": "No principal authorization supplied.",
                }
            ]
    return request


def test_low_risk_grounded_action_can_continue():
    request = _request()
    Draft202012Validator(REQUEST_SCHEMA).validate(request)

    result = services.pre_action_check(request)

    assert result["valid"] is True
    response = result["response"]
    Draft202012Validator(RESPONSE_SCHEMA).validate(response)
    assert response["decision"] == "continue"
    assert response["reason_code"] == "evidence_ready"
    assert response["run_id"] == request["run_id"]
    assert response["approval_required"] is False


def test_evidence_gap_requests_evidence():
    request = _request()
    request["claims"][0]["support_level"] = "weak"

    response = services.pre_action_check(request)["response"]

    assert response["decision"] == "request_evidence"
    assert response["reason_code"] == "evidence_gaps"
    assert response["evidence_requests"]


def test_unsafe_claim_stops_action():
    request = _request()
    request["claims"][0]["support_level"] = "unsupported"

    response = services.pre_action_check(request)["response"]

    assert response["decision"] == "stop"
    assert response["reason_code"] == "unsafe_claims"
    assert response["blocking_gaps"]


def test_high_risk_grounded_action_requires_approval_then_continues():
    request = _request("high")

    first = services.pre_action_check(request)["response"]
    assert first["decision"] == "require_approval"
    assert first["approval_required"] is True
    assert first["human_review_required"] is True

    request["approval"] = {"status": "approved", "reference": "approval-record-1"}
    resumed = services.pre_action_check(request)["response"]
    assert resumed["decision"] == "continue"
    assert resumed["run_id"] == "run-123"


def test_failed_policy_check_stops_action():
    request = _request()
    request["policy_context"] = {
        "profile": "agentic_interaction_trust",
        "checks": [
            {
                "check_id": "delegated-authority",
                "status": "failed",
                "evidence_gap": "No principal authorization supplied.",
            }
        ],
    }

    response = services.pre_action_check(request)["response"]

    assert response["decision"] == "stop"
    assert response["reason_code"] == "policy_check_failed"
    assert "No principal authorization supplied." in response["blocking_gaps"]


def test_invalid_request_reports_contract_failure():
    result = services.pre_action_check({"run_id": "run-without-context"})

    assert result["valid"] is False
    assert result["errors"]
    assert result["response"] is None


def test_http_route_returns_pre_action_decision():
    status, body = http_api.handle_post("/v1/agent-output/pre-action-check", _request())

    assert status == 200
    assert body["decision"] == "continue"


def test_a2a_capability_returns_pre_action_artifact():
    payload = {
        "jsonrpc": "2.0",
        "id": "pre-action-1",
        "method": "message/send",
        "params": {"capability": "pre_action_check", "request": _request()},
    }

    response = a2a_adapter.handle_jsonrpc(payload)

    assert response["result"]["status"]["state"] == "TASK_STATE_COMPLETED"
    assert response["result"]["metadata"]["response"]["decision"] == "continue"


def test_twenty_replay_cases_match_the_contract():
    assert len(REPLAY_CASES["cases"]) == 20
    for case in REPLAY_CASES["cases"]:
        request = _replay_request(case)
        Draft202012Validator(REQUEST_SCHEMA).validate(request)
        result = services.pre_action_check(request)
        assert result["valid"] is True, case["name"]
        response = result["response"]
        Draft202012Validator(RESPONSE_SCHEMA).validate(response)
        assert response["decision"] == case["expected_decision"], case["name"]
        assert response["reason_code"] == case["expected_reason"], case["name"]
