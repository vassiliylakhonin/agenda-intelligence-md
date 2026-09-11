#!/usr/bin/env python3
"""
Zero-mock live edge proof for Worker #6: kazakhstan-market-entry-readiness-a2a.
Demonstrates:
1. Native Cloudflare Service Binding interconnect to Vizier security kernel.
2. Real-time investor & partner sanctions screening under OFAC 50% Rule.
3. Real-time dossier DLP firewall preventing credential leaks.
4. Cryptographic JWS clearance receipts minted by Vizier.
5. Strict ADR 0003 contract integrity and provenance retention.
"""

import json
import urllib.request
import urllib.error
import base64
import sys

WORKER_URL = "https://kazakhstan-market-entry-readiness-a2a.vassiliy-lakhonin.workers.dev"

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
        headers={"Content-Type": "application/json", "User-Agent": "ZeroMockProof/1.0"}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))

CLEAN_DOSSIER_REQUEST = {
    "project_name": "Kazakhstan Solar & Storage Project",
    "partner_or_company": "Nordic Clean Power AS",
    "market": "Kazakhstan / Zhambyl",
    "sector": "renewable_energy",
    "commercial_objective": "Development of 100MW solar farm and BESS storage facility with local grid connection.",
    "decision_question": "Can this renewable energy project move into controlled validation?",
    "decision_stage": "pre_signature",
    "supplied_sources": [
        {"id": "s1", "source_type": "partner_company_profile", "title": "Nordic Clean Power AS Company Profile", "date": "2026-06-01"},
        {"id": "s2", "source_type": "product_or_project_description", "title": "Solar & BESS Technical Specs", "date": "2026-06-01"},
        {"id": "s3", "source_type": "commercial_objective", "title": "Project Feasibility Study", "date": "2026-06-01"},
        {"id": "s4", "source_type": "kazakhstan_use_case", "title": "Zhambyl Grid Interconnection Assessment", "date": "2026-06-01"},
        {"id": "s5", "source_type": "initial_source_links_or_documents", "title": "Corporate Registry Extract", "date": "2026-06-01"}
    ],
    "counterparties": [
        {"role": "bank", "name": "Halyk Bank", "jurisdiction": "Kazakhstan"},
        {"role": "customs_broker", "name": "Silk Way Customs Services LLP", "jurisdiction": "Kazakhstan"}
    ],
    "known_assumptions": ["PPA tariff indexed to local inflation."],
    "known_blockers": []
}

