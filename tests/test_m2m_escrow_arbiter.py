from agenda_intelligence import ArbitrationRuling, M2MEscrowArbiter, PayoutBreakdown


def test_caller_reported_delivery_requires_review():
    arbiter = M2MEscrowArbiter()
    deal_terms = {
        "buyer_id": "did:agent:0x1111",
        "seller_id": "did:agent:0x2222",
        "amount_usd": 500.0,
        "currency": "USDC",
        "deadline_utc": "2026-09-17T18:00:00Z",
        "arbitration_policy": "all_or_nothing",
        "arbitration_fee_pct": 1.0,
    }
    specification = {
        "deliverable_type": "json_data",
        "expected_artifact_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "min_valid_records_pct": 95.0,
    }
    delivery = {
        "submitted_at": "2026-09-17T12:00:00Z",
        "artifact_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "telemetry": {"total_items": 100, "valid_items": 100},
    }

    ruling = arbiter.evaluate_dispute(
        escrow_id="deal-001",
        deal_terms=deal_terms,
        specification=specification,
        delivery_submission=delivery,
        prefer_remote=False,
    )

    assert isinstance(ruling, ArbitrationRuling)
    assert ruling.is_released_to_seller is False
    assert ruling.is_refunded_to_buyer is False
    assert ruling.ruling == "ESCALATE_HUMAN"
    assert ruling.status == "not_decision_ready"
    assert ruling.score == 0
    assert ruling.checks["deadline_honored"] is True
    assert ruling.checks["hash_verified"] is False
    assert ruling.checks["slo_verified"] is False
    assert len(ruling.violations) == 0

    assert isinstance(ruling.payout, PayoutBreakdown)
    assert ruling.payout.total_escrow_usd == 500.0
    assert ruling.payout.seller_payout_usd == 0.0
    assert ruling.payout.buyer_refund_usd == 0.0
    assert ruling.payout.arbiter_fee_usd == 0.0


