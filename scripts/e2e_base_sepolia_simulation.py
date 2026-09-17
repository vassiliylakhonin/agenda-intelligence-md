#!/usr/bin/env python3
"""Autonomous End-to-End Base Sepolia M2M Escrow & Live Edge Arbitration Simulator.

Runs a complete lifecycle:
1. Buyer Agent funds deal ($1,000 USDC on Base Sepolia).
2. Seller Agent submits deliverable (80% milestone completion).
3. Buyer flags dispute.
4. Autonomous Relayer intercepts dispute and queries live Cloudflare Edge worker
   (https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev/v1/m2m-escrow/evaluate-dispute).
5. Edge Arbiter issues deterministic ruling + cryptographic Vizier receipt.
6. Relayer validates balance conservation and formats settlement calldata.
"""

from __future__ import annotations

import json
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


def run_e2e_simulation(use_remote_edge: bool = True) -> dict[str, Any]:
    logger.info("=== Starting Autonomous M2M Escrow E2E Simulation on Base Sepolia ===")

    # Step 1: Agent Deal Initialization
    buyer_agent = "0x" + "1" * 40
    seller_agent = "0x" + "2" * 40
    escrow_id = "0x" + "c0ffee" * 10 + "1122"
    deal_amount_usdc = 1000 * 1_000_000  # 1,000 USDC (6 decimals)
    expected_artifact_hash = "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"

    logger.info(f"[Step 1] Buyer Agent ({buyer_agent[:10]}...) creates escrow for 1,000 USDC on Base Sepolia")
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
    logger.info(f"[Step 3] Dispute event raised on-chain: '{dispute_event.reason}'")

    # Step 4: Autonomous Relayer queries live Edge Arbiter
    endpoint = LIVE_EDGE_ENDPOINT if use_remote_edge else None
    relayer = BaseEscrowRelayer(
        contract_address="0xBaseSepoliaM2MEscrowMock",
        arbiter_endpoint=endpoint,
    )

    logger.info(f"[Step 4] Querying m2m-escrow-arbiter at {endpoint or 'local fallback'}...")
    settlement = relayer.process_dispute(dispute_event)

    # Step 5: Verification of Financial Mathematics & Balance Conservation
    seller_payout_usdc = settlement["seller_payout_usdc"]
    buyer_refund_usdc = settlement["buyer_refund_usdc"]
    arbiter_fee_usdc = settlement["arbiter_fee_usdc"]

    assert (
        seller_payout_usdc + buyer_refund_usdc + arbiter_fee_usdc == deal_amount_usdc
    ), "Fatal: Balance conservation broken!"

    # 80% completion with 1% total fee ($10 USDC):
    # Gross seller: $800, net: $792 (792,000,000 units)
    # Gross buyer refund: $200, net: $198 (198,000,000 units)
    # Arbiter fee: $10 (10,000,000 units)
    assert seller_payout_usdc == 792_000_000, f"Expected 792 USDC, got {seller_payout_usdc / 1e6}"
    assert buyer_refund_usdc == 198_000_000, f"Expected 198 USDC, got {buyer_refund_usdc / 1e6}"
    assert arbiter_fee_usdc == 10_000_000, f"Expected 10 USDC, got {arbiter_fee_usdc / 1e6}"

    logger.info("[Step 5] Deterministic Settlement Math Verified:")
    logger.info(f"         Seller Payout:  ${seller_payout_usdc / 1e6:.2f} USDC (79.2%)")
    logger.info(f"         Buyer Refund:   ${buyer_refund_usdc / 1e6:.2f} USDC (19.8%)")
    logger.info(f"         Arbiter Fee:    ${arbiter_fee_usdc / 1e6:.2f} USDC (1.0%)")
    logger.info(f"         Ruling Enum:    {settlement['ruling_enum']} (PARTIAL_SETTLEMENT)")
    logger.info(f"         Advisory:       {settlement['advisory']}")

    # Step 6: Prepared On-Chain Transaction Payload
    logger.info("[Step 6] Calldata prepared for M2MEscrow.settleDisputeWithArbiterRuling:")
    logger.info(json.dumps(settlement, indent=2))
    logger.info("=== Autonomous E2E M2M Escrow Cycle Completed Successfully! ===")
    return settlement


if __name__ == "__main__":
    run_e2e_simulation(use_remote_edge=True)
