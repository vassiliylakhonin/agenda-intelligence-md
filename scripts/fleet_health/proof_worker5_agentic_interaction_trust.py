#!/usr/bin/env python3
"""
Zero-mock live edge proof for Worker #5: agentic-interaction-trust-a2a.
Checks built-in name matches, synthetic secret detection, DLP-only receipt
provenance and mandatory human review. No live list freshness, ownership
verification, signature verification or action authorization is asserted.
"""

import base64
import json
import sys
import urllib.error
import urllib.request

WORKER_URL = "https://agentic-interaction-trust-a2a.vassiliy-lakhonin.workers.dev"


def decode_jws_payload(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        return {}
    padded = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
    return json.loads(base64.urlsafe_b64decode(padded.encode()))


def assert_scoped_provenance(metadata, expected_violation):
    verification = metadata["trust_verification"]
    assert not metadata.get("vizier_clearance_receipt"), "DLP must not become full clearance"
    assert verification["ownership_status"] == "unverified"
    assert verification["signature_verified"] is False
    assert verification["receipt_scope"] == "dlp_scan_only"
    assert verification["violation"] is expected_violation
    assert verification["clean"] is (False if expected_violation else None)
    claims = decode_jws_payload(verification["dlp_receipt"])
    # Payload inspection checks scope consistency; it does not verify the signature.
    assert claims["scope"] == "dlp_scan_only"
    assert claims["engine"] == "vizier_dlp_firewall"
    assert claims["clean"] is verification["dlp_screening"]["clean"]


def post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json", "User-Agent": "ZeroMockProof/1.0"}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


FULL_DATED_SOURCES = [
    {"id": "src-1", "source_type": "agent_identity_claim", "title": "Identity Claim", "date": "2026-05-28"},
    {"id": "src-2", "source_type": "operator_or_principal_authorization", "title": "Auth Header", "date": "2026-05-28"},
    {"id": "src-3", "source_type": "agent_card_or_manifest", "title": "Agent Card", "date": "2026-05-28"},
    {"id": "src-4", "source_type": "tool_scope_or_permission_evidence", "title": "Tool Scope", "date": "2026-05-28"},
    {"id": "src-5", "source_type": "session_authentication_evidence", "title": "Session Auth", "date": "2026-05-28"},
    {"id": "src-6", "source_type": "action_intent_evidence", "title": "Intent Evidence", "date": "2026-05-28"},
    {
        "id": "src-7",
        "source_type": "transaction_or_target_action_evidence",
        "title": "Target Action",
        "date": "2026-05-28",
    },
]


def test_clean_agent_interaction():
    print("=== TEST CASE 1: Clean Agent Interaction (A2A JSON-RPC) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-clean-01",
        "method": "message/send",
        "params": {
            "capability": "agentic_interaction_trust",
            "request": {
                "actor": {
                    "declared_type": "ai_agent",
                    "declared_name": "CheckoutAssistant",
                    "operator": "Acme Global Solutions",
                    "authentication_context": "oauth",
                },
                "target_surface": "checkout",
                "requested_action": "execute_approved_purchase",
                "decision_stage": "pre_execution",
                "dated_sources": FULL_DATED_SOURCES,
                "risk_question": "Is this agent authorized to execute checkout?",
            },
        },
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    metadata = result.get("metadata", {})
    response = metadata.get("response", {})

    print(f"Status: {result.get('status', {}).get('state')}")
    print(f"Triage Recommendation: {response.get('triage_recommendation')}")
    print(f"Trust Signal: {response.get('trust_signal')}")
    print(
        f"Readiness Score: {response.get('decision_readiness_score')}/100 ({response.get('decision_readiness_label')})"
    )
    print(f"Vizier Status: {metadata.get('vizier_status')}")

    trust_verif = metadata.get("trust_verification", {})
    op_screen = trust_verif.get("operator_screening", {})
    print(f"Operator Screening: checked={op_screen.get('checked')}, " f"violation={op_screen.get('violation')}")
    print(f"DLP Screening: clean={trust_verif.get('dlp_screening', {}).get('clean')}")

    assert_scoped_provenance(metadata, False)
    assert response["human_review_required"] is True

    assert response.get("triage_recommendation") == "allow_low_risk"
    assert response.get("trust_signal") == "high"
    assert metadata.get("vizier_status") == "success"
    assert trust_verif.get("clean") is None
    assert trust_verif.get("violation") is False
    print(">>> PASS: DLP clean; ownership remains unverified and human review required.\n")


def test_sanctioned_operator_screening():
    print("=== TEST CASE 2: Built-in Blocked Operator Match (A2A JSON-RPC) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-sanctions-02",
        "method": "message/send",
        "params": {
            "capability": "agentic_interaction_trust",
            "request": {
                "actor": {
                    "declared_type": "ai_agent",
                    "declared_name": "CryptoTradingBot",
                    "operator": "Garantex Europe",
                    "authentication_context": "api_key",
                },
                "target_surface": "api",
                "requested_action": "execute_crypto_swap",
                "decision_stage": "pre_execution",
                "dated_sources": FULL_DATED_SOURCES,
                "risk_question": "Can bot execute trade on API?",
            },
        },
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    metadata = result.get("metadata", {})
    response = metadata.get("response", {})

    print(f"Status: {result.get('status', {}).get('state')}")
    print(f"Triage Recommendation: {response.get('triage_recommendation')}")
    print(f"Trust Signal: {response.get('trust_signal')}")
    print(f"Vizier Status: {metadata.get('vizier_status')}")

    trust_verif = metadata.get("trust_verification", {})
    op_screen = trust_verif.get("operator_screening", {})
    print(f"Operator Screening Violation: {op_screen.get('violation')}")
    print(f"Operator Screening Match: {op_screen.get('match')}")

    assert_scoped_provenance(metadata, True)
    assert response["human_review_required"] is True

    assert response.get("triage_recommendation") == "block_until_verified"
    assert response.get("trust_signal") == "low"
    assert metadata.get("vizier_status") == "success"
    assert trust_verif.get("violation") is True
    assert op_screen.get("violation") is True
    assert any("Sanctioned operator/principal" in d for d in response.get("top_risk_dimensions", []))
    assert any("subject to sanctions" in g for g in response.get("evidence_gaps", []))
    print(">>> PASS: Built-in blocked-name match preserved despite clean DLP scan.\n")


def test_payload_dlp_firewall():
    print("=== TEST CASE 3: Payload DLP Secret Leak Interception (A2A JSON-RPC) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-dlp-03",
        "method": "message/send",
        "params": {
            "capability": "agentic_interaction_trust",
            "request": {
                "actor": {
                    "declared_type": "ai_agent",
                    "declared_name": "IntegrationTool",
                    "operator": "Acme Corp",
                    "authentication_context": "api_key",
                },
                "target_surface": "mcp_tool",
                "requested_action": "query_database",
                "decision_stage": "in_session",
                "dated_sources": FULL_DATED_SOURCES,
                "risk_question": "Is tool invocation safe?",
                "notes": "Authorization key: sk-proj-1234567890abcdef998877665544 for database read",
            },
        },
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    metadata = result.get("metadata", {})
    response = metadata.get("response", {})

    print(f"Status: {result.get('status', {}).get('state')}")
    print(f"Triage Recommendation: {response.get('triage_recommendation')}")
    print(f"Trust Signal: {response.get('trust_signal')}")
    print(f"Vizier Status: {metadata.get('vizier_status')}")

    trust_verif = metadata.get("trust_verification", {})
    dlp_screen = trust_verif.get("dlp_screening", {})
    print(f"DLP Screening Clean: {dlp_screen.get('clean')}")
    print(f"DLP Leaks Prevented: {dlp_screen.get('total_leaks_prevented')}")
    for f in dlp_screen.get("findings", []):
        print(f"  - Detector: {f.get('detector')}, Masked: {f.get('snippet_masked')}")

    assert_scoped_provenance(metadata, True)
    assert response["human_review_required"] is True

    assert response.get("triage_recommendation") == "block_until_verified"
    assert response.get("trust_signal") == "low"
    assert metadata.get("vizier_status") == "success"
    assert trust_verif.get("violation") is True
    assert dlp_screen.get("clean") is False
    assert any("DLP secret/PII leak detected" in d for d in response.get("top_risk_dimensions", []))
    assert any("Payload contains leaked secret" in g for g in response.get("evidence_gaps", []))
    print(">>> PASS: Payload secret leak intercepted and blocked by Vizier DLP Firewall!\n")


def test_rest_endpoint_provenance():
    print("=== TEST CASE 4: Direct REST Endpoint Provenance (POST /v1/agentic-interaction/trust) ===")
    payload = {
        "actor": {
            "declared_type": "ai_agent",
            "declared_name": "CheckoutAssistant",
            "operator": "Acme Global Solutions",
            "authentication_context": "oauth",
        },
        "target_surface": "checkout",
        "requested_action": "execute_approved_purchase",
        "decision_stage": "pre_execution",
        "dated_sources": FULL_DATED_SOURCES,
        "risk_question": "Is this agent authorized to execute checkout?",
    }
    res = post_json(f"{WORKER_URL}/v1/agentic-interaction/trust", payload)
    print(f"Triage Recommendation: {res.get('triage_recommendation')}")
    print(f"Trust Signal: {res.get('trust_signal')}")
    print(f"Vizier Status: {res.get('vizier_status')}")
    print(f"Vizier Receipt: {str(res.get('vizier_clearance_receipt'))[:40]}...")

    trust_verif = res.get("trust_verification", {})
    print(f"Trust Verification Clean: {trust_verif.get('clean')}")

    assert res.get("triage_recommendation") == "allow_low_risk"
    assert res.get("trust_signal") == "high"
    assert res.get("vizier_status") == "success"
    assert_scoped_provenance(res, False)
    assert res["human_review_required"] is True
    assert trust_verif.get("clean") is None
    print(">>> PASS: REST endpoint preserved DLP-only provenance and human review.\n")


if __name__ == "__main__":
    try:
        test_clean_agent_interaction()
        test_sanctioned_operator_screening()
        test_payload_dlp_firewall()
        test_rest_endpoint_provenance()
        print("ALL ZERO-MOCK LIVE EDGE TESTS FOR WORKER #5 PASSED 100%!")
    except Exception as e:
        print(f"FAILED: {e}")
        sys.exit(1)
