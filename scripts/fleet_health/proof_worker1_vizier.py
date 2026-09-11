#!/usr/bin/env python3
import json
import urllib.request
import urllib.error
import sys

BASE_URL = "https://vizier.vassiliy-lakhonin.workers.dev"
MASTER_KEY = "ec58711dc36374de8d3d264236a922ac15f10d9016fe0a2169156d8653e69e2f"

def post(endpoint, data, token=MASTER_KEY, headers_extra=None):
    url = f"{BASE_URL}{endpoint}"
    req_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) VizierEdgeClient/1.0",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    if headers_extra:
        req_headers.update(headers_extra)
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=req_headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw

def get(endpoint, token=MASTER_KEY, headers_extra=None):
    url = f"{BASE_URL}{endpoint}"
    req_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) VizierEdgeClient/1.0"
    }
    if token:
        req_headers["Authorization"] = f"Bearer {token}"
    if headers_extra:
        req_headers.update(headers_extra)
    req = urllib.request.Request(url, headers=req_headers, method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            content_type = resp.headers.get("Content-Type", "")
            data = resp.read().decode("utf-8")
            if "application/json" in content_type:
                return resp.status, json.loads(data)
            return resp.status, data
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw

print("=== STARTING LIVE ZERO-MOCK PROOF ===")
print(f"Target: {BASE_URL}\n")

# ----------------------------------------------------
# 1. PHASE 3: Web Security Console (HTML & UI)
# ----------------------------------------------------
print("--- 1. Testing Web Security Console (/console & /dashboard) ---")
status, html = get("/console", token=None)
assert status == 200, f"Expected 200, got {status}: {html}"
assert "Vizier Security Console" in html, "Console title missing"
assert "OFAC 50% Rule & Ownership Graph" in html, "OFAC tab missing"
assert "HITL Quorum Gate" in html, "Quorum tab missing"
assert "API Keys & Quotas" in html, "API Keys tab missing"
print("✓ GET /console returned HTTP 200 with complete HTML5 dashboard")

status, dash_html = get("/dashboard", token=None)
assert status == 200, f"Expected 200 on /dashboard, got {status}"
print("✓ GET /dashboard alias confirmed (HTTP 200)")

# ----------------------------------------------------
# 2. PHASE 1: OFAC 50% Rule Screening Endpoint
# ----------------------------------------------------
print("\n--- 2. Testing OFAC 50% Rule Endpoint (/v1/sanctions/screen-entity) ---")
# Case A: Entity owned 55% by blocked parties (Garantex Europe 35% + Tornado Cash 20%)
payload_blocked = {
    "entity_name": "Eurasia Import Export Ltd",
    "shareholders": [
        {"name": "Garantex Europe", "percentage": 35.0},
        {"name": "Tornado Cash", "percentage": 20.0},
        {"name": "Alice Clean", "percentage": 45.0}
    ]
}
status, res = post("/v1/sanctions/screen-entity", payload_blocked)
assert status == 200, f"Expected 200, got {status}: {res}"
assert res["violation"] is True, f"Expected violation: true, got {res}"
assert res["clean"] is False
assert "SANCTIONS_50_RULE_VIOLATION" in res["reason_codes"], f"Missing code: {res}"
assert res["aggregate_blocked_percentage"] == 55.0
print(f"✓ Blocked entity identified: aggregate={res['aggregate_blocked_percentage']}%, reason={res['reason_codes']}")
print(f"  Explanation: {res['explanation']}")

# Case B: Entity owned 45% (under 50% threshold)
payload_clean = {
    "entity_name": "Caspian Logistics GmbH",
    "shareholders": [
        {"name": "Garantex Europe", "percentage": 45.0},
        {"name": "Clean Partner", "percentage": 55.0}
    ]
}
status, res_clean = post("/v1/sanctions/screen-entity", payload_clean)
assert status == 200
assert res_clean["violation"] is False
assert res_clean["clean"] is True
assert res_clean["aggregate_blocked_percentage"] == 45.0
assert res_clean["reason_codes"] == []
print(f"✓ Under-threshold entity allowed: aggregate={res_clean['aggregate_blocked_percentage']}%, clean={res_clean['clean']}")

# ----------------------------------------------------
# 3. PHASE 2: Multi-Tenant B2B API Key Manager
# ----------------------------------------------------
print("\n--- 3. Testing Multi-Tenant API Key Manager & D1 Storage ---")
# Step 3.1: Create a new tenant key for org_fintech
key_payload = {
    "org_id": "org_fintech_edge",
    "name": "Live Proof Agent Key",
    "tier": "developer" # 10,000 monthly quota
}
status, new_key_res = post("/v1/admin/keys", key_payload)
assert status in (200, 201), f"Failed to create tenant key: {status}, {new_key_res}"
raw_key = new_key_res["key"]
key_id = new_key_res["id"]
assert raw_key.startswith("vz_live_"), f"Invalid key format: {raw_key}"
assert new_key_res["monthly_quota"] == 10000
print(f"✓ Created tenant key: ID={key_id}, Prefix={new_key_res['key_prefix']}, Quota={new_key_res['monthly_quota']}")

# Step 3.2: List keys for org_fintech_edge
status, list_res = get(f"/v1/admin/keys?org_id=org_fintech_edge")
assert status == 200
matching = [k for k in list_res["keys"] if k["id"] == key_id]
assert len(matching) == 1
print(f"✓ Listed keys in D1: found active key for org_fintech_edge")

# Step 3.3: Authenticate with the new tenant key at /v1/verify via X-Vizier-Key
verify_payload = {
    "agent": {"id": "agent-b2b-01", "owner": "org_fintech_edge"},
    "principal": {"id": "org_fintech_edge"},
    "action": {
        "type": "payment_transfer",
        "target": "vendor.global.example",
        "parameters": {"amount": 500, "currency": "USD"}
    },
    "authority": {
        "allowed_actions": ["payment_transfer"],
        "constraints": {"max_amount": 1000, "currency": "USD"}
    },
    "context": {
        "request_id": f"b2b-req-proof-1",
        "timestamp": "2026-09-11T15:00:00Z",
        "source": "rest"
    }
}
status, v_res = post("/v1/verify", verify_payload, token="", headers_extra={"X-Vizier-Key": raw_key})
assert status == 200, f"Tenant key auth failed: {status}, {v_res}"
assert v_res["decision"] == "ALLOW", f"Decision was {v_res}"
print(f"✓ Authenticated via X-Vizier-Key: decision={v_res['decision']}, receipt={v_res['receipt']['id']}")

# Step 3.4: Verify usage incremented in D1
status, list_after = get(f"/v1/admin/keys?org_id=org_fintech_edge")
assert status == 200
matching_after = [k for k in list_after["keys"] if k["id"] == key_id][0]
assert matching_after["current_usage"] >= 1, f"Usage was not incremented: {matching_after}"
print(f"✓ D1 usage counter verified: current_usage={matching_after['current_usage']}/{matching_after['monthly_quota']}")

# Step 3.5: Revoke key and verify access is immediately denied
del_req = urllib.request.Request(
    f"{BASE_URL}/v1/admin/keys/{key_id}",
    headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) VizierEdgeClient/1.0",
        "Authorization": f"Bearer {MASTER_KEY}"
    },
    method="DELETE"
)
with urllib.request.urlopen(del_req) as resp:
    assert resp.status == 200
print(f"✓ Revoked key {key_id}")

status, v_revoked = post("/v1/verify", verify_payload, token="", headers_extra={"X-Vizier-Key": raw_key})
assert status == 401, f"Expected 401 for revoked key, got {status}: {v_revoked}"
print(f"✓ Revoked key immediately rejected with HTTP 401")

print("\n=== ALL LIVE ZERO-MOCK TESTS PASSED SUCCESSFULLY ON CLOUDFLARE WORKERS EDGE ===")
