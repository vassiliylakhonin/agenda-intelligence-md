"""Keep hosted payment golden and rejection contracts in the Python CI gate."""

import subprocess
from pathlib import Path


def test_signed_payment_execution_contract():
    worker = Path(__file__).resolve().parents[1] / "deploy/cloudflare-worker"
    result = subprocess.run(
        [
            "node",
            "--test",
            "--test-name-pattern=activation preserves|public hashes|caller capability|evidence helper",
            "test/paid-execution.test.js",
        ],
        cwd=worker,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
