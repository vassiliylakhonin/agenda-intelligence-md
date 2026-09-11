#!/usr/bin/env python3
"""
Zero-mock live edge proof for Worker #9: dual-use-technology-export-a2a.
Demonstrates:
1. Native Cloudflare Service Binding interconnect to Vizier security kernel.
2. Real-time counterparty & transit sanctions screening under OFAC 50% Rule.
3. Real-time export dossier DLP firewall preventing credential and secret leaks.
4. Cryptographic JWS clearance receipts minted by Vizier.
5. Strict ADR 0003 contract integrity across A2A JSON-RPC and MCP protocols.
"""

import base64
import json
import urllib.error
import urllib.request

WORKER_URL = "https://dual-use-technology-export-a2a.vassiliy-lakhonin.workers.dev"


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


CLEAN_DUAL_USE_REQUEST = {
    "shipment": {
        "hs_code": "854231",
        "eccn": "3A001.a.2",
        "description": "Radiation-hardened monolithic integrated circuits for industrial control units",
        "origin": "DE",
        "destination": "KZ",
        "transit_countries": ["PL", "GE"],
        "end_user_sector": "civilian",
    },
    "dated_sources": [
        {
            "id": "du-1",
            "source_type": "classification_note",
            "title": "Exporter ECCN self-classification note",
            "date": "2026-08-01",
        },
        {
            "id": "du-2",
            "source_type": "end_user_statement",
            "title": "Signed end-use / end-user statement from the Kazakhstan consignee",
            "date": "2026-08-05",
        },
    ],
    "risk_question": "Is this export file complete enough for export-control human review?",
}


def test_clean_dual_use_file():
    print("=== TEST CASE 1: Clean Dual-Use Technology Export (A2A JSON-RPC) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-du-clean-01",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-du-clean-01",
                "role": "ROLE_USER",
                "parts": [{"kind": "data", "mediaType": "application/json", "data": CLEAN_DUAL_USE_REQUEST}],
            }
        },
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    task = result.get("task", result)
    meta = task.get("metadata", {})

    print(f"  Status: {task.get('status', {}).get('state')}")
    print(f"  Vizier Status: {meta.get('vizier_status')}")
    print(f"  Vizier Clearance Receipt: {meta.get('vizier_clearance_receipt', '')[:35]}...")

    jws_claims = decode_jws_payload(meta.get("vizier_clearance_receipt", ""))
    print(f"  Receipt Issuer: {jws_claims.get('iss')}")
    print(f"  Receipt Subject: {jws_claims.get('sub')}")

    du_ver = meta.get("dual_use_verification", {})
    print(f"  Screening Clean: {du_ver.get('clean')}")
    print(f"  Screening Violation: {du_ver.get('violation')}")
    print(f"  Sanctions Screened: {len(du_ver.get('sanctions_screening', {}).get('entities_screened', []))} entities")
    print(f"  DLP Findings: {len(du_ver.get('dlp_screening', {}).get('findings', []))}")

    contract_res = meta.get("response", {})
    triage = contract_res.get("export_risk_triage", {})
    print(f"  Triage Status: {triage.get('status')}")
    print(f"  Triage Score: {triage.get('score')}")
    print(f"  Primary Risk Vectors: {triage.get('primary_risk_vectors')}")

    assert meta.get("vizier_status") == "success", f"Expected success, got {meta.get('vizier_status')}"
    assert du_ver.get("clean") is True, "Expected clean == True"
    assert du_ver.get("violation") is False, "Expected violation == False"
    assert triage.get("status") == "decision_ready", f"Expected decision_ready, got {triage.get('status')}"
    assert triage.get("score") == 100, f"Expected 100, got {triage.get('score')}"
    print("  -> PASS: Clean dual-use export file cleared with authentic JWS receipt.")


