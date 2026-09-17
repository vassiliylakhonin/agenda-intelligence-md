"""Virtuals Protocol GAME SDK & Morpheus Task Adapter.

Exposes Agenda Intelligence's deterministic security gates as callable tools
for decentralized autonomous agents operating on Virtuals Protocol or Morpheus.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from agenda_intelligence.agent_financial_guard import (
    AgentFinancialGuard,
    FinancialGuardVerdict,
)
from agenda_intelligence.m2m_escrow_arbiter import ArbitrationRuling, M2MEscrowArbiter


class AgendaVirtualsAdapter:
    """GAME SDK Tool & Action Adapter for Virtuals Protocol."""

    def __init__(
        self,
        guard_endpoint: Optional[str] = None,
        arbiter_endpoint: Optional[str] = None,
        prefer_remote: bool = True,
    ) -> None:
        self.guard = AgentFinancialGuard(endpoint=guard_endpoint) if guard_endpoint else AgentFinancialGuard()
        self.arbiter = M2MEscrowArbiter(endpoint=arbiter_endpoint) if arbiter_endpoint else M2MEscrowArbiter()
        self.prefer_remote = prefer_remote

    def get_game_function_specs(self) -> list[dict[str, Any]]:
        """Returns OpenAPI/JSON schema specifications for GAME SDK worker registration."""
        return [
            {
                "name": "check_transaction_safety",
                "description": "Pre-sign transaction firewall check against OFAC SDN, drainers, and treasury limits.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "recipient": {"type": "string", "description": "Target address (0x...)"},
                        "amount_usd": {"type": "number", "description": "Value in USD"},
                        "calldata": {"type": "string", "description": "Hex calldata (default 0x)"},
                        "intent": {"type": "string", "description": "Natural language transaction rationale"},
                    },
                    "required": ["recipient", "amount_usd"],
                },
            },
            {
                "name": "arbitrate_escrow_dispute",
                "description": "Deterministic B2B contract dispute resolution with mathematical payout split.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "escrow_id": {"type": "string", "description": "Bytes32 escrow identifier"},
                        "amount_usd": {"type": "number", "description": "Escrow amount in USD"},
                        "valid_items": {"type": "integer", "description": "Number of valid verified records"},
                        "total_items": {"type": "integer", "description": "Expected record count"},
                        "policy": {"type": "string", "enum": ["pro_rata", "all_or_nothing"]},
                    },
                    "required": ["escrow_id", "amount_usd", "valid_items", "total_items"],
                },
            },
        ]

    def execute_transaction_check(
        self,
        recipient: str,
        amount_usd: float,
        calldata: str = "0x",
        intent: str = "",
    ) -> dict[str, Any]:
        """Execute pre-sign transaction verification."""
        verdict: FinancialGuardVerdict = self.guard.check_transaction(
            recipient_address=recipient,
            amount_usd=amount_usd,
            calldata=calldata,
            intent=intent,
            prefer_remote=self.prefer_remote,
        )
        return {
            "decision": verdict.decision,
            "is_safe": verdict.is_allowed,
            "risk_score": verdict.score,
            "violations": verdict.violations,
            "execution_advisory": verdict.execution_advisory,
        }

    def execute_arbitration(
        self,
        escrow_id: str,
        amount_usd: float,
        valid_items: int,
        total_items: int,
        policy: str = "pro_rata",
    ) -> dict[str, Any]:
        """Execute autonomous escrow dispute evaluation."""
        payload = {
            "escrow_id": escrow_id,
            "dispute_claim": {
                "claimant": "buyer",
                "reason": f"Fulfillment check: {valid_items}/{total_items} items valid",
            },
            "deal_terms": {
                "buyer_id": "virtuals:agent:buyer",
                "seller_id": "virtuals:agent:seller",
                "amount_usd": amount_usd,
                "currency": "USDC",
                "deadline_utc": "2026-10-01T00:00:00Z",
                "arbitration_policy": policy,
                "arbitration_fee_pct": 1.0,
            },
            "specification": {
                "deliverable_type": "json_data",
                "expected_artifact_sha256": "0" * 64,
            },
            "delivery_submission": {
                "submitted_at": "2026-09-17T12:00:00Z",
                "artifact_sha256": "0" * 64,
                "telemetry": {"total_items": total_items, "valid_items": valid_items},
            },
        }
        ruling: ArbitrationRuling = self.arbiter.evaluate_dispute(payload, prefer_remote=self.prefer_remote)
        return {
            "ruling": ruling.ruling,
            "score": ruling.score,
            "payout": {
                "seller_usd": ruling.payout.seller_payout_usd,
                "buyer_usd": ruling.payout.buyer_refund_usd,
                "fee_usd": ruling.payout.arbiter_fee_usd,
            },
            "execution_advisory": ruling.execution_advisory,
        }


if __name__ == "__main__":
    adapter = AgendaVirtualsAdapter(prefer_remote=False)
    specs = adapter.get_game_function_specs()
    print("Virtuals GAME Function Specs:")
    print(json.dumps(specs, indent=2))

    check_res = adapter.execute_transaction_check(
        recipient="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amount_usd=25.0,
        intent="Payment for data feed",
    )
    print("\nTransaction Check Result:")
    print(json.dumps(check_res, indent=2))
    assert check_res["is_safe"] is True
    print("\nVirtuals adapter verified successfully!")
