"""Tests for agenda-intelligence check-tx and arbitrate CLI commands."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from agenda_intelligence.cli import main


def test_cli_check_tx_review(capsys):
    with patch(
        "sys.argv",
        [
            "agenda-intelligence",
            "check-tx",
            "--recipient",
            "0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663",
            "--amount",
            "25",
        ],
    ):
        with pytest.raises(SystemExit) as exc_info:
            main()
        assert exc_info.value.code == 1
    captured = capsys.readouterr()
    assert "AgentFinancialGuard [REVIEW]" in captured.out
    assert "0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663" in captured.out


def test_cli_check_tx_blocked(capsys):
    with patch(
        "sys.argv",
        [
            "agenda-intelligence",
            "check-tx",
            "--recipient",
            "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
            "--amount",
            "10",
        ],
    ):
        with pytest.raises(SystemExit) as exc_info:
            main()
        assert exc_info.value.code == 2
    captured = capsys.readouterr()
    assert "AgentFinancialGuard [REJECT]" in captured.out
    assert "local risk denylist" in captured.out


def test_cli_check_tx_json(capsys):
    with patch(
        "sys.argv",
        [
            "agenda-intelligence",
            "check-tx",
            "--recipient",
            "0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663",
            "--amount",
            "25",
            "--format",
            "json",
        ],
    ):
        with pytest.raises(SystemExit) as exc_info:
            main()
        assert exc_info.value.code == 1
    captured = capsys.readouterr()
    data = json.loads(captured.out)
    assert data["decision"] == "step_up_human_required"
    assert data["score"] == 55


def test_cli_arbitrate_clean(capsys):
    req_file = Path(__file__).resolve().parents[1] / "examples/m2m-escrow-arbiter/01-clean-ruling.request.json"
    with patch("sys.argv", ["agenda-intelligence", "arbitrate", str(req_file)]):
        main()
    captured = capsys.readouterr()
    assert "M2M Escrow Ruling: [ESCALATE_HUMAN]" in captured.out
    assert "$0.00" in captured.out
    assert "$0.00" in captured.out


def test_cli_arbitrate_json(capsys):
    req_file = Path(__file__).resolve().parents[1] / "examples/m2m-escrow-arbiter/01-clean-ruling.request.json"
    with patch("sys.argv", ["agenda-intelligence", "arbitrate", str(req_file), "--format", "json"]):
        main()
    captured = capsys.readouterr()
    data = json.loads(captured.out)
    assert data["ruling"] == "ESCALATE_HUMAN"
    assert data["payout_breakdown"]["seller_payout_usd"] == 0.0
    assert data["payout_breakdown"]["arbiter_fee_usd"] == 0.0