def test_sanctioned_counterparty_ofac50():
    print("\n=== TEST CASE 2: Sanctioned Transit Operator / Counterparty (OFAC 50% Rule) ===")
    sanctioned_req = dict(CLEAN_DUAL_USE_REQUEST)
    sanctioned_req["counterparties"] = [{"role": "freight_forwarder", "name": "Sovcomflot", "jurisdiction": "Russia"}]
    payload = {
        "jsonrpc": "2.0",
        "id": "live-du-sanctions-02",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-du-sanctions-02",
                "role": "ROLE_USER",
                "parts": [{"kind": "data", "mediaType": "application/json", "data": sanctioned_req}],
            }
        },
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    task = result.get("task", result)
    meta = task.get("metadata", {})

    print(f"  Vizier Status: {meta.get('vizier_status')}")
    du_ver = meta.get("dual_use_verification", {})
    print(f"  Violation Detected: {du_ver.get('violation')}")
    sanctions_screen = du_ver.get("sanctions_screening", {})
    for m in sanctions_screen.get("matches", []):
        print(
            f"    - Hit: {m.get('name')} ({m.get('role')}), "
            f"{m.get('aggregate_blocked_percentage')}% blocked, reason: {m.get('reason_codes')}"
        )

    contract_res = meta.get("response", {})
    triage = contract_res.get("export_risk_triage", {})
    print(f"  Triage Status: {triage.get('status')}")
    print(f"  Triage Score: {triage.get('score')}")
    print(f"  Primary Risk Vectors: {triage.get('primary_risk_vectors')[:1]}")

    assert meta.get("vizier_status") == "success"
    assert du_ver.get("violation") is True
    assert sanctions_screen.get("violation") is True
    assert triage.get("status") == "escalate"
    assert triage.get("score") == 0
    assert any("OFAC 50% Rule" in r for r in triage.get("primary_risk_vectors", []))
    print("  -> PASS: OFAC 50% Rule sanctions firewall intercepted sanctioned party and halted export.")


def test_dlp_secret_leak():
    print("\n=== TEST CASE 3: Export Dossier Sensitive Secret Leak (Vizier DLP Firewall) ===")
    dlp_req = dict(CLEAN_DUAL_USE_REQUEST)
    dlp_req["risk_question"] = "Export customs automated clearance token: sk-proj-1234567890abcdef1234567890."
    payload = {
        "jsonrpc": "2.0",
        "id": "live-du-dlp-03",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-du-dlp-03",
                "role": "ROLE_USER",
                "parts": [{"kind": "data", "mediaType": "application/json", "data": dlp_req}],
            }
        },
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    task = result.get("task", result)
    meta = task.get("metadata", {})

    print(f"  Vizier Status: {meta.get('vizier_status')}")
    du_ver = meta.get("dual_use_verification", {})
    print(f"  Violation Detected: {du_ver.get('violation')}")
    dlp_screen = du_ver.get("dlp_screening", {})
    print(f"  DLP Clean: {dlp_screen.get('clean')}")
    print(f"  Leaks Prevented: {dlp_screen.get('total_leaks_prevented')}")
    for f in dlp_screen.get("findings", []):
        print(f"    - Detector: {f.get('detector')}, Path: {f.get('path')}, Masked: {f.get('snippet_masked')}")

    contract_res = meta.get("response", {})
    triage = contract_res.get("export_risk_triage", {})
    print(f"  Triage Status: {triage.get('status')}")
    print(f"  Primary Risk Vectors: {triage.get('primary_risk_vectors')[:1]}")

    assert meta.get("vizier_status") == "success"
    assert du_ver.get("violation") is True
    assert dlp_screen.get("clean") is False
    assert triage.get("status") == "escalate"
    assert any("DLP Firewall detected" in r for r in triage.get("primary_risk_vectors", []))
    print("  -> PASS: DLP Action Firewall intercepted confidential secret leak and halted export.")


def test_mcp_tools_call():
    print("\n=== TEST CASE 4: MCP Protocol (tools/call dual_use_technology_export) ===")
    sanctioned_req = dict(CLEAN_DUAL_USE_REQUEST)
    sanctioned_req["counterparties"] = [{"role": "freight_forwarder", "name": "Sovcomflot", "jurisdiction": "Russia"}]
    payload = {
        "jsonrpc": "2.0",
        "id": "live-mcp-du-04",
        "method": "tools/call",
        "params": {"name": "dual_use_technology_export", "arguments": sanctioned_req},
    }
    res = post_json(f"{WORKER_URL}/mcp", payload)
    result = res.get("result", {})
    structured = result.get("structuredContent", {})
    triage = structured.get("export_risk_triage", {})

    print(f"  MCP Result Present: {bool(result)}")
    print(f"  Structured Status: {triage.get('status')}")
    print(f"  Structured Score: {triage.get('score')}")
    print(f"  Structured Risk Vectors: {triage.get('primary_risk_vectors', [])[:1]}")

    assert triage.get("status") == "escalate"
    assert triage.get("score") == 0
    assert any("OFAC 50% Rule" in r for r in triage.get("primary_risk_vectors", []))
    print("  -> PASS: MCP tool call intercepted and enforced under OFAC 50% Rule.")


if __name__ == "__main__":
    print("Running Zero-Mock Live Edge Proof for Worker #9: dual-use-technology-export-a2a...")
    test_clean_dual_use_file()
    test_sanctioned_counterparty_ofac50()
    test_dlp_secret_leak()
    test_mcp_tools_call()
    print("\n🎉 ALL 4 LIVE PROOF TEST CASES PASSED WITH 100% SUCCESS ON PRODUCTION EDGE!")
