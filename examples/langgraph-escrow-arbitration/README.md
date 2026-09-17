# LangGraph Dispute Arbitration Node with M2MEscrowArbiter

This example demonstrates how to integrate `M2MEscrowArbiter` as a deterministic arbitration node in LangGraph multi-agent workflows.

## Workflow Pattern

```mermaid
flowchart LR
    A[Buyer & Seller Agents Transact] --> B[Delivery Disputed]
    B --> C[arbitrate_deal_node]
    C -->|RELEASE_TO_SELLER| D[payout_seller_action]
    C -->|PARTIAL_SETTLEMENT| E[pro_rata_settlement_action]
    C -->|REFUND_TO_BUYER| F[refund_buyer_action]
```

## Running the Example

```bash
python3 run.py
```
