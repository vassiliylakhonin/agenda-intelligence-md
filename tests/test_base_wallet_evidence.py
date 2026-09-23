"""Scope, failure and numeric-integrity tests for read-only Base evidence."""

import time
from io import BytesIO
from unittest.mock import patch

import pytest

from agenda_intelligence.base_wallet_evidence import (
    TRANSFER_TOPIC,
    USDC_ADDRESS,
    BaseRPC,
    EvidenceUnavailable,
    _collect,
)

WALLET = "0x" + "11" * 20
NOW = int(time.time())
END = 200000
END_TIME = NOW - 900


def fake_rpc(logs=None, chain="0x2105", changed_anchor=False):
    calls = []

    def rpc(method, params):
        calls.append((method, params))
        if method == "eth_chainId":
            return chain
        if method == "eth_getBlockByNumber":
            n = END if params[0] == "finalized" else int(params[0], 16)
            h = "b" if changed_anchor and params[0] == hex(END) else "a"
            return {"number": hex(n), "timestamp": hex(END_TIME - 2 * (END - n)), "hash": "0x" + h * 64}
        if method == "eth_getLogs":
            if logs is not None and len([m for m, _ in calls if m == method]) == 1:
                return logs
            return []
        raise AssertionError(method)

    return rpc, calls


def transfer(**updates):
    data = {
        "removed": False,
        "address": USDC_ADDRESS,
        "topics": [TRANSFER_TOPIC, "0x" + WALLET[2:].zfill(64), "0x" + "22" * 32],
        "data": "0x" + format(9007199254740993, "064x"),
        "transactionHash": "0x" + "c" * 64,
        "blockHash": "0x" + "d" * 64,
        "blockNumber": hex(END - 43200),
        "logIndex": "0x0",
    }
    return {**data, **updates}


def test_empty_complete_history_has_explicit_scope_and_no_authorization():
    rpc, calls = fake_rpc()
    result = _collect(WALLET, rpc)
    assert result["total_outgoing_base_units"] == "0"
    assert result["start_block"] == END - 43200
    assert result["successful_chunks"] == 44
    assert result["authorization"] == "not_authorized"
    assert result["unfinalized_gap_seconds"] >= 900
    ranges = [p[0] for m, p in calls if m == "eth_getLogs"]
    assert all(int(b["fromBlock"], 16) == int(a["toBlock"], 16) + 1 for a, b in zip(ranges, ranges[1:]))
    assert all(1 <= int(part["toBlock"], 16) - int(part["fromBlock"], 16) + 1 <= 1000 for part in ranges)


def test_amounts_are_exact_base_units_not_floats_or_usd():
    rpc, _ = fake_rpc([transfer()])
    assert _collect(WALLET, rpc)["total_outgoing_base_units"] == "9007199254740993"


@pytest.mark.parametrize(
    "updates",
    [
        {"removed": True},
        {"address": WALLET},
        {"blockNumber": hex(END)},
        {"topics": []},
        {"data": "0x01"},
        {"transactionHash": "oops"},
    ],
)
def test_malformed_or_out_of_scope_logs_fail_without_a_total(updates):
    rpc, _ = fake_rpc([transfer(**updates)])
    with pytest.raises(EvidenceUnavailable):
        _collect(WALLET, rpc)


def test_duplicate_logs_fail_instead_of_double_counting():
    rpc, _ = fake_rpc([transfer(), transfer()])
    with pytest.raises(EvidenceUnavailable):
        _collect(WALLET, rpc)


@pytest.mark.parametrize("options", [{"chain": "0x1"}, {"changed_anchor": True}, {"logs": {"partial": True}}])
def test_wrong_chain_changed_anchor_and_incomplete_response_fail(options):
    rpc, _ = fake_rpc(**options)
    with pytest.raises(EvidenceUnavailable):
        _collect(WALLET, rpc)


def test_rpc_failure_after_successful_chunk_never_becomes_zero_history():
    rpc, calls = fake_rpc()

    def failing(method, params):
        if method == "eth_getLogs" and any(m == method for m, _ in calls):
            raise EvidenceUnavailable("upstream timeout")
        return rpc(method, params)

    with pytest.raises(EvidenceUnavailable):
        _collect(WALLET, failing)


def test_invalid_address_makes_no_rpc_calls():
    rpc, calls = fake_rpc()
    with pytest.raises(EvidenceUnavailable):
        _collect("https://untrusted.example", rpc)
    assert not calls


def test_stale_finalized_anchor_is_rejected():
    rpc, _ = fake_rpc()
    with patch("agenda_intelligence.base_wallet_evidence.time.time", return_value=NOW + 7200):
        with pytest.raises(EvidenceUnavailable):
            _collect(WALLET, rpc)


def test_transport_rejects_rpc_errors_and_write_methods():
    with patch("urllib.request.urlopen", return_value=BytesIO(b'{"jsonrpc":"2.0","id":1,"error":{"code":-1}}')):
        with pytest.raises(EvidenceUnavailable):
            BaseRPC()("eth_chainId", [])
    with pytest.raises(EvidenceUnavailable):
        BaseRPC()("eth_sendRawTransaction", [])
