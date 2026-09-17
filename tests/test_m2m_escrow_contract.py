"""Tests for M2MEscrow smart contract architecture, hashing, and settlement verification."""

import os


def test_m2m_escrow_solidity_contract_exists():
    contract_path = os.path.join(os.path.dirname(__file__), "..", "contracts", "M2MEscrow.sol")
    assert os.path.exists(contract_path), "M2MEscrow.sol must exist in contracts/"

    with open(contract_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Verify key interfaces and functions exist in the Solidity contract
    assert "pragma solidity ^0.8.20;" in content
    assert "contract M2MEscrow" in content
    assert "function createEscrow" in content
    assert "function submitDelivery" in content
    assert "function releaseClean" in content
    assert "function claimExpiredRefund" in content
    assert "function raiseDispute" in content
    assert "function settleDisputeWithArbiterRuling" in content
    assert "event EscrowCreated" in content
    assert "event DeliverySubmitted" in content
    assert "event EscrowSettled" in content
    assert "recoverSigner" in content


def test_m2m_escrow_ruling_payout_conservation():
    """Verify that every ruling preserves the invariant: seller_payout + buyer_refund + arbiter_fee == total."""
    from agenda_intelligence.m2m_escrow_arbiter import M2MEscrowArbiter

    arbiter = M2MEscrowArbiter()

    # 1. Clean release
    ruling_clean = arbiter.evaluate_dispute(
        {
            "escrow_id": "deal-test-01",
            "deal_terms": {
                "buyer_id": "0x1111111111111111111111111111111111111111",
                "seller_id": "0x2222222222222222222222222222222222222222",
                "amount_usd": 1000.0,
                "currency": "USDC",
                "deadline_utc": "2026-10-01T00:00:00Z",
                "arbitration_policy": "pro_rata",
                "arbitration_fee_pct": 1.0,
            },
            "specification": {
                "deliverable_type": "json_data",
                "expected_artifact_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            },
            "delivery_submission": {
                "submitted_at": "2026-09-20T00:00:00Z",
                "artifact_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            },
        }
    )
    pb = ruling_clean.payout_breakdown
    assert pb.seller_payout_usd + pb.buyer_refund_usd + pb.arbiter_fee_usd == pb.total_escrow_usd
    assert pb.seller_payout_usd == 990.0
    assert pb.arbiter_fee_usd == 10.0

    # 2. Pro-rata split
    ruling_pr = arbiter.evaluate_dispute(
        {
            "escrow_id": "deal-test-02",
            "deal_terms": {
                "buyer_id": "0x1111111111111111111111111111111111111111",
                "seller_id": "0x2222222222222222222222222222222222222222",
                "amount_usd": 500.0,
                "currency": "USDC",
                "deadline_utc": "2026-10-01T00:00:00Z",
                "arbitration_policy": "pro_rata",
                "arbitration_fee_pct": 1.0,
            },
            "specification": {
                "deliverable_type": "json_data",
                "min_valid_records_pct": 90.0,
            },
            "delivery_submission": {
                "submitted_at": "2026-09-20T00:00:00Z",
                "telemetry": {
                    "total_items": 1000,
                    "valid_items": 750,
                },
            },
        }
    )
    pb2 = ruling_pr.payout_breakdown
    assert pb2.seller_payout_usd + pb2.buyer_refund_usd + pb2.arbiter_fee_usd == pb2.total_escrow_usd
    assert pb2.arbiter_fee_usd == 5.0
    assert pb2.seller_payout_usd == 371.25
    assert pb2.buyer_refund_usd == 123.75
