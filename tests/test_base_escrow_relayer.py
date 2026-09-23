"""Unit tests for BaseEscrowRelayer."""

from __future__ import annotations

import pytest

from scripts.base_escrow_relayer import BaseEscrowRelayer, OnChainDisputeEvent


@pytest.fixture
def relayer() -> BaseEscrowRelayer:
    return BaseEscrowRelayer(contract_address="0x1234567890123456789012345678901234567890")


def test_build_dispute_request(relayer: BaseEscrowRelayer) -> None:
    event = OnChainDisputeEvent(
        escrow_id="0x" + "1" * 64,
        raised_by="0xBuyerAddress",
        reason="Missing deliverables",
        buyer="0xBuyerAddress",
        seller="0xSellerAddress",
        amount_usdc_raw=500_000_000,  # 500 USDC
        deadline_ts=1790000000,
        expected_artifact_hash="0xabcd1234",
        actual_artifact_hash="0xef567890",
        policy="pro_rata",
        telemetry={"total_items": 100, "valid_items": 50},
    )

    req = relayer.build_dispute_request(event)
    assert req["escrow_id"] == event.escrow_id
    assert req["dispute_claim"]["claimant"] == "buyer"
    assert req["dispute_claim"]["reason"] == "Missing deliverables"
    assert req["deal_terms"]["amount_usd"] == 500.0
    assert req["deal_terms"]["currency"] == "USDC"
    assert req["specification"]["expected_artifact_sha256"] == "abcd1234"
    assert req["delivery_submission"]["artifact_sha256"] == "ef567890"
    assert req["delivery_submission"]["telemetry"]["valid_items"] == 50


def test_reported_partial_delivery_cannot_prepare_settlement(relayer: BaseEscrowRelayer) -> None:
    event = OnChainDisputeEvent(
        escrow_id="0x" + "2" * 64,
        raised_by="0xBuyerAddress",
        reason="Partial delivery received (75% completion)",
        buyer="0xBuyerAddress",
        seller="0xSellerAddress",
        amount_usdc_raw=1000 * 1_000_000,  # 1,000 USDC
        deadline_ts=1790000000,
        expected_artifact_hash="0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        actual_artifact_hash="0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        policy="pro_rata",
        telemetry={"total_items": 1000, "valid_items": 750},
    )

    with pytest.raises(ValueError, match="human review"):
        relayer.process_dispute(event)


def test_reported_hash_mismatch_cannot_prepare_refund(relayer: BaseEscrowRelayer) -> None:
    event = OnChainDisputeEvent(
        escrow_id="0x" + "3" * 64,
        raised_by="0xBuyerAddress",
        reason="Wrong artifact returned",
        buyer="0xBuyerAddress",
        seller="0xSellerAddress",
        amount_usdc_raw=200 * 1_000_000,  # 200 USDC
        deadline_ts=1790000000,
        expected_artifact_hash="0x1111222233334444",
        actual_artifact_hash="0x9999888877776666",
        policy="all_or_nothing",
        telemetry={"total_items": 10, "valid_items": 0},
    )

    with pytest.raises(ValueError, match="human review"):
        relayer.process_dispute(event)


@pytest.mark.parametrize("state", ["ESCALATE_HUMAN", "UNKNOWN_RULING"])
def test_relayer_never_turns_review_into_partial_payout(relayer, state, monkeypatch):
    from unittest.mock import Mock

    ruling = Mock(ruling=state, status="not_decision_ready", score=0)
    monkeypatch.setattr(relayer.arbiter, "evaluate_dispute", lambda request: ruling)
    monkeypatch.setattr(relayer, "build_dispute_request", lambda event: {})
    event = Mock(escrow_id="hold", raised_by="buyer")
    with pytest.raises(ValueError, match="human review"):
        relayer.process_dispute(event)
