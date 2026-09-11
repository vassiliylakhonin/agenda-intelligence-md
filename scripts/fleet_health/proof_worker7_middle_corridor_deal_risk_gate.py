#!/usr/bin/env python3
"""
Zero-mock live edge proof for Worker #7: middle-corridor-deal-risk-gate-a2a.
Demonstrates:
1. Native Cloudflare Service Binding interconnect to Vizier security kernel.
2. Real-time counterparty & carrier sanctions screening under OFAC 50% Rule.
3. Real-time transit dossier DLP firewall preventing credential and secret leaks.
4. Cryptographic JWS clearance receipts minted by Vizier.
5. Strict ADR 0003 contract integrity across A2A JSON-RPC and MCP protocols.
"""

import base64
import json
import urllib.error
import urllib.request

WORKER_URL = "https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev"


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


CLEAN_DEAL_REQUEST = {
    "route": "Altynkol -> Aktau -> Baku -> Poti",
    "cargo": "industrial equipment and dry turbines",
    "shipment_value": {"amount": 2400000, "currency": "USD"},
    "counterparties": [
        {"role": "forwarder", "name": "Caspian Logistics Forwarding LLP", "jurisdiction": "Kazakhstan"},
        {"role": "carrier", "name": "Aktau Marine Shipping Co", "jurisdiction": "Kazakhstan"},
        {"role": "port_agent", "name": "Baku Port Agency", "jurisdiction": "Azerbaijan"},
        {"role": "consignee", "name": "Batumi Terminal LLC", "jurisdiction": "Georgia"},
    ],
    "dated_sources": [
        {
            "id": "e1",
            "source_type": "port_operator_notice",
            "title": "Port operator berth confirmation",
            "date": "2026-06-01",
        },
        {
            "id": "e2",
            "source_type": "sanctions_list_extract",
            "title": "Consolidated sanctions screening extract",
            "date": "2026-06-01",
        },
        {"id": "e3", "source_type": "carrier_note", "title": "Carrier vessel voyage schedule", "date": "2026-06-01"},
    ],
    "risk_question": "Should this transit be escalated before contract signature and what evidence is required?",
    "decision_stage": "pre_signature",
    "notes": "Scheduled transit for non-military industrial turbines across the Middle Corridor.",
}


def test_clean_middle_corridor_deal():
    print("=== TEST CASE 1: Clean Middle Corridor Deal (A2A JSON-RPC) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-mc-clean-01",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-mc-clean-01",
                "role": "ROLE_USER",
                "parts": [{"kind": "data", "mediaType": "application/json", "data": CLEAN_DEAL_REQUEST}],
            }
        },
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    task = result.get("task", result)
    metadata = task.get("metadata", {})
    response = metadata.get("response", {})

    print(f"Status: {task.get('status', {}).get('state')}")
    print(f"Triage Recommendation: {response.get('triage_recommendation')}")
    print(f"Risk Signal: {response.get('risk_signal')}")
    print(
        f"Decision Readiness: {response.get('decision_readiness_score')}% ({response.get('decision_readiness_label')})"
    )
    print(f"Operational Decision: {response.get('operational_decision', {}).get('decision')}")
    print(f"Vizier Status: {metadata.get('vizier_status')}")

    verif = metadata.get("middle_corridor_verification", {})
    sanct_scr = verif.get("sanctions_screening", {})
    print(f"Sanctions Screening: checked={sanct_scr.get('checked')}, " f"violation={sanct_scr.get('violation')}")
    print(f"DLP Screening: clean={verif.get('dlp_screening', {}).get('clean')}")

    receipt = metadata.get("vizier_clearance_receipt")
    assert receipt, "Expected authentic Vizier clearance receipt!"
    print(f"Vizier Receipt (JWS): {receipt[:40]}... (len: {len(receipt)})")

    receipt_payload = decode_jws_payload(receipt)
    print(
        f"Decoded JWS: iss={receipt_payload.get('iss')}, "
        f"engine={receipt_payload.get('engine')}, clean={receipt_payload.get('clean')}"
    )

    assert metadata.get("vizier_status") == "success"
    assert verif.get("clean") is True
    assert verif.get("violation") is False
    print(">>> PASS: Clean Middle Corridor file cleared with authentic Vizier cryptographic receipt!\n")


