"""Run frozen diagnostic cases and the actual composite-action shell offline."""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import textwrap
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def test_diagnostic_suite_reports_known_misses_without_hiding_them():
    script = ROOT / "evals/claim_checks/run.py"
    spec = importlib.util.spec_from_file_location("claim_bench", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    result = module.run(script.with_name("cases.json"), repeats=1)
    assert result["counts"] == {"caught": 6, "missed": 2, "false_positive": 2, "clear": 4}
    assert {case["id"] for case in result["results"] if case["category"] == "missed"} == {
        "semantic-role-reversal",
        "semantic-causality",
    }
    assert all(case["median_ms"] >= 0 for case in result["results"])


@pytest.mark.parametrize("output_format", ["text", "json", "sarif"])
def test_action_captures_strict_failure_and_still_emits_comment_data(tmp_path, output_format):
    action = (ROOT / "action.yml").read_text()
    section = action.split("- name: Run evidence check/review", 1)[1].split("- name: Comment evidence summary", 1)[0]
    shell = textwrap.dedent(section.split("run: |\n", 1)[1])
    # A literal filename that would execute a command if interpolated into shell source.
    packet_path = tmp_path / "$(touch SHOULD_NOT_EXIST).json"
    packet_path.write_text(json.dumps({"claims": [{"claim_id": "c", "text": "No source supplied."}], "sources": []}))
    output = tmp_path / "output"
    env = {
        **os.environ,
        "INPUT_PATH": str(packet_path),
        "INPUT_STRICT": "true",
        "INPUT_COMMAND": "check",
        "INPUT_FORMAT": output_format,
        "PR_COMMENT": "true",
        "RUNNER_TEMP": str(tmp_path),
        "GITHUB_OUTPUT": str(output),
    }
    result = subprocess.run(
        ["bash", "-eo", "pipefail", "-c", shell], env=env, cwd=tmp_path, capture_output=True, text=True
    )
    assert result.returncode == 0, result.stderr
    assert output.read_text().strip() == "exit_code=1"
    assert not (tmp_path / "SHOULD_NOT_EXIST").exists()
    report = json.loads((tmp_path / "agenda-evidence-result.json").read_text())
    response = report.get("response", report)
    assert response["packet_status"] == "packet_incomplete"
    if output_format == "sarif":
        assert json.loads((tmp_path / "agenda-intelligence.sarif").read_text())["version"] == "2.1.0"
