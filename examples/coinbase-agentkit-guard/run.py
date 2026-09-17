"""Coinbase AgentKit Pre-Sign Security Hook with AgentFinancialGuard.

Demonstrates wrapping any on-chain wallet broadcast with sub-5ms deterministic
validation against OFAC SDN blacklists, drainer calldata, and spending limits.
"""

from agenda_intelligence import AgentFinancialGuard


def secure_agent_send_transaction(wallet_action: dict) -> dict:
    """Pre-sign security interceptor before broadcasting to Base Mainnet."""
    guard = AgentFinancialGuard()

    # Pre-flight check
    verdict = guard.check_transaction(
        recipient_address=wallet_action["to"],
        amount_usd=wallet_action["amount_usd"],
        network="base",
        calldata=wallet_action.get("data", "0x"),
        intent=wallet_action.get("intent", "Settle autonomous API usage"),
        asset=wallet_action.get("asset", "USDC"),
    )

    if verdict.is_allowed:
        print(f"✅ Transaction approved (Score: {verdict.score}/100): Broadcasting {wallet_action['amount_usd']} USDC")
        # In production: return wallet_provider.send_transaction(...)
        return {"status": "broadcast_success", "tx_hash": "0xabc123...", "score": verdict.score}

    elif verdict.is_rejected:
        print(f"🚫 BLOCKED by AgentFinancialGuard: {', '.join(verdict.violations)}")
        return {"status": "blocked", "violations": verdict.violations, "score": verdict.score}

    else:
        print(f"⚠️ Human approval required: {verdict.recommendation}")
        return {"status": "escalated", "reason": verdict.recommendation}


if __name__ == "__main__":
    print("--- 1. Testing clean vendor payment ($35 USDC on Base) ---")
    res1 = secure_agent_send_transaction({
        "to": "0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663",
        "amount_usd": 35.0,
        "asset": "USDC",
        "intent": "Pay for intelligence report",
    })
    assert res1["status"] == "broadcast_success"

    print("\n--- 2. Testing blocked Tornado Cash router interaction ---")
    res2 = secure_agent_send_transaction({
        "to": "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
        "amount_usd": 10.0,
        "asset": "ETH",
        "intent": "Route liquidity",
    })
    assert res2["status"] == "blocked"
    print("\nSecurity hook integration verified successfully!")
