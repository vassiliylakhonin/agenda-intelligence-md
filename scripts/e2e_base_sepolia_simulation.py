#!/usr/bin/env python3
"""Synthetic escrow review demonstration; no chain transactions are sent.

The fixture contains caller-reported telemetry and digests, not authenticated
artifact delivery. The evaluator must hold it for human review; the relayer
must not prepare settlement calldata.
"""

from __future__ import annotations

import logging
import sys
import time
from pathlib import Path
from typing import Any

# Ensure src is importable and script dir does not shadow agenda_intelligence package
_repo_root = Path(__file__).resolve().parents[1]
_src_path = _repo_root / "src"
for _p in (_repo_root, _src_path):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))
_script_dir = Path(__file__).resolve().parent
if str(_script_dir) in sys.path:
    sys.path.remove(str(_script_dir))

from scripts.base_escrow_relayer import (  # noqa: E402
    BaseEscrowRelayer,
    OnChainDisputeEvent,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("BaseSepoliaE2E")

LIVE_EDGE_ENDPOINT = "https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev/v1/m2m-escrow/evaluate-dispute"
BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"


def run_e2e_simulation(use_remote_edge: bool = False) -> dict[str, Any]:
    logger.info("=== Synthetic escrow evidence-review simulation; no on-chain execution ===")

    # Step 1: Agent Deal Initialization
    buyer_agent = "0x" + "1" * 40
    seller_agent = "0x" + "2" * 40
    escrow_id = "0x" + "c0ffee" * 10 + "1122"
    deal_amount_usdc = 1000 * 1_000_000  # 1,000 USDC (6 decimals)
    expected_artifact_hash = "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"

    logger.info(f"[Step 1] Buyer Agent ({buyer_agent[:10]}...) is represented in a synthetic 1,000 USDC fixture")
    logger.info(f"         Contract: M2MEscrow, Settlement Token: {BASE_SEPOLIA_USDC}")

    # Step 2: Seller Delivers Partial Dataset (800 of 1000 valid items)
    actual_artifact_hash = expected_artifact_hash  # Hash matches, but content incomplete
    delivered_items = 800
    total_items = 1000
    logger.info(
        f"[Step 2] Seller Agent ({seller_agent[:10]}...) submits delivery: {delivered_items}/{total_items} items"
    )

    # Step 3: Buyer Flags Partial Delivery Dispute
    dispute_event = OnChainDisputeEvent(
        escrow_id=escrow_id,
        raised_by=buyer_agent,
        reason=f"Partial delivery received: {delivered_items}/{total_items} rows valid",
        buyer=buyer_agent,
        seller=seller_agent,
        amount_usdc_raw=deal_amount_usdc,
        deadline_ts=int(time.time()) + 86400,
        expected_artifact_hash=expected_artifact_hash,
        actual_artifact_hash=actual_artifact_hash,
        policy="pro_rata",
        telemetry={"total_items": total_items, "valid_items": delivered_items},
    )
    logger.info(f"[Step 3] Synthetic dispute event: '{dispute_event.reason}'")

    # Step 4: Autonomous Relayer queries live Edge Arbiter
    endpoint = LIVE_EDGE_ENDPOINT if use_remote_edge else None
    relayer = BaseEscrowRelayer(
        contract_address="0xBaseSepoliaM2MEscrowMock",
        arbiter_endpoint=endpoint,
    )

    logger.info(f"[Step 4] Querying m2m-escrow-arbiter at {endpoint or 'local fallback'}...")
    try:
        relayer.process_dispute(dispute_event)
    except ValueError as exc:
        if "requires human review" not in str(exc):
            raise
        logger.info("Expected hold: no settlement calldata prepared.")
        return {
            "escrow_id": escrow_id,
            "status": "not_decision_ready",
            "settlement_authorized": False,
            "retained_usdc": deal_amount_usdc,
        }
    raise AssertionError("Unverified synthetic evidence unexpectedly produced settlement calldata")


if __name__ == "__main__":
    run_e2e_simulation(use_remote_edge=False)