def test_unverified_digest_requires_review():
    arbiter = M2MEscrowArbiter()
    deal_terms = {
        "buyer_id": "did:agent:0x1111",
        "seller_id": "did:agent:0x2222",
        "amount_usd": 500.0,
        "currency": "USDC",
        "deadline_utc": "2026-09-17T18:00:00Z",
        "arbitration_policy": "all_or_nothing",
        "arbitration_fee_pct": 1.0,
    }
    specification = {
        "deliverable_type": "json_data",
        "expected_artifact_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    }
    delivery = {
        "submitted_at": "2026-09-17T12:00:00Z",
        "artifact_sha256": "deadbeef00000000000000000000000000000000000000000000000000000000",
    }

    ruling = arbiter.evaluate_dispute(
        escrow_id="deal-002",
        deal_terms=deal_terms,
        specification=specification,
        delivery_submission=delivery,
        prefer_remote=False,
    )

    assert ruling.is_released_to_seller is False
    assert ruling.is_refunded_to_buyer is False
    assert ruling.ruling == "ESCALATE_HUMAN"
    assert ruling.checks["hash_verified"] is False
    assert ruling.payout.seller_payout_usd == 0.0
    assert ruling.payout.buyer_refund_usd == 0.0
    assert ruling.payout.arbiter_fee_usd == 0.0


def test_deadline_breach_refund():
    arbiter = M2MEscrowArbiter()
    deal_terms = {
        "buyer_id": "did:agent:0x1111",
        "seller_id": "did:agent:0x2222",
        "amount_usd": 500.0,
        "currency": "USDC",
        "deadline_utc": "2026-09-17T12:00:00Z",
        "arbitration_policy": "all_or_nothing",
    }
    specification = {"deliverable_type": "json_data"}
    delivery = {"submitted_at": "2026-09-17T16:00:00Z"}  # 4 hours late

    ruling = arbiter.evaluate_dispute(
        escrow_id="deal-003",
        deal_terms=deal_terms,
        specification=specification,
        delivery_submission=delivery,
        prefer_remote=False,
    )

    assert ruling.is_refunded_to_buyer is False
    assert ruling.checks["deadline_honored"] is False
    assert any("Deadline breach" in v for v in ruling.violations)


def test_pro_rata_partial_settlement():
    arbiter = M2MEscrowArbiter()
    deal_terms = {
        "buyer_id": "did:agent:0x1111",
        "seller_id": "did:agent:0x2222",
        "amount_usd": 1000.0,
        "currency": "USDC",
        "deadline_utc": "2026-09-17T18:00:00Z",
        "arbitration_policy": "pro_rata",
        "arbitration_fee_pct": 1.0,
    }
    specification = {
        "deliverable_type": "json_data",
        "min_valid_records_pct": 90.0,
    }
    delivery = {
        "submitted_at": "2026-09-17T12:00:00Z",
        "telemetry": {"total_items": 1000, "valid_items": 800},
    }

    ruling = arbiter.evaluate_dispute(
        escrow_id="deal-004",
        deal_terms=deal_terms,
        specification=specification,
        delivery_submission=delivery,
        prefer_remote=False,
    )

    assert ruling.is_partial_settlement is False
    assert ruling.score == 0
    assert ruling.checks["slo_verified"] is False
    assert ruling.payout.seller_payout_usd == 0.0
    assert ruling.payout.buyer_refund_usd == 0.0
    assert ruling.payout.arbiter_fee_usd == 0.0


def test_all_or_nothing_slo_deficit_refund():
    arbiter = M2MEscrowArbiter()
    deal_terms = {
        "buyer_id": "did:agent:0x1111",
        "seller_id": "did:agent:0x2222",
        "amount_usd": 1000.0,
        "currency": "USDC",
        "deadline_utc": "2026-09-17T18:00:00Z",
        "arbitration_policy": "all_or_nothing",
        "arbitration_fee_pct": 1.0,
    }
    specification = {
        "deliverable_type": "json_data",
        "min_valid_records_pct": 90.0,
    }
    delivery = {
        "submitted_at": "2026-09-17T12:00:00Z",
        "telemetry": {"total_items": 1000, "valid_items": 800},
    }

    ruling = arbiter.evaluate_dispute(
        escrow_id="deal-005",
        deal_terms=deal_terms,
        specification=specification,
        delivery_submission=delivery,
        prefer_remote=False,
    )

    assert ruling.is_refunded_to_buyer is False
    assert ruling.payout.seller_payout_usd == 0.0
    assert ruling.payout.buyer_refund_usd == 0.0
    assert ruling.payout.arbiter_fee_usd == 0.0


def test_artifact_content_is_hashed_even_when_empty():
    import hashlib

    payload = {
        "escrow_id": "content-check",
        "deal_terms": {"amount_usd": 500},
        "specification": {
            "expected_artifact_sha256": hashlib.sha256(b"").hexdigest(),
            "expected_schema": {"type": "string"},
        },
        "delivery_submission": {"artifact_data": ""},
    }
    arbiter = M2MEscrowArbiter()
    result = arbiter.evaluate_dispute(payload, prefer_remote=False)
    assert result.checks["hash_verified"] is True
    assert result.checks["schema_verified"] is True
    assert result.ruling == "ESCALATE_HUMAN"
    payload["delivery_submission"]["artifact_data"] = "modified"
    payload["delivery_submission"]["artifact_sha256"] = payload["specification"]["expected_artifact_sha256"]
    result = arbiter.evaluate_dispute(payload, prefer_remote=False)
    assert result.checks["hash_verified"] is False
    assert result.payout.seller_payout_usd == 0


def test_remote_cannot_bypass_local_evidence_hold(monkeypatch):
    arbiter = M2MEscrowArbiter()

    def unexpected_remote(payload):
        raise AssertionError("Unverified evidence must not reach remote settlement evaluation")

    monkeypatch.setattr(arbiter, "_evaluate_remote", unexpected_remote)
    ruling = arbiter.evaluate_dispute({"escrow_id": "legacy-remote", "deal_terms": {"amount_usd": 500}})
    assert ruling.ruling == "ESCALATE_HUMAN"
    assert ruling.payout.seller_payout_usd == 0
