"""Exercise the real fleet proof against required-mode HTTP responses."""

import importlib.util
import io
import json
from pathlib import Path
from urllib.error import HTTPError

import pytest

PROOF = Path(__file__).resolve().parents[1] / "scripts/fleet_health/proof_worker1_vizier.py"


class Response(io.BytesIO):
    def __init__(self, data):
        super().__init__((json.dumps(data) if isinstance(data, dict) else data).encode())
        self.status = 200
        self.headers = {"Content-Type": "application/json" if isinstance(data, dict) else "text/html"}


@pytest.mark.parametrize("failure", [None, "allow", "wrong-reason", "tenant-auth", "optional", "bad-quota"])
def test_required_mode_health_and_cleanup(monkeypatch, failure):
    monkeypatch.setenv("VIZIER_API_KEY", "test-only")
    spec = importlib.util.spec_from_file_location("vizier_health_fixture", PROOF)
    proof = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(proof)
    state = {"created": False, "revoked": False}

    def fetch(req, **kwargs):
        path = req.full_url.split(".dev")[-1]
        if path == "/docs":
            return Response(
                {"delegation": {"mode": "optional" if failure == "optional" else "required", "grant_required": True}}
            )
        if path in ["/console", "/dashboard"]:
            return Response(
                "Vizier Security Console OFAC 50% Rule & Ownership Graph HITL Quorum Gate API Keys & Quotas"
            )
        if path == "/v1/sanctions/screen-entity":
            blocked = json.loads(req.data)["entity_name"] == "Eurasia Import Export Ltd"
            return Response(
                {
                    "violation": blocked,
                    "clean": not blocked,
                    "aggregate_blocked_percentage": 55.0 if blocked else 45.0,
                    "reason_codes": ["SANCTIONS_50_RULE_VIOLATION"] if blocked else [],
                    "explanation": "fixture",
                }
            )
        if path == "/v1/admin/keys":
            state["created"] = True
            return Response(
                {
                    "key": "vz_live_fixture",
                    "id": "fixture-id",
                    "key_prefix": "vz_live_",
                    "monthly_quota": 1 if failure == "bad-quota" else 10000,
                }
            )
        if path.startswith("/v1/admin/keys?"):
            return Response({"keys": [{"id": "fixture-id", "current_usage": 1, "monthly_quota": 10000}]})
        if path == "/v1/admin/keys/fixture-id" and req.method == "DELETE":
            state["revoked"] = True
            return Response({"ok": True})
        if path == "/v1/verify":
            if state["revoked"] or failure == "tenant-auth":
                raise HTTPError(req.full_url, 401, "unauthorized", {}, io.BytesIO(b'{"error":"unauthorized"}'))
            assert req.headers["X-vizier-key"] == "vz_live_fixture"
            assert "grant" not in json.loads(req.data)
            return Response(
                {
                    "decision": "ALLOW" if failure == "allow" else "BLOCK",
                    "reason_codes": ["TARGET_NOT_ALLOWED" if failure == "wrong-reason" else "GRANT_REQUIRED"],
                    "receipt": {"id": "vrf_fixture"},
                }
            )
        raise AssertionError("Unexpected request " + path)

    monkeypatch.setattr(proof.urllib.request, "urlopen", fetch)
    if failure:
        with pytest.raises(AssertionError):
            proof.main()
    else:
        proof.main()
    assert state["created"] is (failure != "optional")
    assert state["revoked"] is state["created"]


def test_missing_protected_credential_fails_before_network(monkeypatch):
    monkeypatch.delenv("VIZIER_API_KEY", raising=False)
    spec = importlib.util.spec_from_file_location("vizier_health_missing_key", PROOF)
    proof = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(proof)
    monkeypatch.setattr(proof.urllib.request, "urlopen", lambda *args, **kwargs: pytest.fail("must not send request"))
    with pytest.raises(SystemExit, match="protected storage"):
        proof.main()
