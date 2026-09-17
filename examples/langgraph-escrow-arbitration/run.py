"""LangGraph Dispute Arbitration Node with M2MEscrowArbiter.

Demonstrates how to build an autonomous multi-agent escrow settlement graph
that deterministically resolves delivery disputes between Buyer and Seller agents.
"""

from typing import Any, Dict
from agenda_intelligence import M2MEscrowArbiter


def arbitrate_deal_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node: Evaluates an M2M escrow dispute and sets the payout state."""
    arbiter = M2MEscrowArbiter()

    ruling = arbiter.evaluate_dispute(
        escrow_id=state["escrow_id"],
        deal_terms=state["deal_terms"],
        specification=state["specification"],
        delivery_submission=state["delivery_submission"],
        dispute_claim=state.get("dispute_claim"),
    )

    # Return updated graph state
    return {
        **state,
        "ruling": ruling.ruling,
        "status": ruling.status,
        "score": ruling.score,
        "payout_breakdown": {
            "seller_payout_usd": ruling.payout.seller_payout_usd,
            "buyer_refund_usd": ruling.payout.buyer_refund_usd,
            "arbiter_fee_usd": ruling.payout.arbiter_fee_usd,
        },
        "violations": ruling.violations,
        "execution_advisory": ruling.execution_advisory,
    }


def route_settlement(state: Dict[str, Any]) -> str:
    """LangGraph conditional edge router."""
    ruling = state.get("ruling")
    if ruling == "RELEASE_TO_SELLER":
        return "payout_seller_action"
    elif ruling == "PARTIAL_SETTLEMENT":
        return "pro_rata_settlement_action"
    elif ruling == "REFUND_TO_BUYER":
        return "refund_buyer_action"
    return "human_escalation_action"


if __name__ == "__main__":
    print("--- Testing LangGraph Arbitration Node ---")
    mock_graph_state = {
        "escrow_id": "escrow_graph_deal_101",
        "deal_terms": {
            "buyer_id": "0xBuyerAgent",
            "seller_id": "0xSellerAgent",
            "amount_usd": 200.0,
            "currency": "USDC",
            "deadline_utc": "2026-09-30T12:00:00Z",
            "arbitration_policy": "pro_rata",
            "arbitration_fee_pct": 1.0,
        },
        "specification": {
            "deliverable_type": "json_data",
            "expected_artifact_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
        "delivery_submission": {
            "submitted_at": "2026-09-17T09:00:00Z",
            "artifact_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
        "dispute_claim": {
            "claimant": "seller",
            "reason": "Dataset delivery completed; requesting arbitration release",
        },
    }

    final_state = arbitrate_deal_node(mock_graph_state)
    next_edge = route_settlement(final_state)

    print(f"Verdict: {final_state['ruling']} (Score: {final_state['score']}/100)")
    print(f"Payout Breakdown: {final_state['payout_breakdown']}")
    print(f"Next Graph Edge: {next_edge}")

    assert final_state["ruling"] == "RELEASE_TO_SELLER"
    assert next_edge == "payout_seller_action"
    assert final_state["payout_breakdown"]["seller_payout_usd"] == 198.0
    print("\nLangGraph node executed successfully!")
