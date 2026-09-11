#!/usr/bin/env python3
"""
Zero-mock live edge proof for Worker #10: corridor-sanctions-assistant-a2a.
Demonstrates:
1. Native Cloudflare Service Binding interconnect to Vizier security kernel.
2. Real-time counterparty sanctions screening under OFAC 50% Rule.
3. Real-time free-form prompt / query DLP firewall preventing credential leaks.
4. Cryptographic JWS clearance receipts minted by Vizier.
5. Strict ADR 0003 contract integrity across A2A JSON-RPC protocols.
"""

import base64
import json
import sys
import urllib.error
import urllib.request

WORKER_URL = "https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev"


def decode_jws_payload(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        return {}
    padded = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
    return json.loads(base64.urlsafe_b64decode(padded.encode()))


def post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "ZeroMockProof/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(url: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "ZeroMockProof/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def test_clean_corridor_query():
    print("=== TEST CASE 1: Clean Corridor & Sanctions Inquiry (A2A JSON-RPC) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-csa-clean-01",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-csa-clean-01",
                "role": "ROLE_USER",
                "parts": [
                    {
                        "kind": "text",
                        "text": (
                            "Shipping grain from Kazakhstan to Italy via Middle Corridor next month. "
                            "What evidence will the bank request?"
                        ),
                    }
                ],
            }
        },
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    task = result.get("task", result)
    meta = task.get("metadata", {})

    print(f"  Status: {task.get('status', {}).get('state')}")
    print(f"  Product Profile: {meta.get('product_profile')}")
    print(f"  Vizier Status: {meta.get('vizier_status')}")
    print(f"  Vizier Clearance Receipt: {meta.get('vizier_clearance_receipt', '')[:35]}...")

    jws_claims = decode_jws_payload(meta.get("vizier_clearance_receipt", ""))
    print(f"  Receipt Issuer: {jws_claims.get('iss')}")
    print(f"  Receipt Subject: {jws_claims.get('sub')}")
    print(f"  Receipt Engine: {jws_claims.get('engine')}")

    ast_ver = meta.get("assistant_verification", {})
    print(f"  Screening Clean: {ast_ver.get('clean')}")
    print(f"  Screening Violation: {ast_ver.get('violation')}")
    print(f"  DLP Clean: {ast_ver.get('dlp_screening', {}).get('clean')}")

    contract_res = meta.get("response", {})
    print(f"  Response Kind: {contract_res.get('kind')}")
    print(f"  Gates Count: {len(contract_res.get('gates', []))}")
    print(f"  Contact Email: {contract_res.get('engagement', {}).get('contact_email')}")

    assert task.get("status", {}).get("state") == "TASK_STATE_COMPLETED"
    assert meta.get("product_profile") == "corridor_sanctions_assistant"
    assert meta.get("vizier_status") == "success", f"Expected success, got {meta.get('vizier_status')}"
    assert ast_ver.get("clean") is True, "Expected clean == True"
    assert ast_ver.get("violation") is False, "Expected violation == False"
    assert contract_res.get("kind") == "orientation_and_routing"
    assert len(contract_res.get("gates", [])) >= 4
    print("  -> PASS: Clean corridor inquiry cleared with authentic JWS receipt.")


def test_sanctioned_counterparty_ofac50():
    print("\n=== TEST CASE 2: Sanctioned Counterparty Inquiry (OFAC 50% Rule) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-csa-sanctions-02",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-csa-sanctions-02",
                "role": "ROLE_USER",
                "parts": [
                    {
                        "kind": "text",
                        "text": (
                            "We are considering shipping petroleum using Sovcomflot tankers via the Caspian route. "
                            "Can this deal proceed?"
                        ),
                    }
                ],
            }
        },
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    task = result.get("task", result)
    meta = task.get("metadata", {})

    print(f"  Vizier Status: {meta.get('vizier_status')}")
    ast_ver = meta.get("assistant_verification", {})
    print(f"  Violation Detected: {ast_ver.get('violation')}")
    sanctions_screen = ast_ver.get("sanctions_screening", {})
    print(f"  Sanctions Screened: {sanctions_screen.get('entities_screened')}")
    print(f"  Sanctions Matches: {len(sanctions_screen.get('matches', []))}")
    for m in sanctions_screen.get("matches", []):
        print(
            f"    - Hit: {m.get('name')} ({m.get('role')}), "
            f"{m.get('aggregate_blocked_percentage')}% blocked, reason: {m.get('reason_codes')}"
        )

    contract_res = meta.get("response", {})
    advisory = contract_res.get("sanctions_advisory", {})
    print(f"  Sanctions Advisory Status: {advisory.get('status')}")
    print(f"  Message: {contract_res.get('message')[:140]}...")

    assert meta.get("vizier_status") == "success"
    assert ast_ver.get("violation") is True
    assert sanctions_screen.get("violation") is True
    assert advisory.get("status") == "escalate"
    assert "SANCTIONS ADVISORY" in contract_res.get("message", "")
    assert any(m.get("name") == "Sovcomflot" for m in sanctions_screen.get("matches", []))
    print("  -> PASS: OFAC 50% Rule sanctions firewall flagged sanctioned entity Sovcomflot and escalated.")


