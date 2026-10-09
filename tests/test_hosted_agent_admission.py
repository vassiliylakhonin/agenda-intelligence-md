"""Exercise the additive hosted admission contract through the real Worker."""

import shutil
import subprocess
from pathlib import Path

import pytest


def test_standard_agent_admission_is_unevaluated_and_authentication_stays_closed():
    node = shutil.which("node")
    if not node:
        pytest.skip("Hosted MCP contract checks require Node.js")
    root = Path(__file__).resolve().parents[1]
    subprocess.run(
        [
            node,
            "--test",
            "deploy/cloudflare-worker/test/payment-journey.test.js",
            "deploy/cloudflare-worker/test/agent-onboarding.test.js",
        ],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
