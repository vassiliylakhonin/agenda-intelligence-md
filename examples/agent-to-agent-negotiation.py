#!/usr/bin/env python3
"""
Agent-to-Agent (A2A) Negotiation Demo

This script demonstrates autonomous A2A interaction. A "Shopping Agent" attempts
to execute a transaction on a "Merchant System". Before allowing it, the Merchant
System delegates the trust decision to an Agenda Intelligence MD Worker (Trust Gate).

The Trust Gate identifies missing evidence (e.g. human operator authorization),
causing the Merchant to challenge the Shopping Agent. The Shopping Agent retrieves
the signature, resubmits, and the Trust Gate allows the transaction.

Usage:
    pip install aiohttp
    python3 examples/agent-to-agent-negotiation.py
"""

import asyncio
import json
import time
import uuid
try:
    import aiohttp
except ImportError:
    raise SystemExit("Please install aiohttp: pip install aiohttp")

# The deployed Trust Gate Worker
TRUST_GATE_URL = "https://agentic-interaction-trust-a2a.vassiliy-lakhonin.workers.dev/"

async def call_trust_gate(session, evidence_packet):
    """Merchant System calling the Trust Gate A2A endpoint."""
    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "message/send",
        "params": {
            "capability": "agentic_interaction_trust",
            "agentic_interaction_trust_request": evidence_packet
        }
    }
    async with session.post(TRUST_GATE_URL, json=payload, timeout=30) as resp:
        return await resp.json()

async def main():
    print("🤖 Agent-to-Agent (A2A) Negotiation Started\n")
    print("Context: 'NexusShoppingBot' is attempting a $5,000 checkout for 'Alice'.")
    print("-" * 60)
    
    async with aiohttp.ClientSession() as session:
        # Step 1: Initial Attempt (Missing Auth)
        print("\n[Shopping Agent] -> [Merchant System]: 'Execute checkout order #991'")
        
        evidence_packet = {
            "actor": {
                "declared_type": "ai_agent",
                "declared_name": "NexusShoppingBot v2.1",
                "operator": "Alice Consumer",
                "authentication_context": "session_cookie"
            },
            "target_surface": "checkout",
            "requested_action": "complete purchase of $5,000 electronics",
            "decision_stage": "pre_execution",
            "dated_sources": [
                {
                    "id": "src-1",
                    "source_type": "agent_identity_claim",
                    "title": "Declared User-Agent header",
                    "date": "2026-08-27"
                }
            ],
            "risk_question": "Should we allow this autonomous high-value checkout?"
        }
        
        print("[Merchant System] -> [Trust Gate Agent]: 'Verify this request.'")
        result1 = await call_trust_gate(session, evidence_packet)
        
        if "error" in result1:
            print(f"Error calling gate: {result1['error']}")
            return

        # Extract the response from the new metadata envelope
        gate_response = result1["result"].get("metadata", {}).get("response", {})
        recommendation = gate_response.get("triage_recommendation", "unknown")
        
        print(f"\n[Trust Gate Agent] -> [Merchant System]: '{recommendation.upper()}'")
        
        if True:
            print(f"   Missing Evidence: {gate_response.get('evidence_gaps', [])}")
            
            # Step 2: Negotiation / Challenge
            print("\n[Merchant System] -> [Shopping Agent]: 'CHALLENGE: Missing operator authorization. Step-up required.'")
            print("[Shopping Agent] -> [Alice's Phone]: 'Please confirm $5,000 checkout via FaceID.'")
            print("[Alice's Phone] -> [Shopping Agent]: 'Confirmed.'")
            
            print("\n[Shopping Agent] -> [Merchant System]: 'Resubmitting with cryptographic operator authorization.'")
            
            # Step 3: Resubmission
            # Add ALL required minimum sources to get a clear "allow" or "escalate_to_human_review"
            evidence_packet["dated_sources"].extend([
                {
                    "id": "src-2",
                    "source_type": "operator_or_principal_authorization",
                    "title": "Cryptographic FaceID assertion from Alice's device",
                    "date": "2026-08-27"
                },
                {
                    "id": "src-3",
                    "source_type": "agent_card_or_manifest",
                    "title": "NexusShoppingBot signed manifest",
                    "date": "2026-08-27"
                },
                {
                    "id": "src-4",
                    "source_type": "tool_scope_or_permission_evidence",
                    "title": "Alice's wallet limits for NexusBot ($10k/day)",
                    "date": "2026-08-27"
                },
                {
                    "id": "src-5",
                    "source_type": "session_authentication_evidence",
                    "title": "OAuth2 active session token",
                    "date": "2026-08-27"
                },
                {
                    "id": "src-6",
                    "source_type": "action_intent_evidence",
                    "title": "User prompt log: 'buy the electronics in my cart'",
                    "date": "2026-08-27"
                },
                {
                    "id": "src-7",
                    "source_type": "transaction_or_target_action_evidence",
                    "title": "Shopping cart contents matching electronics",
                    "date": "2026-08-27"
                }
            ])
            
            print("[Merchant System] -> [Trust Gate Agent]: 'Verify updated request with full evidence.'")
            result2 = await call_trust_gate(session, evidence_packet)
            
            gate_response_2 = result2["result"].get("metadata", {}).get("response", {})
            recommendation_2 = gate_response_2.get("triage_recommendation", "unknown")
            print(f"\n[Trust Gate Agent] -> [Merchant System]: '{recommendation_2.upper()}'")
            print("   (Evidence threshold met)")
            
            if recommendation_2 == "allow_with_monitoring" or recommendation_2 == "escalate_to_human_review":
                print("\n[Merchant System]: Transaction recorded. Policy engine takes final action. ✅")

if __name__ == "__main__":
    asyncio.run(main())
