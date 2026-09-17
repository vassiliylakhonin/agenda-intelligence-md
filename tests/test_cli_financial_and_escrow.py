"""Tests for agenda-intelligence check-tx and arbitrate CLI commands."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from agenda_intelligence.cli import main


def test_cli_check_tx_allowed(capsys):
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
        main()
    captured = capsys.readouterr()
    assert "AgentFinancialGuard [ALLOW]" in captured.out
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
    assert "OFAC SDN" in captured.out


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
        main()
    captured = capsys.readouterr()
    data = json.loads(captured.out)
    assert data["decision"] == "allow"
    assert data["score"] == 10


def test_cli_arbitrate_clean(capsys):
    req_file = Path(__file__).resolve().parents[1] / "examples/m2m-escrow-arbiter/01-clean-ruling.request.json"
    with patch("sys.argv", ["agenda-intelligence", "arbitrate", str(req_file)]):
        main()
    captured = capsys.readouterr()
    assert "M2M Escrow Ruling: [RELEASE_TO_SELLER]" in captured.out
    assert "$247.50" in captured.out
    assert "$2.50" in captured.out


def test_cli_arbitrate_json(capsys):
    req_file = Path(__file__).resolve().parents[1] / "examples/m2m-escrow-arbiter/01-clean-ruling.request.json"
    with patch("sys.argv", ["agenda-intelligence", "arbitrate", str(req_file), "--format", "json"]):
        main()
    captured = capsys.readouterr()
    data = json.loads(captured.out)
    assert data["ruling"] == "RELEASE_TO_SELLER"
    assert data["payout_breakdown"]["seller_payout_usd"] == 247.5
    assert data["payout_breakdown"]["arbiter_fee_usd"] == 2.5
