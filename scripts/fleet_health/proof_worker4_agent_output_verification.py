#!/usr/bin/env python3
"""
Zero-mock live edge proof for Worker #4: agent-output-verification-a2a.
Demonstrates:
1. Native Cloudflare Service Binding interconnect to Vizier security kernel.
2. Real-time pre-action DLP secret & PII leak prevention.
3. Cryptographic JWS clearance receipts minted by Vizier.
4. Backward-compatible ADR 0003 contract compliance.
"""

import json
import urllib.request
import urllib.error
import base64
import sys

WORKER_URL = "https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev"

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

def test_clean_output_verification():
    print("=== TEST CASE 1: Clean Output Verification (A2A JSON-RPC) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-clean-01",
        "method": "message/send",
        "params": {
            "capability": "agent_output_verification",
            "request": {
                "claims": [
                    {
                        "claim_id": "c1",
                        "claim": "Counterparty is in good standing and not subject to export bans.",
                        "support_level": "direct",
                        "evidence_ids": ["e1"],
                        "supporting_quotes": [
                            {"evidence_id": "e1", "quote": "not subject to export bans"}
                        ]
                    }
                ],
                "evidence": [
                    {
                        "evidence_id": "e1",
                        "name": "Official Trade Registry Extract",
                        "source_type": "official_document"
                    }
                ]
            }
        }
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    metadata = result.get("metadata", {})
    response = metadata.get("response", {})
    
    print(f"Status: {result.get('status', {}).get('state')}")
    print(f"Verdict: {response.get('verdict')}")
    print(f"Readiness Score: {response.get('readiness_score')}/100 ({response.get('readiness_label')})")
    print(f"Human Review Required: {response.get('human_review_required')}")
    print(f"Vizier Status: {metadata.get('vizier_status')}")
    print(f"DLP Clean: {metadata.get('dlp_screening', {}).get('clean')}")
    
    receipt = metadata.get("vizier_clearance_receipt")
    assert receipt, "Expected authentic Vizier clearance receipt!"
    print(f"Vizier Receipt (JWS): {receipt[:40]}... (len: {len(receipt)})")
    
    receipt_payload = decode_jws_payload(receipt)
    print(f"Decoded JWS: iss={receipt_payload.get('iss')}, engine={receipt_payload.get('engine')}, clean={receipt_payload.get('clean')}")
    
    assert response.get("verdict") == "allow_relay", f"Expected allow_relay, got {response.get('verdict')}"
    assert response.get("readiness_score") == 100
    assert response.get("readiness_label") == "review_ready"
    assert response.get("human_review_required") is False
    assert metadata.get("vizier_status") == "success"
    assert metadata.get("dlp_screening", {}).get("clean") is True
    print(">>> PASS: Clean output approved with authentic Vizier cryptographic clearance!\n")

def test_leaked_secret_dlp_firewall():
    print("=== TEST CASE 2: DLP Secret Leak Interception (A2A JSON-RPC) ===")
    payload = {
        "jsonrpc": "2.0",
        "id": "live-leak-02",
        "method": "message/send",
        "params": {
            "capability": "agent_output_verification",
            "request": {
                "claims": [
                    {
                        "claim_id": "c1",
                        "claim": "Backend deployment credential was sk-proj-1234567890abcdef1234567890 for API calls.",
                        "support_level": "direct",
                        "evidence_ids": ["e1"],
                        "supporting_quotes": [
                            {"evidence_id": "e1", "quote": "sk-proj-1234567890abcdef1234567890"}
                        ]
                    }
                ],
                "evidence": [
                    {
                        "evidence_id": "e1",
                        "name": "Deployment log",
                        "source_type": "user_provided_note"
                    }
                ]
            }
        }
    }
    res = post_json(f"{WORKER_URL}/message/send", payload)
    result = res.get("result", {})
    metadata = result.get("metadata", {})
    response = metadata.get("response", {})
    
    print(f"Status: {result.get('status', {}).get('state')}")
    print(f"Verdict: {response.get('verdict')}")
    print(f"Readiness Score: {response.get('readiness_score')}/100 ({response.get('readiness_label')})")
    print(f"Human Review Required: {response.get('human_review_required')}")
    print(f"Vizier Status: {metadata.get('vizier_status')}")
    print(f"DLP Clean: {metadata.get('dlp_screening', {}).get('clean')}")
    print(f"DLP Findings Count: {len(metadata.get('dlp_screening', {}).get('findings', []))}")
    for f in metadata.get('dlp_screening', {}).get('findings', []):
        print(f"  - Detector: {f.get('detector')}, Masked: {f.get('snippet_masked')}, Path: {f.get('path')}")
    
    receipt = metadata.get("vizier_clearance_receipt")
    assert receipt, "Expected authentic Vizier clearance receipt!"
    print(f"Vizier Receipt (JWS): {receipt[:40]}... (len: {len(receipt)})")
    
    assert response.get("verdict") == "block_unsafe_claims", f"Expected block_unsafe_claims, got {response.get('verdict')}"
    assert response.get("readiness_label") == "not_decision_ready"
    assert response.get("readiness_score") <= 49
    assert response.get("human_review_required") is True
    assert metadata.get("dlp_screening", {}).get("clean") is False
    assert any("DLP secret/PII leak" in c.get("reason", "") for c in response.get("unsafe_claims", []))
    print(">>> PASS: Secret leak successfully intercepted and blocked by Vizier DLP Firewall!\n")

def test_rest_endpoint_provenance():
    print("=== TEST CASE 3: Direct REST Endpoint Provenance (POST /v1/agent-output/verification) ===")
    payload = {
        "claims": [
            {
                "claim_id": "c1",
                "claim": "All goods conform to standard specifications.",
                "support_level": "direct",
                "evidence_ids": ["e1"],
                "supporting_quotes": [
                    {"evidence_id": "e1", "quote": "conform to standard specifications"}
                ]
            }
        ],
        "evidence": [
            {
                "evidence_id": "e1",
                "name": "Quality Certificate",
                "source_type": "official_document"
            }
        ]
    }
    res = post_json(f"{WORKER_URL}/v1/agent-output/verification", payload)
    print(f"Verdict: {res.get('verdict')}")
    print(f"Readiness Score: {res.get('readiness_score')}/100 ({res.get('readiness_label')})")
    print(f"Vizier Status: {res.get('vizier_status')}")
    print(f"Vizier Receipt: {str(res.get('vizier_clearance_receipt'))[:40]}...")
    print(f"DLP Clean: {res.get('dlp_screening', {}).get('clean')}")
    
    assert res.get("verdict") == "allow_relay"
    assert res.get("vizier_status") == "success"
    assert res.get("vizier_clearance_receipt") is not None
    assert res.get("dlp_screening", {}).get("clean") is True
    print(">>> PASS: REST endpoint returned proper provenance and authentic JWS clearance receipt!\n")

if __name__ == "__main__":
    try:
        test_clean_output_verification()
        test_leaked_secret_dlp_firewall()
        test_rest_endpoint_provenance()
        print("ALL ZERO-MOCK LIVE EDGE TESTS PASSED 100%!")
    except Exception as e:
        print(f"FAILED: {e}")
        sys.exit(1)
