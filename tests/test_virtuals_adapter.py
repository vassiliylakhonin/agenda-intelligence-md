"""Unit tests for Virtuals Protocol GAME SDK adapter."""

from __future__ import annotations

import pytest

from integrations.virtuals.agenda_virtuals_adapter import AgendaVirtualsAdapter


@pytest.fixture
def adapter() -> AgendaVirtualsAdapter:
    return AgendaVirtualsAdapter(prefer_remote=False)


def test_game_function_specs(adapter: AgendaVirtualsAdapter) -> None:
    specs = adapter.get_game_function_specs()
    assert len(specs) == 2
    names = [s["name"] for s in specs]
    assert "check_transaction_safety" in names
    assert "arbitrate_escrow_dispute" in names


def test_virtuals_transaction_check(adapter: AgendaVirtualsAdapter) -> None:
    res = adapter.execute_transaction_check(
        recipient="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amount_usd=50.0,
        intent="Payment to vendor",
    )
    assert res["decision"] == "allow"
    assert res["is_safe"] is True
    assert res["risk_score"] == 10

    # Tornado cash check
    res_blocked = adapter.execute_transaction_check(
        recipient="0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
        amount_usd=50.0,
        intent="Anonymize funds",
    )
    assert res_blocked["decision"] == "reject"
    assert res_blocked["is_safe"] is False
    assert res_blocked["risk_score"] == 95


def test_virtuals_arbitration(adapter: AgendaVirtualsAdapter) -> None:
    res = adapter.execute_arbitration(
        escrow_id="0x" + "5" * 64,
        amount_usd=1000.0,
        valid_items=800,
        total_items=1000,
        policy="pro_rata",
    )
    assert res["ruling"] == "PARTIAL_SETTLEMENT"
    assert res["score"] == 80
    assert res["payout"]["seller_usd"] == 792.0
    assert res["payout"]["buyer_usd"] == 198.0
    assert res["payout"]["fee_usd"] == 10.0
