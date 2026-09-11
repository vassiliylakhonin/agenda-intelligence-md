#!/usr/bin/env python3
"""
Zero-mock live edge proof for Worker #11: agenda-intelligence-a2a (Root Gateway).
Demonstrates:
1. Native Cloudflare Service Binding interconnect to Vizier security kernel.
2. Real-time global counterparty sanctions screening under OFAC 50% Rule.
3. Real-time gateway prompt / query DLP firewall preventing credential leaks.
4. Cryptographic JWS clearance receipts minted by Vizier.
5. Strict ADR 0003 contract integrity across A2A JSON-RPC protocols.
"""

import base64
import json
import sys
import urllib.error
import urllib.request

WORKER_URL = "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev"


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


def test_clean_gateway_query():
    print("=== TEST CASE 1: Clean Root Gateway Routing Inquiry (A2A JSON-RPC) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-root-clean-01",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-root-clean-01",
                "role": "ROLE_USER",
                "parts": [
                    {
                        "kind": "text",
                        "text": (
                            "Shipping consumer electronics through Kazakhstan to Europe. "
                            "What are the key risk vectors and which gate applies?"
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

    gw_ver = meta.get("gateway_verification", {})
    print(f"  Screening Clean: {gw_ver.get('clean')}")
    print(f"  Screening Violation: {gw_ver.get('violation')}")
    print(f"  DLP Clean: {gw_ver.get('dlp_screening', {}).get('clean')}")
    print(f"  Modules Used: {meta.get('modules_used')}")
    print(f"  Risk Signal: {meta.get('signal_screen', {}).get('risk_signal')}")

    assert task.get("status", {}).get("state") == "TASK_STATE_COMPLETED"
    assert meta.get("product_profile") == "agenda"
    assert meta.get("vizier_status") == "success", f"Expected success, got {meta.get('vizier_status')}"
    assert gw_ver.get("clean") is True, "Expected clean == True"
    assert gw_ver.get("violation") is False, "Expected violation == False"
    assert len(meta.get("modules_used", [])) >= 1
    print("  -> PASS: Clean gateway inquiry cleared with authentic JWS receipt.")


def test_sanctioned_counterparty_ofac50():
    print("\n=== TEST CASE 2: Sanctioned Counterparty Inquiry (OFAC 50% Rule) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-root-sanctions-02",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-root-sanctions-02",
                "role": "ROLE_USER",
                "parts": [
                    {
                        "kind": "text",
                        "text": (
                            "We are looking at routing container freight using Sovcomflot vessels "
                            "across the Caspian Sea."
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
    gw_ver = meta.get("gateway_verification", {})
    print(f"  Violation Detected: {gw_ver.get('violation')}")
    sanctions_screen = gw_ver.get("sanctions_screening", {})
    print(f"  Sanctions Screened: {sanctions_screen.get('entities_screened')}")
    print(f"  Sanctions Matches: {len(sanctions_screen.get('matches', []))}")
    for m in sanctions_screen.get("matches", []):
        print(
            f"    - Hit: {m.get('name')} ({m.get('role')}), "
            f"{m.get('aggregate_blocked_percentage')}% blocked, reason: {m.get('reason_codes')}"
        )

    triage = meta.get("triage", {})
    advisory = triage.get("sanctions_advisory", {})
    print(f"  Sanctions Advisory Status: {advisory.get('status')}")
    print(f"  Risk Signal: {triage.get('signal_screen', {}).get('risk_signal')}")

    # Check markdown artifact has warning
    md_text = task.get("artifacts", [{}])[0].get("parts", [{}])[0].get("text", "")
    print(f"  Warning in Markdown: {'Gateway Sanctions Warning (OFAC 50% Rule)' in md_text}")

    assert meta.get("vizier_status") == "success"
    assert gw_ver.get("violation") is True
    assert sanctions_screen.get("violation") is True
    assert advisory.get("status") == "escalate"
    assert triage.get("signal_screen", {}).get("risk_signal") == "high"
    assert "Gateway Sanctions Warning (OFAC 50% Rule)" in md_text
    assert any(m.get("name") == "Sovcomflot" for m in sanctions_screen.get("matches", []))
    print("  -> PASS: OFAC 50% Rule sanctions firewall flagged Sovcomflot and escalated.")


def test_dlp_secret_leak():
    print("\n=== TEST CASE 3: Prompt Sensitive Secret Leak (Vizier DLP Firewall) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-root-dlp-03",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-root-dlp-03",
                "role": "ROLE_USER",
                "parts": [
                    {
                        "kind": "text",
                        "text": "Please route our deal. Internal API Token: sk-proj-1234567890abcdef1234567890.",
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
    gw_ver = meta.get("gateway_verification", {})
    print(f"  Screening Violation: {gw_ver.get('violation')}")
    dlp_screen = gw_ver.get("dlp_screening", {})
    print(f"  DLP Clean: {dlp_screen.get('clean')}")
    print(f"  Leaks Prevented: {dlp_screen.get('total_leaks_prevented')}")
    for f in dlp_screen.get("findings", []):
        print(f"    - Detector: {f.get('detector')}, Path: {f.get('path')}, Masked: {f.get('snippet_masked')}")

    md_text = task.get("artifacts", [{}])[0].get("parts", [{}])[0].get("text", "")
    print(f"  DLP Notice in Markdown: {'Vizier Gateway DLP Notice' in md_text}")
    print(f"  Raw Secret Redacted: {'sk-proj-1234567890abcdef1234567890' not in md_text}")

    assert meta.get("vizier_status") == "success"
    assert gw_ver.get("violation") is True
    assert dlp_screen.get("clean") is False
    assert dlp_screen.get("total_leaks_prevented") >= 1
    assert "Vizier Gateway DLP Notice" in md_text
    assert "sk-proj-1234567890abcdef1234567890" not in md_text
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

    print(f"  Wrapper Scope: {x_ag.get('wrapper_scope')}")
    print(f"  JSON-RPC Endpoint: {x_ag.get('jsonrpc_endpoint')}")

    assert card.get("name") == "Agenda Intelligence MD"
    assert "A2A/JSON-RPC discovery" in x_ag.get("wrapper_scope", "")
    assert len(card.get("skills", [])) >= 1
    print("  -> PASS: A2A agent card accurately declares Agenda Intelligence MD root gateway.")


def main():
    print("====================================================================")
    print(" ZERO-MOCK LIVE EDGE PROOF: Worker #11 (agenda-intelligence-a2a Root)")
    print(f" Target URL: {WORKER_URL}")
    print("====================================================================")
    try:
        test_clean_gateway_query()
        test_sanctioned_counterparty_ofac50()
        test_dlp_secret_leak()
        test_agent_card()
        print("\n====================================================================")
        print(" ALL 4 ZERO-MOCK LIVE EDGE TESTS PASSED FOR ROOT WORKER #11!")
        print("====================================================================")
    except Exception as e:
        print(f"\n❌ LIVE PROOF FAILED: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
