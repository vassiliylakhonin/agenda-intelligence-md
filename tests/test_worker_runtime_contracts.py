"""Validate real Worker MCP results with a full Draft 2020-12 validator."""

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
    assert len(responses) >= 13
    assert sum(response["isError"] is False for response in responses) >= 8
    for response in responses:
        if response["isError"] and response["payload"].get("error"):
            assert response["payload"]["error"] in {"INVALID_TOOL_INPUT", "INPUT_REQUIRED"}
            continue
        Draft202012Validator(response["schema"]).validate(response["payload"])
