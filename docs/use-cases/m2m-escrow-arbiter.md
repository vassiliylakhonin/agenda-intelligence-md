# M2M Escrow Arbiter & Autonomous B2B Deal Settlement

Status: shipped 2026-09-17. Vertical worker service function `m2m_escrow_arbiter`. Schema family v1, additive (non-breaking under [ADR 0003](../adr/0003-v1-compatibility-policy.md)).

## Proposition

In the Machine-to-Machine (M2M) and Agent-to-Agent (A2A) commerce economy, autonomous AI agents enter into commercial agreements: purchasing datasets, fine-tuned models, code deliverables, API audits, or decentralized compute.

Funds are locked in escrow contracts (on-chain smart contracts on Base, Ethereum, Solana, or virtual escrow vaults). When deliverables are submitted, disputes frequently arise:
- The **Buyer Agent** may stall or claim the work is incomplete.
- The **Seller Agent** may submit invalid schemas, corrupted payloads, or miss delivery deadlines.
- Deliverables may be partially completed (e.g. 800 of 1000 required records delivered).

Without an automated, deterministic arbiter, dispute resolution requires human intervention that takes days and costs hundreds of dollars—completely unviable for autonomous agent transactions.

**M2M Escrow Arbiter** acts as an edge-evaluated autonomous judge on Cloudflare Workers:
1. **Deadline Observance**: Evaluates if the deliverable was submitted before `deadline_utc`.
2. **Cryptographic Hash & Integrity**: Validates `expected_artifact_sha256` against delivered payload hashes.
3. **JSON Schema & Contract Conformity**: Asserts that delivered data matches agreed schema specifications.
4. **SLO Completeness & Scoring**: Measures valid item counts and SLA fulfilment percentages.
5. **Mathematical Payout Allocation**: Computes deterministic payouts under `all_or_nothing` or `pro_rata` policies, automatically settling arbiter fees (1%).
6. **Vizier JWS Attestation**: Attests rulings with cryptographic non-repudiation receipts for direct on-chain smart contract execution.

## Interfaces

The arbiter is exposed across three standard protocols:

1. **Direct HTTP REST API**:
   - `POST https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev/v1/m2m-escrow/evaluate-dispute`
2. **Model Context Protocol (MCP)**:
   - Tool `m2m_escrow_arbitration_ruling` via `https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev/mcp`
3. **Google Agent-to-Agent (A2A)**:
   - `POST https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev/message/send` (JSON-RPC 2.0 `SendMessage`)

## Request Example

```json
{
  "escrow_id": "escrow_deal_0x892a_dataset_mining",
  "dispute_id": "disp_99182",
  "dispute_claim": {
    "claimant": "seller",
    "reason": "Deliverable completed and submitted on time; buyer unresponsive to release escrow."
  },
  "deal_terms": {
    "buyer_id": "did:agent:0x1111111111111111111111111111111111111111",
    "seller_id": "did:agent:0x2222222222222222222222222222222222222222",
    "amount_usd": 500.0,
    "currency": "USDC",
    "deadline_utc": "2026-09-17T18:00:00Z",
    "arbitration_policy": "pro_rata",
    "arbitration_fee_pct": 1.0
  },
  "specification": {
    "deliverable_type": "json_data",
    "expected_artifact_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "min_valid_records_pct": 95.0
  },
  "delivery_submission": {
    "submitted_at": "2026-09-17T12:00:00Z",
    "artifact_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "telemetry": {
      "total_items": 1000,
      "valid_items": 1000,
      "response_time_ms": 320
    }
  }
}
```

## Response Example

```json
{
  "contract_version": "1.0.0",
  "profile": "m2m_escrow_arbiter",
  "arbitration_ruling": {
    "status": "decision_ready",
    "ruling": "RELEASE_TO_SELLER",
    "score": 95,
    "escrow_id": "escrow_deal_0x892a_dataset_mining",
    "payout_breakdown": {
      "total_escrow_usd": 500.0,
      "seller_payout_usd": 495.0,
      "buyer_refund_usd": 0.0,
      "arbiter_fee_usd": 5.0
    },
    "checks": {
      "deadline_honored": true,
      "hash_verified": true,
      "schema_verified": true,
      "slo_verified": true
    },
    "violations": [],
    "evidence_gaps": [],
    "vizier_status": "edge_evaluated",
    "vizier_clearance_receipt": "jws_vizier_clearance_...",
    "execution_advisory": "Deliverable verified deterministically against contract specification. Full escrow release approved."
  }
}
```

## Python Integration Recipe

```python
from agenda_intelligence import M2MEscrowArbiter

arbiter = M2MEscrowArbiter()

# When a delivery dispute arises in an autonomous deal:
ruling = arbiter.evaluate_dispute(
    escrow_id="escrow-0x498b",
    deal_terms={
        "buyer_id": "0xBuyerAgent...",
        "seller_id": "0xSellerAgent...",
        "amount_usd": 250.0,
        "currency": "USDC",
        "deadline_utc": "2026-09-17T20:00:00Z",
        "arbitration_policy": "pro_rata",
    },
    specification={
        "deliverable_type": "json_data",
        "expected_artifact_sha256": "e3b0c442...",
        "min_valid_records_pct": 90.0,
    },
    delivery_submission={
        "submitted_at": "2026-09-17T15:00:00Z",
        "artifact_sha256": "e3b0c442...",
        "telemetry": {"total_items": 500, "valid_items": 500},
    },
)

if ruling.is_released_to_seller:
    # Execute smart contract escrow release to seller
    print(f"Release ${ruling.payout.seller_payout_usd} to seller.")
elif ruling.is_partial_settlement:
    print(f"Split payout: ${ruling.payout.seller_payout_usd} seller / ${ruling.payout.buyer_refund_usd} buyer.")
elif ruling.is_refunded_to_buyer:
    print(f"Contract breached ({ruling.violations}). Full refund to buyer.")
```

## Smart Contract on Base (`M2MEscrow.sol`)

For end-to-end decentralized settlement on Base Mainnet (Chain ID `8453`) using Circle USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), the reference contract is located at [`contracts/M2MEscrow.sol`](../../contracts/M2MEscrow.sol).

### Settlement Flow
1. **Deposit**: Buyer calls `createEscrow(escrowId, seller, amount, deadline, expectedArtifactHash, policy)`.
2. **Submit**: Seller calls `submitDelivery(escrowId, actualArtifactHash)`.
3. **Dispute**: In case of a dispute, either party invokes `raiseDispute(escrowId, reason)`.
4. **Resolution**: `m2m-escrow-arbiter` evaluates the dispute, calculates payout allocation (deducting 1% arbiter fee), and signs the ruling.
5. **On-Chain Settlement**: Any party or relayer calls `settleDisputeWithArbiterRuling(escrowId, ruling, sellerPayout, buyerRefund, arbiterFee, nonce, signature)`. The contract verifies the ECDSA signature, prevents replay, and dispatches the USDC tokens in a single transaction.
