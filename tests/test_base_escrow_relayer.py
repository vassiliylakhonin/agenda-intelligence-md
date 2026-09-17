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


def test_process_dispute_split(relayer: BaseEscrowRelayer) -> None:
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

    res = relayer.process_dispute(event)
    assert res["escrow_id"] == event.escrow_id
    assert res["ruling_enum"] == 2  # SPLIT_PAYOUT
    assert res["seller_payout_usdc"] == 742_500_000
    assert res["buyer_refund_usdc"] == 247_500_000
    assert res["arbiter_fee_usdc"] == 10_000_000
    assert res["seller_payout_usdc"] + res["buyer_refund_usdc"] + res["arbiter_fee_usdc"] == event.amount_usdc_raw


def test_process_dispute_refund_all_or_nothing(relayer: BaseEscrowRelayer) -> None:
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

    res = relayer.process_dispute(event)
    assert res["ruling_enum"] == 1  # REFUND_TO_BUYER
    assert res["seller_payout_usdc"] == 0
    assert res["arbiter_fee_usdc"] == 2_000_000  # 1% of 200 = 2 USDC
    assert res["buyer_refund_usdc"] == 198_000_000
    assert res["seller_payout_usdc"] + res["buyer_refund_usdc"] + res["arbiter_fee_usdc"] == event.amount_usdc_raw
