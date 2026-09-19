"""Trust-boundary regressions shared with the hosted Worker."""

import json
import re
from pathlib import Path
from unittest.mock import patch

import pytest

from agenda_intelligence import AgentFinancialGuard, M2MEscrowArbiter
from agenda_intelligence.escrow_schema import validate_escrow_artifact
from scripts.run_fleet_health_check import WORKERS

ROOT = Path(__file__).resolve().parents[1]
CASES = json.loads((ROOT / "tests/fixtures/escrow-schema-cases.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["name"])
def test_schema_contract(case):
    status, _ = validate_escrow_artifact(case["schema"], case["artifact"], not case["missing"])
    assert status == case["status"]


def escrow_request():
    return {
        "escrow_id": "regression",
        "deal_terms": {
            "buyer_id": "buyer",
            "seller_id": "seller",
            "amount_usd": 100,
            "currency": "USDC",
            "deadline_utc": "2026-10-01T00:00:00Z",
            "arbitration_policy": "all_or_nothing",
        },
        "specification": {"deliverable_type": "json_data", "expected_schema": {"type": "object", "required": ["name"]}},
        "delivery_submission": {"submitted_at": "2026-09-19T00:00:00Z", "artifact_data": {}},
    }


def test_legacy_remote_cannot_bypass_schema_validation():
    arbiter = M2MEscrowArbiter()
    with patch.object(arbiter, "_evaluate_remote", side_effect=AssertionError("Must validate before remote")):
        result = arbiter.evaluate_dispute(escrow_request())
    assert result.checks["schema_verified"] is False
    assert not result.is_released_to_seller


def test_hash_only_schema_check_requires_review():
    request = escrow_request()
    request["delivery_submission"].pop("artifact_data")
    request["delivery_submission"]["artifact_sha256"] = "a" * 64
    result = M2MEscrowArbiter().evaluate_dispute(request, prefer_remote=False)
    assert result.ruling == "ESCALATE_HUMAN"
    assert result.status == "not_decision_ready"
    assert result.payout.seller_payout_usd == result.payout.buyer_refund_usd == result.payout.arbiter_fee_usd == 0


def test_legacy_remote_allow_cannot_authorize_wallet():
    from io import BytesIO

    with patch(
        "urllib.request.urlopen",
        return_value=BytesIO(
            json.dumps(
                {"financial_guard_verdict": {"decision": "allow", "status": "decision_ready", "score": 10}}
            ).encode()
        ),
    ):
        result = AgentFinancialGuard().check_transaction("0x1111", 1)
    assert not result.is_allowed
    assert result.requires_human_approval


def test_fleet_covers_every_configured_worker():
    names = set(
        re.findall(
            r'^name\s*=\s*"([^"\n]+)"', (ROOT / "deploy/cloudflare-worker/wrangler.toml").read_text(), re.MULTILINE
        )
    )
    assert {w["name"] for w in WORKERS} == names | {"vizier"}
    assert len({w["id"] for w in WORKERS}) == len(WORKERS)
    for worker in WORKERS:
        assert (ROOT / "scripts/fleet_health" / worker["script"]).is_file()


@pytest.mark.parametrize("envelope", [True, False])
def test_legacy_remote_receipts_are_not_attestations(envelope):
    from io import BytesIO

    financial = {
        "decision": "step_up_human_required",
        "status": "not_decision_ready",
        "score": 55,
        "vizier_status": "vizier_verified",
        "vizier_clearance_receipt": "jws_vizier_123",
    }
    escrow = {
        "ruling": "RELEASE_TO_SELLER",
        "status": "decision_ready",
        "score": 95,
        "vizier_status": "vizier_verified",
        "vizier_clearance_receipt": "jws_m2m_arbiter_123",
    }
    for field, verdict in [("financial_guard_verdict", financial), ("arbitration_ruling", escrow)]:
        body = (
            {field: verdict, "vizier_status": "vizier_verified", "vizier_clearance_receipt": "fake"}
            if envelope
            else verdict
        )
        with patch("urllib.request.urlopen", return_value=BytesIO(json.dumps(body).encode())):
            if field == "financial_guard_verdict":
                result = AgentFinancialGuard(local_fallback=False).check_transaction("0x1111", 1)
            else:
                request = escrow_request()
                request["specification"].pop("expected_schema")
                result = M2MEscrowArbiter(local_fallback=False).evaluate_dispute(request)
        assert result.vizier_status == "attestation_unavailable"
        assert "vizier_verified" not in json.dumps(result.raw)
        assert "jws_" not in json.dumps(result.raw)
        assert result.raw["vizier_clearance_receipt"] is None
