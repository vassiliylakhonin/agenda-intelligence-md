"""Guarded dispatch contract: actual request, policy, approval and atomic replay."""

import copy
import hashlib
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import pytest

from agenda_intelligence.action_gate import (
    ActionGateError,
    GuardedActionExecutor,
    ReplayStore,
    check_action_binding,
)
from agenda_intelligence.human_review import canonical_bytes, request_hash

CONTEXT = {"principal": "owner", "agent": "agent", "tenant": "tenant-a"}


def request():
    return {
        "principal": {"id": "owner"},
        "agent": {"id": "agent", "owner": "owner"},
        "action": {
            "type": "send_report",
            "target": "report:42",
            "parameters": {"tenant": "tenant-a", "amount": 10, "currency": "USD"},
        },
        "authority": {
            "allowed_actions": ["send_report"],
            "constraints": {"allowed_targets": ["report:42"], "max_amount": 10, "currency": "USD"},
        },
        "context": {"request_id": "req-1", "timestamp": None, "source": "rest"},
        "grant": "fixture.jws.only",
    }


def policy(req):
    return {
        "decision": "ALLOW",
        "risk_score": 0,
        "reason_codes": [],
        "policy_results": [{"rule_id": "scope", "result": "PASS", "reason_code": None}],
        "receipt": {
            "id": "receipt-1",
            "request_hash": hashlib.sha256(canonical_bytes(req)).hexdigest(),
            "decision": "ALLOW",
            "risk_score": 0,
            "reason_codes": [],
            "policy_rule_ids": ["scope"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "authority_provenance": "principal_signed",
            "grant": {
                "issuer": "owner",
                "subject": "agent",
                "jti": "grant-1",
                "expires_at": datetime.fromtimestamp(time.time() + 300, timezone.utc).isoformat(),
            },
        },
    }


class SandboxReviews:
    """Not a real approval issuer; production uses HumanReviewClient."""

    def verify(self, review, review_id, token):
        assert token == "sandbox-only"

    def claim(self, review, review_id, token):
        return {"status": "CONSUMED", "request_hash": request_hash(review), "action": copy.deepcopy(review["action"])}


def approval(req):
    return {
        "request": {
            "audience": "test-executor",
            "action": copy.deepcopy(req),
            "evidence": {},
            "escalation_reason": "sandbox regression",
            "expires_in_seconds": 300,
        },
        "review_id": "sandbox-review",
        "token": "sandbox-only",
    }


def test_golden_guarded_dispatch_and_durable_replay(tmp_path):
    req = request()
    seen = []
    path = tmp_path / "replay.sqlite"
    gate = GuardedActionExecutor(policy, SandboxReviews(), ReplayStore(path), CONTEXT, "test-executor")
    result = gate.execute(req, approval(req), lambda frozen: seen.append(frozen) or "sandbox-dispatched")
    assert result["execution"] == "dispatched" and result["human_review_consumed"]
    assert seen == [req]
    gate = GuardedActionExecutor(policy, SandboxReviews(), ReplayStore(path), CONTEXT, "test-executor")
    with pytest.raises(ActionGateError, match="delegation_replayed"):
        gate.execute(req, approval(req), lambda _: pytest.fail("replay dispatched"))


@pytest.mark.parametrize(
    "field,value,code",
    [
        ("tenant", "tenant-b", "tenant_mismatch"),
        ("amount", 11, "amount_out_of_scope"),
        ("amount", True, "amount_invalid"),
        ("currency", "EUR", "currency_mismatch"),
    ],
)
def test_changed_parameters_cannot_borrow_scope(field, value, code):
    req = request()
    req["action"]["parameters"][field] = value
    with pytest.raises(ActionGateError, match=code):
        check_action_binding(req, policy(req), CONTEXT)


def test_receipt_for_a_different_request_is_refused():
    req = request()
    receipt = policy(req)
    req["action"]["parameters"]["note"] = "changed"
    with pytest.raises(ActionGateError, match="receipt_binding_mismatch"):
        check_action_binding(req, receipt, CONTEXT)


@pytest.mark.parametrize("change", ["unsigned", "review", "expired", "stale", "wrong-agent"])
def test_unverified_policy_paths_stop_before_dispatch(tmp_path, change):
    req = request()
    p = policy(req)
    if change == "unsigned":
        p["receipt"]["authority_provenance"] = "caller_asserted"
    elif change == "review":
        p["decision"] = "REVIEW"
    elif change == "expired":
        p["receipt"]["grant"]["expires_at"] = "2020-01-01T00:00:00Z"
    elif change == "stale":
        p["receipt"]["created_at"] = "2020-01-01T00:00:00Z"
    else:
        p["receipt"]["grant"]["subject"] = "other-agent"
    gate = GuardedActionExecutor(
        lambda _: p, SandboxReviews(), ReplayStore(tmp_path / "replay.sqlite"), CONTEXT, "test-executor"
    )
    with pytest.raises(ActionGateError):
        gate.execute(req, approval(req), lambda _: pytest.fail("invalid policy dispatched"))


def test_approval_cannot_be_reused_for_changed_request(tmp_path):
    req = request()
    approved = approval(req)
    req["action"]["parameters"]["note"] = "different body"
    gate = GuardedActionExecutor(
        policy, SandboxReviews(), ReplayStore(tmp_path / "replay.sqlite"), CONTEXT, "test-executor"
    )
    with pytest.raises(ActionGateError, match="human_approval_request_mismatch"):
        gate.execute(req, approved, lambda _: pytest.fail("changed request dispatched"))


def test_replay_reservation_is_atomic_across_connections(tmp_path):
    path = tmp_path / "replay.sqlite"
    ReplayStore(path)

    def reserve(_):
        try:
            ReplayStore(path).reserve("owner", "same-grant")
            return True
        except ActionGateError:
            return False

    with ThreadPoolExecutor(max_workers=4) as pool:
        assert sum(pool.map(reserve, range(8))) == 1


def test_downstream_failure_does_not_reopen_consumed_grant(tmp_path):
    req = request()
    gate = GuardedActionExecutor(
        policy, SandboxReviews(), ReplayStore(tmp_path / "replay.sqlite"), CONTEXT, "test-executor"
    )
    with pytest.raises(RuntimeError):
        gate.execute(req, approval(req), lambda _: (_ for _ in ()).throw(RuntimeError("sandbox failure")))
    with pytest.raises(ActionGateError, match="delegation_replayed"):
        gate.execute(req, approval(req), lambda _: pytest.fail("retry dispatched"))
