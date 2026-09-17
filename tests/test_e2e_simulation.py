"""Unit and integration test for Base Sepolia E2E simulation."""

from __future__ import annotations

from scripts.e2e_base_sepolia_simulation import run_e2e_simulation


def test_e2e_simulation_local() -> None:
    result = run_e2e_simulation(use_remote_edge=False)
    assert result["ruling_enum"] == 2  # PARTIAL_SETTLEMENT
    assert result["seller_payout_usdc"] == 792_000_000
    assert result["buyer_refund_usdc"] == 198_000_000
    assert result["arbiter_fee_usdc"] == 10_000_000
    assert result["seller_payout_usdc"] + result["buyer_refund_usdc"] + result["arbiter_fee_usdc"] == 1000 * 1_000_000


def test_e2e_simulation_remote() -> None:
    result = run_e2e_simulation(use_remote_edge=True)
    assert result["ruling_enum"] == 2
    assert result["seller_payout_usdc"] == 792_000_000
    assert result["buyer_refund_usdc"] == 198_000_000
    assert result["arbiter_fee_usdc"] == 10_000_000
