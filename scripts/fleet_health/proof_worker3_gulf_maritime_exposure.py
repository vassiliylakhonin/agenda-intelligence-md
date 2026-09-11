#!/usr/bin/env python3
import json
import sys
import urllib.error
import urllib.request

BASE_URL = "https://gulf-maritime-exposure-a2a.vassiliy-lakhonin.workers.dev"


def test_rest_sanctioned_vessel():
    print("\n=======================================================")
    print("Test 1: REST POST /v1/gulf-maritime/exposure")
    print("Screening vessel with National Iranian Tanker Company (NITC) ownership")
    print("=======================================================")

    url = f"{BASE_URL}/v1/gulf-maritime/exposure"
    payload = {
        "vessel": {"name": "Gulf Shadow Carrier", "imo": "9123456", "flag": "PA"},
        "voyage": {"chokepoint": "strait_of_hormuz", "origin": "Kharg Island", "destination": "Unknown STS Location"},
        "exposure_facets": ["iran_oil_exposure", "chokepoint_disruption", "dark_fleet_indicators"],
        "counterparties": [{"name": "National Iranian Tanker Company", "role": "registered_owner"}],
        "dated_sources": [
            {
                "id": "src-1",
                "source_type": "vessel_registry_extract",
                "title": "Panama Maritime Authority Registry",
                "date": "2026-09-01",
            },
            {
                "id": "src-2",
                "source_type": "flag_registry_record",
                "title": "Flag State Confirmation",
                "date": "2026-09-02",
            },
        ],
        "risk_question": "Can we fixture this vessel for Persian Gulf transit?",
        "decision_stage": "pre_fixture",
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
    print(f"  exposure_signal: {data.get('exposure_signal')}")
    print(f"  triage_recommendation: {data.get('triage_recommendation')}")
    print(f"  top_exposure_dimensions: {data.get('top_exposure_dimensions')}")
    print(f"  vizier_status: {data.get('vizier_status')}")
    receipt = data.get("vizier_clearance_receipt")
    print(f"  vizier_clearance_receipt: {receipt[:60]}..." if receipt else "  NO RECEIPT")
    screening = data.get("maritime_screening", {})
    print(f"  maritime_screening: violation={screening.get('violation')}, clean={screening.get('clean')}")

    assert data.get("exposure_signal") == "high", f"Expected 'high', got {data.get('exposure_signal')}"
    assert (
        data.get("triage_recommendation") == "escalate_before_fixture"
    ), f"Expected 'escalate_before_fixture', got {data.get('triage_recommendation')}"
    assert any(
        "National Iranian Tanker Company" in d for d in data.get("top_exposure_dimensions", [])
    ), "Expected NITC in top_exposure_dimensions"
    assert data.get("vizier_status") == "success", f"Expected vizier_status 'success', got {data.get('vizier_status')}"
    assert receipt and receipt.startswith("eyJ"), "Expected valid JWS receipt"
    assert screening.get("violation") is True, "Expected maritime_screening.violation to be True"

    print("\n>>> REST TEST PASSED! Sanctioned maritime entity intercepted at edge with JWS receipt! <<<")
    return True


def test_a2a_clean_vessel():
    print("\n=======================================================")
    print("Test 2: A2A JSON-RPC POST /message/send")
    print("Screening clean Scandinavian vessel and legitimate counterparties")
    print("=======================================================")

    url = f"{BASE_URL}/message/send"
    payload = {
        "jsonrpc": "2.0",
        "id": "gulf-a2a-clean-02",
        "method": "message/send",
        "params": {
            "capability": "gulf_maritime_exposure",
            "request": {
                "vessel": {"name": "Nordic Sea Pioneer", "imo": "9876543", "flag": "DK"},
                "voyage": {"chokepoint": "strait_of_hormuz", "origin": "Ras Tanura", "destination": "Rotterdam"},
                "exposure_facets": ["chokepoint_disruption"],
                "counterparties": [
                    {"name": "Copenhagen Tankers Management ApS", "role": "manager", "jurisdiction": "DK"}
                ],
                "dated_sources": [
                    {
                        "id": "s1",
                        "source_type": "vessel_registry_extract",
                        "title": "Danish Maritime Authority Record",
                        "date": "2026-09-01",
                    },
                    {
                        "id": "s2",
                        "source_type": "flag_registry_record",
                        "title": "DIS Registry Confirmation",
                        "date": "2026-09-02",
                    },
                ],
                "risk_question": "Is Nordic Sea Pioneer cleared for transit?",
                "decision_stage": "pre_fixture",
            },
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
    body = metadata.get("response", {})
    print("A2A Response Received:")
    print(f"  triage_recommendation: {body.get('triage_recommendation')}")
    print(f"  exposure_signal: {body.get('exposure_signal')}")
    print(f"  vizier_status: {metadata.get('vizier_status')}")
    receipt = metadata.get("vizier_clearance_receipt")
    print(f"  vizier_clearance_receipt: {receipt[:60]}..." if receipt else "  NO RECEIPT")
    screening = metadata.get("maritime_screening", {})
    print(f"  maritime_screening: clean={screening.get('clean')}, violation={screening.get('violation')}")

    assert (
        metadata.get("vizier_status") == "success"
    ), f"Expected vizier_status 'success', got {metadata.get('vizier_status')}"
    assert receipt and receipt.startswith("eyJ"), "Expected valid JWS receipt"
    assert screening.get("violation") is False, "Expected violation to be False"
    assert screening.get("clean") is True, "Expected clean to be True"

    print("\n>>> A2A TEST PASSED! Clean maritime voyage cleared via Service Binding with JWS receipt! <<<")
    return True


if __name__ == "__main__":
    t1 = test_rest_sanctioned_vessel()
    t2 = test_a2a_clean_vessel()
    if t1 and t2:
        print("\n=======================================================")
        print("ALL EDGE ZERO-MOCK MARITIME VERIFICATION PROOFS PASSED (100%)!")
        print("Worker #3 is live, interconnected with Vizier via Service Binding,")
        print("and minting cryptographically verifiable JWS clearance certificates.")
        print("=======================================================")
        sys.exit(0)
    else:
        print("\nMARITIME TESTS FAILED!")
        sys.exit(1)
