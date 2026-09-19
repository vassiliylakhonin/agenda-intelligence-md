#!/usr/bin/env python3
"""Read-only health and synthetic safety proofs for newly configured Workers."""

from __future__ import annotations

import json
import sys
import urllib.request


def request_json(origin: str, path: str, payload: dict | None = None) -> dict:
    request = urllib.request.Request(
        origin + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Content-Type": "application/json", "User-Agent": "agenda-intelligence-fleet-health/1.0"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        if response.status != 200:
            raise AssertionError(f"Unexpected HTTP status {response.status}")
        return json.load(response)


def check_worker(name: str) -> None:
    origin = f"https://{name}.vassiliy-lakhonin.workers.dev"
    health = request_json(origin, "/health")
    assert health.get("profile"), "Worker must expose its profile"
    if name == "agent-financial-guard-a2a":
        verdict = request_json(
            origin,
            "/v1/agent-financial/pre-sign-check",
            {
                "run_id": "fleet-health-untrusted-velocity",
                "transaction": {
                    "network": "base",
                    "token": "USDC",
                    "amount_usd": 1,
                    "recipient": "0x1111111111111111111111111111111111111111",
                },
                "intent": {"prompt": "Synthetic evidence check; do not execute a transaction"},
                "policy_limits": {"velocity_24h_usd": 0, "daily_velocity_limit_usd": 99999999},
            },
        )["financial_guard_verdict"]
        assert verdict["decision"] == "step_up_human_required", "Untrusted velocity must not authorize spending"
        assert verdict["vizier_clearance_receipt"] is None, "No invented clearance receipt"
    elif name == "m2m-escrow-arbiter-a2a":
        ruling = request_json(
            origin,
            "/v1/m2m-escrow/evaluate-dispute",
            {
                "escrow_id": "fleet-health-schema-mismatch",
                "deal_terms": {
                    "buyer_id": "synthetic-buyer",
                    "seller_id": "synthetic-seller",
                    "amount_usd": 1,
                    "currency": "USDC",
                    "deadline_utc": "2026-10-01T00:00:00Z",
                    "arbitration_policy": "all_or_nothing",
                },
                "specification": {
                    "deliverable_type": "json_data",
                    "expected_schema": {"type": "object", "required": ["required_field"]},
                },
                "delivery_submission": {"submitted_at": "2026-09-19T00:00:00Z", "artifact_data": {}},
            },
        )["arbitration_ruling"]
        assert ruling["checks"]["schema_verified"] is False, "Required schema fields must be checked"
        assert ruling["ruling"] != "RELEASE_TO_SELLER", "Invalid delivery must not release funds"
        assert ruling["vizier_clearance_receipt"] is None, "No invented clearance receipt"
    print(f"PASS {name}: health and applicable safety checks")


if __name__ == "__main__":
    check_worker(sys.argv[1])
