"""Read-only native-USDC history from the official Base mainnet RPC.

The result describes a finalized 24-hour window, never a spending authorization.
An incomplete or malformed RPC response raises EvidenceUnavailable; it is never
converted to a zero-spend observation. No caller-supplied history is accepted.
"""

from __future__ import annotations

import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable

RPC_URL = "https://mainnet.base.org"
USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
ADDRESS = re.compile(r"0x[0-9a-fA-F]{40}\Z")
HASH = re.compile(r"0x[0-9a-fA-F]{64}\Z")
QUANTITY = re.compile(r"0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)\Z")
MAX_RESPONSE_BYTES = 4 * 1024 * 1024


class EvidenceUnavailable(ValueError):
    """Complete evidence for the requested scope could not be collected."""


def quantity(value: Any) -> int:
    if not isinstance(value, str) or not QUANTITY.fullmatch(value):
        raise EvidenceUnavailable("RPC returned an invalid hexadecimal quantity")
    return int(value, 16)


class BaseRPC:
    """Bounded, fixed-origin reader; contains no signing/broadcast operations."""

    def __init__(self) -> None:
        self.calls = 0
        self.started = time.monotonic()

    def __call__(self, method: str, params: list[Any]) -> Any:
        if method not in {"eth_chainId", "eth_getBlockByNumber", "eth_getLogs"}:
            raise EvidenceUnavailable("RPC operation is not read-only history collection")
        self.calls += 1
        remaining = 180 - (time.monotonic() - self.started)
        if self.calls > 128 or remaining <= 0:
            raise EvidenceUnavailable("History collection budget exceeded")
        request = urllib.request.Request(
            RPC_URL,
            data=json.dumps({"jsonrpc": "2.0", "id": self.calls, "method": method, "params": params}).encode(),
            headers={"Content-Type": "application/json", "User-Agent": "agenda-intelligence-base-evidence/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=min(15, remaining)) as response:
                raw = response.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise EvidenceUnavailable("RPC response exceeds the evidence size limit")
            result = json.loads(raw)
        except (OSError, ValueError) as exc:
            raise EvidenceUnavailable("Base RPC evidence request failed") from exc
        if (
            not isinstance(result, dict)
            or result.get("jsonrpc") != "2.0"
            or result.get("id") != self.calls
            or "error" in result
            or "result" not in result
        ):
            raise EvidenceUnavailable("Base RPC returned an invalid or unsuccessful response")
        return result["result"]


def _collect(wallet: str, rpc: Callable[[str, list[Any]], Any]) -> dict[str, Any]:
    if not isinstance(wallet, str) or not ADDRESS.fullmatch(wallet):
        raise EvidenceUnavailable("A 20-byte hexadecimal wallet address is required")
    wallet = wallet.lower()
    if quantity(rpc("eth_chainId", [])) != 8453:
        raise EvidenceUnavailable("RPC is not Base mainnet (chain 8453)")

    def block(tag: str) -> dict[str, Any]:
        value = rpc("eth_getBlockByNumber", [tag, False])
        if not isinstance(value, dict) or not HASH.fullmatch(str(value.get("hash", ""))):
            raise EvidenceUnavailable("RPC returned an incomplete block")
        number = quantity(value.get("number"))
        quantity(value.get("timestamp"))
        if tag.startswith("0x") and number != quantity(tag):
            raise EvidenceUnavailable("RPC returned a different block from the requested one")
        return value

    end = block("finalized")
    end_number = quantity(end["number"])
    end_time = quantity(end["timestamp"])
    cutoff = end_time - 86400
    now = int(time.time())
    if cutoff < 0 or end_time > now + 60 or now - end_time > 3600:
        raise EvidenceUnavailable("Finalized block is stale or has an invalid timestamp")
    lo, hi = max(0, end_number - 100000), end_number
    if quantity(block(hex(lo))["timestamp"]) >= cutoff:
        raise EvidenceUnavailable("Bounded block search cannot cover a full 24-hour window")
    while lo < hi:
        mid = (lo + hi) // 2
        if quantity(block(hex(mid))["timestamp"]) < cutoff:
            lo = mid + 1
        else:
            hi = mid
    first_block = lo
    sender_topic = "0x" + wallet[2:].zfill(64)
    transfers: list[dict[str, Any]] = []
    seen: set[tuple[str, int]] = set()
    chunks = 0
    for first in range(first_block, end_number + 1, 1999):
        last = min(first + 1998, end_number)
        logs = rpc(
            "eth_getLogs",
            [
                {
                    "address": USDC_ADDRESS,
                    "fromBlock": hex(first),
                    "toBlock": hex(last),
                    "topics": [TRANSFER_TOPIC, sender_topic],
                }
            ],
        )
        if not isinstance(logs, list):
            raise EvidenceUnavailable("RPC logs must be a complete array")
        for log in logs:
            if not isinstance(log, dict):
                raise EvidenceUnavailable("Malformed transfer log")
            topics = log.get("topics")
            if (
                log.get("removed") is not False
                or str(log.get("address", "")).lower() != USDC_ADDRESS
                or not isinstance(topics, list)
                or len(topics) != 3
                or any(not isinstance(t, str) or not HASH.fullmatch(t) for t in topics)
                or topics[0].lower() != TRANSFER_TOPIC
                or topics[1].lower() != sender_topic
                or not HASH.fullmatch(str(log.get("data", "")))
                or not HASH.fullmatch(str(log.get("transactionHash", "")))
                or not HASH.fullmatch(str(log.get("blockHash", "")))
            ):
                raise EvidenceUnavailable("Transfer log does not match the requested evidence scope")
            number, index = quantity(log.get("blockNumber")), quantity(log.get("logIndex"))
            key = (log["transactionHash"].lower(), index)
            if not first <= number <= last or key in seen:
                raise EvidenceUnavailable("Duplicate or out-of-range transfer log")
            seen.add(key)
            transfers.append(
                {
                    "transaction_hash": key[0],
                    "log_index": index,
                    "block": number,
                    "amount_base_units": str(int(log["data"], 16)),
                }
            )
        chunks += 1
    if block(hex(end_number))["hash"].lower() != end["hash"].lower():
        raise EvidenceUnavailable("Finalized anchor changed during collection")
    return {
        "schema_version": "1.0",
        "wallet": wallet,
        "chain_id": 8453,
        "source": RPC_URL,
        "token_contract": USDC_ADDRESS,
        "asset": "native USDC",
        "decimals": 6,
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "window_start_timestamp": cutoff,
        "window_end_timestamp": end_time,
        "start_block": first_block,
        "end_block": end_number,
        "end_block_hash": end["hash"],
        "unfinalized_gap_seconds": max(0, now - end_time),
        "successful_chunks": chunks,
        "source_reported_complete_for_scope": True,
        "outgoing_transfers": transfers,
        "total_outgoing_base_units": str(sum(int(t["amount_base_units"]) for t in transfers)),
        "authorization": "not_authorized",
        "limitations": [
            "One official RPC source; completeness relies on that provider, not independent consensus.",
            "Only native USDC Transfer events in the finalized 24-hour window.",
            "Excludes pending/unfinalized transfers, other assets, approvals and offchain activity.",
            "No USD valuation, sanctions clearance, ownership proof or wallet-wide spending authorization.",
        ],
    }


def collect_base_usdc_history(wallet: str) -> dict[str, Any]:
    """Collect scoped ledger evidence, or raise EvidenceUnavailable without a total."""
    return _collect(wallet, BaseRPC())
