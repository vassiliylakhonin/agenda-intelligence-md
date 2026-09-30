"""Validate real Worker MCP results with a full Draft 2020-12 validator."""

import copy
import json
import shutil
import subprocess
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator


def test_worker_tools_conform_to_published_output_schemas():
    node = shutil.which("node")
    if not node:
        pytest.skip("Worker protocol tests need Node.js")
    root = Path(__file__).resolve().parents[1]
    run = subprocess.run(
        [node, "deploy/cloudflare-worker/scripts/check-runtime-contracts.js"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    responses = json.loads(run.stdout)
    assert len(responses) >= 23
    new_tools = {
        "agent_financial_pre_sign_check",
        "m2m_escrow_arbitration_ruling",
        "strategic_risk_triage",
        "corridor_sanctions_assistant",
        "fleet_directory",
    }
    assert new_tools <= {item["tool"] for item in responses if item["isError"] is False}
    assert sum(response["isError"] is False for response in responses) >= 8
    for response in responses:
        payload = response["payload"]
        if response["isError"] and (
            payload.get("error") or payload.get("status", {}).get("state") == "TASK_STATE_INPUT_REQUIRED"
        ):
            if not payload.get("error"):
                assert payload["metadata"].get("errors")
                continue
            assert response["payload"]["error"] in {"INVALID_TOOL_INPUT", "INPUT_REQUIRED"}
            continue
        Draft202012Validator(response["schema"]).validate(response["payload"])

        if response["tool"] in new_tools and response["isError"] is False:
            # Deleting the service result or changing a required typed field must
            # fail: the catalog is a useful contract, not an unconstrained object.
            broken = copy.deepcopy(payload)
            if "metadata" in broken:
                broken["metadata"]["response"] = {}
            elif response["tool"] == "fleet_directory":
                broken["gates"] = "not-a-directory"
            elif response["tool"] == "strategic_risk_triage":
                broken["signal_screen"] = {}
            else:
                broken["human_review_required"] = False
            assert list(Draft202012Validator(response["schema"]).iter_errors(broken))
