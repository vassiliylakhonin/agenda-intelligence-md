"""Unit tests for Coinbase AgentKit Action Provider."""

from __future__ import annotations

import json

import pytest

from integrations.coinbase_agentkit.agenda_guard_action_provider import (
    AgendaFinancialGuardActionProvider,
)


@pytest.fixture
def provider() -> AgendaFinancialGuardActionProvider:
    return AgendaFinancialGuardActionProvider(prefer_remote=False)


def test_action_provider_clean_transaction(provider: AgendaFinancialGuardActionProvider) -> None:
    res_raw = provider.check_transaction_safety(
        recipient="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amount_usd=25.0,
        network="base",
        asset="USDC",
        intent="Payment for data service",
    )
    res = json.loads(res_raw)
    assert res["decision"] == "allow"
    assert res["is_safe"] is True
    assert res["risk_score"] == 10
    assert len(res["violations"]) == 0


def test_action_provider_blocked_tornado_cash(provider: AgendaFinancialGuardActionProvider) -> None:
    tornado_router = "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b"
    res_raw = provider.check_transaction_safety(
        recipient=tornado_router,
        amount_usd=50.0,
        intent="Anonymous transfer",
    )
    res = json.loads(res_raw)
    assert res["decision"] == "reject"
    assert res["is_safe"] is False
    assert res["risk_score"] == 95
    assert any("OFAC SDN" in v or "sanctions blacklist" in v for v in res["violations"])


def test_action_provider_wrap_wallet_provider_blocking(
    provider: AgendaFinancialGuardActionProvider,
) -> None:
    mock_called = False

    def mock_send_transaction(to: str, value_usd: float = 0.0, **kwargs: object) -> str:
        nonlocal mock_called
        mock_called = True
        return "0xtxhash123"

    guarded_send = provider.wrap_wallet_provider(mock_send_transaction)

    # 1. Clean transaction should succeed and execute
    tx_hash = guarded_send(to="0xCleanRecipientAddress", value_usd=20.0)
    assert tx_hash == "0xtxhash123"
    assert mock_called is True

    # 2. Blocked transaction should raise PermissionError and NEVER call send_transaction
    mock_called = False
    tornado_router = "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b"
    with pytest.raises(PermissionError) as exc_info:
        guarded_send(to=tornado_router, value_usd=50.0)

    assert "AgendaFinancialGuard BLOCKED" in str(exc_info.value)
    assert mock_called is False
