"""Synthetic review demonstration must stop before settlement."""

from scripts.e2e_base_sepolia_simulation import run_e2e_simulation


def test_e2e_simulation_local() -> None:
    result = run_e2e_simulation(use_remote_edge=False)
    assert result["status"] == "not_decision_ready"
    assert result["settlement_authorized"] is False
    assert result["retained_usdc"] == 1000 * 1_000_000


def test_e2e_simulation_rejects_unexpected_settlement(monkeypatch) -> None:
    import pytest

    from scripts.base_escrow_relayer import BaseEscrowRelayer

    monkeypatch.setattr(BaseEscrowRelayer, "process_dispute", lambda self, event: {})
    with pytest.raises(AssertionError, match="unexpectedly produced"):
        run_e2e_simulation(use_remote_edge=False)