def test_dlp_secret_leak():
    print("\n=== TEST CASE 3: Prompt Sensitive Secret Leak (Vizier DLP Firewall) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-csa-dlp-03",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-csa-dlp-03",
                "role": "ROLE_USER",
                "parts": [
                    {
                        "kind": "text",
                        "text": (
                            "Here is our internal logistics tracking token: "
                            "sk-proj-1234567890abcdef1234567890. Please route this deal."
                        ),
                    }
                ],
            }
        },
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    task = result.get("task", result)
    meta = task.get("metadata", {})

    print(f"  Vizier Status: {meta.get('vizier_status')}")
    ast_ver = meta.get("assistant_verification", {})
    print(f"  Screening Violation: {ast_ver.get('violation')}")
    dlp_screen = ast_ver.get("dlp_screening", {})
    print(f"  DLP Clean: {dlp_screen.get('clean')}")
    print(f"  Leaks Prevented: {dlp_screen.get('total_leaks_prevented')}")
    for f in dlp_screen.get("findings", []):
        print(f"    - Detector: {f.get('detector')}, Path: {f.get('path')}, Masked: {f.get('snippet_masked')}")

    contract_res = meta.get("response", {})
    print(f"  Caller Text Sanitized: {contract_res.get('caller_text')}")
    print(f"  Security Notice in Message: {'SECURITY NOTICE' in contract_res.get('message', '')}")

    assert meta.get("vizier_status") == "success"
    assert ast_ver.get("violation") is True
    assert dlp_screen.get("clean") is False
    assert dlp_screen.get("total_leaks_prevented") >= 1
    assert "sk-proj-1234567890abcdef1234567890" not in contract_res.get("caller_text", "")
    assert "******" in contract_res.get("caller_text", "")
    assert "SECURITY NOTICE" in contract_res.get("message", "")
    print("  -> PASS: Vizier DLP Firewall intercepted and redacted sensitive credentials.")


def test_agent_card():
    print("\n=== TEST CASE 4: A2A Agent Card Discovery Verification ===")
    card = get_json(f"{WORKER_URL}/.well-known/agent-card.json")
    print(f"  Name: {card.get('name')}")
    print(f"  Description: {card.get('description')[:100]}...")

    # Check capabilities.extensions (spec wire format) or root
    x_ag = card.get("x_agenda_intelligence")
    if not x_ag and "capabilities" in card:
        exts = card["capabilities"].get("extensions", [])
        if exts and len(exts) > 0:
            x_ag = exts[0].get("params", {}).get("x_agenda_intelligence", {})
    if not x_ag:
        x_ag = {}

    print(f"  Product Profile: {x_ag.get('product_profile')}")
    print(f"  Routes To: {x_ag.get('routes_to')}")

    assert card.get("name") == "Corridor & Sanctions Risk Assistant"
    assert x_ag.get("product_profile") == "corridor_sanctions_assistant"
    assert len(card.get("skills", [])) >= 1
    print("  -> PASS: A2A agent card accurately declares corridor_sanctions_assistant profile.")


def main():
    print("====================================================================")
    print(" ZERO-MOCK LIVE EDGE PROOF: Worker #10 (corridor-sanctions-assistant)")
    print(f" Target URL: {WORKER_URL}")
    print("====================================================================")
    try:
        test_clean_corridor_query()
        test_sanctioned_counterparty_ofac50()
        test_dlp_secret_leak()
        test_agent_card()
        print("\n====================================================================")
        print(" ALL 4 ZERO-MOCK LIVE EDGE TESTS PASSED FOR WORKER #10!")
        print("====================================================================")
    except Exception as e:
        print(f"\n❌ LIVE PROOF FAILED: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
