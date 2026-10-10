"""Exercise installed preflight CLIs in isolation with owner-only test data.

Run with python -I after installing [reviews,mcp-check]. No hosted tool calls,
real grants, human approvals, payments or refunds are used.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import agenda_intelligence
from agenda_intelligence.human_review import canonical_bytes

ROOT = Path(__file__).resolve().parents[1]


def call(module: str, path: Path, expected: int, *flags: str) -> dict:
    result = subprocess.run(
        [sys.executable, "-I", "-m", "agenda_intelligence." + module, str(path), *flags],
        cwd=path.parent,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == expected, result.stderr + result.stdout
    return json.loads(result.stdout)


def main() -> None:
    assert "site-packages" in Path(agenda_intelligence.__file__).resolve().parts, "Use an installed wheel"
    spec = importlib.util.spec_from_file_location("sandbox_checkout", ROOT / "examples/agent-checkout-readiness/run.py")
    assert spec and spec.loader
    sandbox = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sandbox)
    with tempfile.TemporaryDirectory(prefix="agenda-preflight-smoke-") as directory:
        path = Path(directory) / "input.json"
        trace = sandbox.build_trace()
        path.write_text(json.dumps(trace))
        assert call("checkout_check", path, 0, "--strict")["status"] == "ready_for_sandbox_review"
        trace["intent"]["variant_id"] = "wrong-variant"
        path.write_text(json.dumps(trace))
        assert call("checkout_check", path, 1, "--strict")["status"] == "hold"
        context = {"principal": "sandbox-owner", "agent": "sandbox-agent", "tenant": "sandbox-tenant"}
        request = {
            "agent": {"id": context["agent"], "owner": context["principal"]},
            "principal": {"id": context["principal"]},
            "action": {"type": "sandbox", "target": "sandbox:report", "parameters": {"tenant": context["tenant"]}},
            "authority": {"allowed_actions": ["sandbox"], "constraints": {"allowed_targets": ["sandbox:report"]}},
            "context": {"source": "rest", "request_id": "sandbox", "timestamp": None},
            "grant": "offline.fixture.only",
        }
        policy = {
            "decision": "ALLOW",
            "risk_score": 0,
            "reason_codes": [],
            "policy_results": [{"rule_id": "sandbox", "result": "PASS", "reason_code": None}],
            "receipt": {
                "id": "sandbox-receipt",
                "request_hash": hashlib.sha256(canonical_bytes(request)).hexdigest(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "decision": "ALLOW",
                "risk_score": 0,
                "policy_rule_ids": ["sandbox"],
                "reason_codes": [],
                "authority_provenance": "principal_signed",
                "grant": {
                    "issuer": context["principal"],
                    "subject": context["agent"],
                    "jti": "sandbox-grant",
                    "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
                },
            },
        }
        snapshot = {"request": request, "policy": policy, "context": context}
        path.write_text(json.dumps(snapshot))
        report = call("action_gate", path, 0)
        assert report["diagnostic_only"] and report["execution"] == "not_performed"
        request["action"]["parameters"]["tenant"] = "other-tenant"
        path.write_text(json.dumps(snapshot))
        assert call("action_gate", path, 1)["decision"] == "hold"
        config = {
            "transport": "stdio",
            "command": [sys.executable, "-I", "-m", "agenda_intelligence.mcp_stdio"],
            "auth": "none",
            "execute_examples": True,
            "examples": [{"tool": "list_signals", "arguments": {}, "expected_is_error": False}],
        }
        path.write_text(json.dumps(config))
        report = call("mcp_check", path, 0, "--strict")
        assert report["status"] == "passed" and report["client"] == "official-python-sdk"
        config["execute_examples"] = False
        path.write_text(json.dumps(config))
        assert call("mcp_check", path, 2, "--strict")["status"] == "incomplete"
    print(
        json.dumps(
            {
                "version": agenda_intelligence.__version__,
                "installed_preflight_smoke": "passed",
                "production_action_performed": False,
                "human_approval_simulated": False,
            }
        )
    )


if __name__ == "__main__":
    main()
