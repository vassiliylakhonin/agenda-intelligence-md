"""CrewAI Autonomous B2B Deal & Escrow Arbitration Tool.

Demonstrates how to equip CrewAI agents with M2MEscrowArbiter
to identify missing delivery evidence for human review; no settlement execution.
"""

from typing import Any, Dict
from agenda_intelligence import M2MEscrowArbiter


class EscrowArbitrationTool:
    """CrewAI-compatible tool for autonomous B2B deal arbitration."""

    name: str = "escrow_arbitration_tool"
    description: str = (
        "Deterministically arbitrates M2M deliverable disputes between autonomous agents. "
        "Verifies delivery deadlines, SHA-256 artifact hashes, and schema completeness."
    )

    def __init__(self) -> None:
        self.arbiter = M2MEscrowArbiter()

    def run(self, dispute_payload: Dict[str, Any]) -> Dict[str, Any]:
        """Execute arbitration on a disputed deal."""
        ruling = self.arbiter.evaluate_dispute(dispute_payload, prefer_remote=False)
        return {
            "ruling": ruling.ruling,
            "score": ruling.score,
            "seller_payout_usd": ruling.payout.seller_payout_usd,
            "buyer_refund_usd": ruling.payout.buyer_refund_usd,
            "arbiter_fee_usd": ruling.payout.arbiter_fee_usd,
            "advisory": ruling.execution_advisory,
        }


if __name__ == "__main__":
    print("--- Testing CrewAI Escrow Arbitration Tool ---")
    tool = EscrowArbitrationTool()

    # Scenario: Seller reports 75% valid items without supplying the artifact
    dispute = {
        "escrow_id": "crewai_deal_9901",
        "deal_terms": {
            "buyer_id": "crew_buyer_agent",
            "seller_id": "crew_seller_agent",
            "amount_usd": 1000.0,
            "currency": "USDC",
            "deadline_utc": "2026-09-30T12:00:00Z",
            "arbitration_policy": "pro_rata",
            "arbitration_fee_pct": 1.0,
        },
        "specification": {
            "deliverable_type": "json_data",
            "min_valid_records_pct": 90.0,
        },
        "delivery_submission": {
            "submitted_at": "2026-09-17T09:00:00Z",
            "telemetry": {
                "total_items": 1000,
                "valid_items": 750,
            },
        },
    }

    result = tool.run(dispute)
    print(f"Tool Result: {result}")

    assert result["ruling"] == "ESCALATE_HUMAN"
    assert result["seller_payout_usd"] == 0
    assert result["buyer_refund_usd"] == 0
    assert result["arbiter_fee_usd"] == 0
    print("\nOffline adapter example completed; evidence missing, no payout authorized.")