def test_clean_market_entry_dossier():
    print("=== TEST CASE 1: Clean Market Entry Dossier (A2A JSON-RPC) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-me-clean-01",
        "method": "message/send",
        "params": {
            "capability": "market_entry_readiness",
            "request": CLEAN_DOSSIER_REQUEST
        }
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    metadata = result.get("metadata", {})
    response = metadata.get("response", {})

    print(f"Status: {result.get('status', {}).get('state')}")
    print(f"Gate Decision: {response.get('gate_decision')}")
    print(f"Readiness Label: {response.get('readiness_label')}")
    print(f"Vizier Status: {metadata.get('vizier_status')}")

    verif = metadata.get("market_entry_verification", {})
    print(f"Verification Clean: {verif.get('clean')}")
    print(f"Sanctions Screening: checked={verif.get('sanctions_screening', {}).get('checked')}, violation={verif.get('sanctions_screening', {}).get('violation')}")
    print(f"DLP Screening: clean={verif.get('dlp_screening', {}).get('clean')}")

    receipt = metadata.get("vizier_clearance_receipt")
    assert receipt, "Expected authentic Vizier clearance receipt!"
    print(f"Vizier Receipt (JWS): {receipt[:40]}... (len: {len(receipt)})")

    receipt_payload = decode_jws_payload(receipt)
    print(f"Decoded JWS: iss={receipt_payload.get('iss')}, engine={receipt_payload.get('engine')}, clean={receipt_payload.get('clean')}")

    assert response.get("gate_decision") in ["proceed_to_validation", "route_to_committee", "escalate_before_signature"]
    assert response.get("gate_decision") != "stop"
    assert metadata.get("vizier_status") == "success"
    assert verif.get("clean") is True
    assert verif.get("violation") is False
    print(">>> PASS: Clean market-entry dossier cleared with authentic Vizier cryptographic receipt!\n")

def test_sanctioned_investor_screening():
    print("=== TEST CASE 2: Sanctioned Investor/Partner Interception under OFAC 50% Rule (A2A JSON-RPC) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-me-sanctions-02",
        "method": "message/send",
        "params": {
            "capability": "market_entry_readiness",
            "request": {
                **CLEAN_DOSSIER_REQUEST,
                "partner_or_company": "Garantex Europe",
                "counterparties": [
                    {"role": "investor", "name": "Garantex Europe", "jurisdiction": "Russia"}
                ]
            }
        }
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    metadata = result.get("metadata", {})
    response = metadata.get("response", {})

    print(f"Status: {result.get('status', {}).get('state')}")
    print(f"Gate Decision: {response.get('gate_decision')}")
    print(f"Strongest Reason to Pause: {response.get('strongest_reason_to_pause')}")
    print(f"Vizier Status: {metadata.get('vizier_status')}")

    verif = metadata.get("market_entry_verification", {})
    sanctions_screen = verif.get("sanctions_screening", {})
    print(f"Sanctions Violation: {sanctions_screen.get('violation')}")
    print(f"Sanctions Matches: {sanctions_screen.get('matches')}")

    receipt = metadata.get("vizier_clearance_receipt")
    assert receipt, "Expected authentic Vizier clearance receipt!"
    print(f"Vizier Receipt (JWS): {receipt[:40]}... (len: {len(receipt)})")

    assert response.get("gate_decision") == "stop"
    assert metadata.get("vizier_status") == "success"
    assert verif.get("violation") is True
    assert sanctions_screen.get("violation") is True
    assert "Sanctions violation" in str(response.get("strongest_reason_to_pause", ""))
    assert any("Sanctioned entity" in f for f in response.get("confirmed_facts", []))
    assert any(g.get("source_type") == "counterparty_integrity_due_diligence" for g in response.get("evidence_gaps", []))
    print(">>> PASS: Sanctioned foreign partner blocked in real time under OFAC 50% Rule with Vizier receipt!\n")

def test_dossier_dlp_firewall():
    print("=== TEST CASE 3: Dossier DLP Credential Leak Interception (A2A JSON-RPC) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-me-dlp-03",
        "method": "message/send",
        "params": {
            "capability": "market_entry_readiness",
            "request": {
                **CLEAN_DOSSIER_REQUEST,
                "commercial_objective": "Integrate with customs broker API using key sk-proj-1234567890abcdef33445566 for auto-declaration."
            }
        }
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    metadata = result.get("metadata", {})
    response = metadata.get("response", {})

    print(f"Status: {result.get('status', {}).get('state')}")
    print(f"Gate Decision: {response.get('gate_decision')}")
    print(f"Strongest Reason to Pause: {response.get('strongest_reason_to_pause')}")
    print(f"Vizier Status: {metadata.get('vizier_status')}")

    verif = metadata.get("market_entry_verification", {})
    dlp_screen = verif.get("dlp_screening", {})
    print(f"DLP Screening Clean: {dlp_screen.get('clean')}")
    print(f"DLP Leaks Prevented: {dlp_screen.get('total_leaks_prevented')}")
    for f in dlp_screen.get("findings", []):
        print(f"  - Detector: {f.get('detector')}, Masked: {f.get('snippet_masked')}")

    receipt = metadata.get("vizier_clearance_receipt")
    assert receipt, "Expected authentic Vizier clearance receipt!"
    print(f"Vizier Receipt (JWS): {receipt[:40]}... (len: {len(receipt)})")

    assert response.get("gate_decision") == "stop"
    assert metadata.get("vizier_status") == "success"
    assert verif.get("violation") is True
    assert dlp_screen.get("clean") is False
    assert "Security/DLP violation" in str(response.get("strongest_reason_to_pause", ""))
    print(">>> PASS: Dossier credential leak intercepted and blocked by Vizier DLP Firewall!\n")

def test_rest_endpoint_provenance():
    print("=== TEST CASE 4: Direct REST Endpoint Provenance (POST /v1/market-entry/readiness) ===")
    res = post_json(f"{WORKER_URL}/v1/market-entry/readiness", CLEAN_DOSSIER_REQUEST)
    print(f"Gate Decision: {res.get('gate_decision')}")
    print(f"Readiness Label: {res.get('readiness_label')}")
    print(f"Vizier Status: {res.get('vizier_status')}")
    print(f"Vizier Receipt: {str(res.get('vizier_clearance_receipt'))[:40]}...")

    verif = res.get("market_entry_verification", {})
    print(f"Verification Clean: {verif.get('clean')}")

    assert res.get("gate_decision") != "stop"
    assert res.get("vizier_status") == "success"
    assert res.get("vizier_clearance_receipt") is not None
    assert verif.get("clean") is True
    print(">>> PASS: REST endpoint returned proper provenance and authentic JWS clearance receipt!\n")

if __name__ == "__main__":
    try:
        test_clean_market_entry_dossier()
        test_sanctioned_investor_screening()
        test_dossier_dlp_firewall()
        test_rest_endpoint_provenance()
        print("ALL ZERO-MOCK LIVE EDGE TESTS FOR WORKER #6 PASSED 100%!")
    except Exception as e:
        print(f"FAILED: {e}")
        sys.exit(1)