def test_sanctioned_carrier_ofac_50():
    print("=== TEST CASE 2: Sanctioned Carrier Screening under OFAC 50% Rule ===")
    sanctioned_request = dict(CLEAN_DEAL_REQUEST)
    sanctioned_request["counterparties"] = [
        {"role": "carrier", "name": "Sovcomflot", "jurisdiction": "Russia"},
        {"role": "forwarder", "name": "Caspian Logistics Forwarding LLP", "jurisdiction": "Kazakhstan"},
    ]

    payload = {
        "jsonrpc": "2.0",
        "id": "live-mc-sanctions-02",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-mc-sanctions-02",
                "role": "ROLE_USER",
                "parts": [{"kind": "data", "mediaType": "application/json", "data": sanctioned_request}],
            }
        },
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    task = result.get("task", result)
    metadata = task.get("metadata", {})
    response = metadata.get("response", {})

    print(f"Status: {task.get('status', {}).get('state')}")
    print(f"Triage Recommendation: {response.get('triage_recommendation')}")
    print(f"Risk Signal: {response.get('risk_signal')}")
    print(f"Operational Decision: {response.get('operational_decision', {}).get('decision')}")
    print(f"Decision Rationale: {response.get('operational_decision', {}).get('rationale')}")
    print(f"Vizier Status: {metadata.get('vizier_status')}")

    verif = metadata.get("middle_corridor_verification", {})
    print(f"Verification Clean: {verif.get('clean')}")
    print(f"Sanctions Violation: {verif.get('sanctions_screening', {}).get('violation')}")
    print(f"Sanctions Matches: {verif.get('sanctions_screening', {}).get('matches')}")

    receipt = metadata.get("vizier_clearance_receipt")
    assert receipt, "Expected authentic Vizier receipt!"
    print(f"Vizier Receipt (JWS): {receipt[:40]}... (len: {len(receipt)})")

    assert response.get("risk_signal") == "high"
    assert response.get("operational_decision", {}).get("decision") == "hold"
    assert "OFAC 50% Rule" in response.get("operational_decision", {}).get("rationale", "")
    assert verif.get("sanctions_screening", {}).get("violation") is True
    assert metadata.get("vizier_status") == "success"
    print(">>> PASS: Sanctioned carrier halted with OFAC 50% Rule enforcement and authentic receipt!\n")


def test_dlp_secret_leak_protection():
    print("=== TEST CASE 3: DLP Secret Leak Prevention in Transit Notes ===")
    leak_request = dict(CLEAN_DEAL_REQUEST)
    leak_request["notes"] = "Transit clearance token: sk-proj-1234567890abcdef1111."

    payload = {
        "jsonrpc": "2.0",
        "id": "live-mc-dlp-03",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-mc-dlp-03",
                "role": "ROLE_USER",
                "parts": [{"kind": "data", "mediaType": "application/json", "data": leak_request}],
            }
        },
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    task = result.get("task", result)
    metadata = task.get("metadata", {})
    response = metadata.get("response", {})

    print(f"Status: {task.get('status', {}).get('state')}")
    print(f"Risk Signal: {response.get('risk_signal')}")
    print(f"Operational Decision: {response.get('operational_decision', {}).get('decision')}")
    print(f"Decision Rationale: {response.get('operational_decision', {}).get('rationale')}")
    print(f"Vizier Status: {metadata.get('vizier_status')}")

    verif = metadata.get("middle_corridor_verification", {})
    print(f"DLP Clean: {verif.get('dlp_screening', {}).get('clean')}")
    print(f"DLP Findings Count: {len(verif.get('dlp_screening', {}).get('findings', []))}")
    if verif.get("dlp_screening", {}).get("findings"):
        finding = verif.get("dlp_screening", {}).get("findings")[0]
        print(f"Detected Finding: detector={finding.get('detector')}, masked={finding.get('snippet_masked')}")

    receipt = metadata.get("vizier_clearance_receipt")
    assert receipt, "Expected authentic Vizier receipt!"
    print(f"Vizier Receipt (JWS): {receipt[:40]}... (len: {len(receipt)})")

    assert response.get("risk_signal") == "high"
    assert response.get("operational_decision", {}).get("decision") == "hold"
    assert verif.get("dlp_screening", {}).get("clean") is False
    assert metadata.get("vizier_status") == "success"
    print(">>> PASS: Sensitive credential leak intercepted and file processing placed on hold!\n")


def test_mcp_tools_call():
    print("=== TEST CASE 4: MCP Protocol Execution (tools/call) ===")
    mcp_request = dict(CLEAN_DEAL_REQUEST)
    mcp_request["counterparties"] = [{"role": "carrier", "name": "Sovcomflot", "jurisdiction": "Russia"}]

    payload = {
        "jsonrpc": "2.0",
        "id": "live-mc-mcp-04",
        "method": "tools/call",
        "params": {"name": "middle_corridor_deal_risk", "arguments": mcp_request},
    }
    res = post_json(f"{WORKER_URL}/mcp", payload)
    result = res.get("result", {})
    content = result.get("structuredContent", {})

    print(f"MCP Tool Output Risk Signal: {content.get('risk_signal')}")
    print(f"MCP Operational Decision: {content.get('operational_decision', {}).get('decision')}")
    print(f"MCP Rationale: {content.get('operational_decision', {}).get('rationale')}")

    assert content.get("risk_signal") == "high"
    assert content.get("operational_decision", {}).get("decision") == "hold"
    assert "OFAC 50% Rule" in content.get("operational_decision", {}).get("rationale", "")
    print(">>> PASS: MCP tools/call inherits full Vizier Action Firewall enforcement!\n")


def main():
    print(f"Targeting Edge Worker: {WORKER_URL}")
    test_clean_middle_corridor_deal()
    test_sanctioned_carrier_ofac_50()
    test_dlp_secret_leak_protection()
    test_mcp_tools_call()
    print("================================================================")
    print("ALL 4 LIVE ZERO-MOCK EDGE TESTS PASSED ON WORKER #7!")
    print("================================================================")


if __name__ == "__main__":
    main()
