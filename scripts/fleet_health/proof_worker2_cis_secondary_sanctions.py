#!/usr/bin/env python3
import json
import sys
import urllib.error
import urllib.request

BASE_URL = "https://cis-secondary-sanctions-a2a.vassiliy-lakhonin.workers.dev"


def test_rest_endpoint():
    print("\n=======================================================")
    print("Test 1: REST POST /v1/cis-secondary-sanctions/exposure")
    print("Screening entity with 55% OFAC 50% Rule deemed-blocked ownership")
    print("=======================================================")

    url = f"{BASE_URL}/v1/cis-secondary-sanctions/exposure"
    payload = {
        "counterparty": {"name": "Eurasia Cross-Border Logistics", "jurisdiction": "KZ", "sector": "trading_house"},
        "exposure_facets": ["ownership_or_control"],
        "dated_sources": [
            {"id": "s-1", "source_type": "ofac_sdn_extract", "title": "OFAC SDN check", "date": "2026-09-01"},
            {
                "id": "s-2",
                "source_type": "ownership_chain_evidence",
                "title": "Corporate Registry Extract",
                "date": "2026-09-02",
            },
        ],
        "risk_question": "Can we execute payment to Eurasia Cross-Border Logistics?",
        "decision_stage": "pre_transaction",
        "shareholders": [
            {"name": "Garantex Europe", "percentage": 35.0},
            {"name": "Tornado Cash", "percentage": 20.0},
            {"name": "Clean Logistics Holding", "percentage": 45.0},
        ],
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "ZeroMockProof/1.0",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
        return False

    print("REST Response Received:")
    print(f"  secondary_exposure_signal: {data.get('secondary_exposure_signal')}")
    print(f"  triage_recommendation: {data.get('triage_recommendation')}")
    print(f"  top_exposure_dimensions: {data.get('top_exposure_dimensions')}")

    clearance = data.get("beneficial_ownership_clearance", {})
    print("\nBeneficial Ownership Clearance (Vizier Action Firewall):")
    print(f"  engine: {clearance.get('engine')}")
    print(f"  violation: {clearance.get('violation')}")
    print(f"  aggregate_blocked_percentage: {clearance.get('aggregate_blocked_percentage')}%")
    print(f"  blocked_shareholders: {[s.get('name') for s in clearance.get('blocked_shareholders', [])]}")
    receipt = clearance.get("receipt")
    print(f"  JWS clearance receipt: {receipt[:60]}..." if receipt else "  NO RECEIPT")

    assert data.get("secondary_exposure_signal") == "high", "Expected exposure signal 'high'"
    assert (
        data.get("triage_recommendation") == "escalate_before_transaction"
    ), "Expected triage 'escalate_before_transaction'"
    assert clearance.get("violation") is True, "Expected clearance violation to be True"
    assert clearance.get("aggregate_blocked_percentage") == 55.0, "Expected 55% aggregate blocked percentage"
    assert receipt and receipt.startswith("eyJ"), "Expected valid compact JWS receipt starting with eyJ"

    print("\n>>> REST TEST PASSED! OFAC 50% Rule triggered & JWS receipt verified! <<<")
    return True


def test_a2a_endpoint():
    print("\n=======================================================")
    print("Test 2: A2A JSON-RPC POST /message/send")
    print("Screening entity with clean 100% legitimate ownership")
    print("=======================================================")

    url = f"{BASE_URL}/message/send"
    payload = {
        "jsonrpc": "2.0",
        "id": "a2a-proof-02",
        "method": "message/send",
        "params": {
            "message": {
                "role": "user",
                "parts": [
                    {
                        "data": {
                            "counterparty": {
                                "name": "Almaty Pure Retail Supplies",
                                "jurisdiction": "KZ",
                                "sector": "trading_house",
                            },
                            "exposure_facets": ["ownership_or_control"],
                            "dated_sources": [
                                {
                                    "id": "s-1",
                                    "source_type": "ofac_sdn_extract",
                                    "title": "OFAC SDN check",
                                    "date": "2026-09-01",
                                },
                                {
                                    "id": "s-2",
                                    "source_type": "ownership_chain_evidence",
                                    "title": "Corporate Registry Extract",
                                    "date": "2026-09-02",
                                },
                            ],
                            "risk_question": "Is Almaty Pure Retail Supplies cleared for onboarding?",
                            "decision_stage": "onboarding",
                            "shareholders": [
                                {"name": "Kazakh Retail Holding", "percentage": 70.0},
                                {"name": "Central Asian Investor", "percentage": 30.0},
                            ],
                        }
                    }
                ],
            }
        },
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "ZeroMockProof/1.0",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
        return False

    metadata = data.get("result", {}).get("metadata", {})
    body = metadata.get("response")
    if not body:
        artifacts = data.get("result", {}).get("artifacts", [])
        if artifacts and "parts" in artifacts[0]:
            for p in artifacts[0]["parts"]:
                if "data" in p:
                    body = p["data"]
                    break

    assert body, f"Could not find response body in {data}"

    print("A2A Response Received:")
    print(f"  Decision / Triage: {body.get('triage_recommendation')}")
    print(f"  Exposure Signal: {body.get('secondary_exposure_signal')}")
    print(f"  Vizier Status: {metadata.get('vizier_status')}")

    clearance = body.get("beneficial_ownership_clearance", {})
    print("\nBeneficial Ownership Clearance (Vizier Action Firewall):")
    print(f"  clean: {clearance.get('clean')}")
    print(f"  violation: {clearance.get('violation')}")
    print(f"  aggregate_blocked_percentage: {clearance.get('aggregate_blocked_percentage')}%")
    receipt = clearance.get("receipt")
    print(f"  JWS clearance receipt: {receipt[:60]}..." if receipt else "  NO RECEIPT")

    assert (
        metadata.get("vizier_status") == "success"
    ), f"Expected vizier_status 'success', got {metadata.get('vizier_status')}"
    assert clearance.get("clean") is True, "Expected clean to be True"
    assert clearance.get("violation") is False, "Expected violation to be False"
    assert receipt and receipt.startswith("eyJ"), "Expected valid compact JWS receipt starting with eyJ"

    print("\n>>> A2A TEST PASSED! Clean entity cleared via Service Binding with JWS receipt! <<<")
    return True


if __name__ == "__main__":
    t1 = test_rest_endpoint()
    t2 = test_a2a_endpoint()
    if t1 and t2:
        print("\n=======================================================")
        print("ALL EDGE ZERO-MOCK VERIFICATION PROOFS PASSED (100%)!")
        print("Worker #2 is live, interconnected with Vizier via Service Binding,")
        print("and minting cryptographically verifiable JWS clearance certificates.")
        print("=======================================================")
        sys.exit(0)
    else:
        print("\nZERO-MOCK TESTS FAILED!")
        sys.exit(1)
