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


def mutation_module():
    spec = importlib.util.spec_from_file_location("claim_mutations", ROOT / "evals/claim_checks/mutations.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_mutation_generator_is_frozen_and_edits_only_declared_span():
    module = mutation_module()
    suite = module.generate()
    assert suite == module.generate()
    frozen = json.loads((ROOT / "evals/claim_checks/mutation_cases.json").read_text())
    assert frozen == suite
    assert len(suite["cases"]) == 32
    for case in suite["cases"]:
        source = case["packet"]["sources"][0]["text"]
        claim = case["packet"]["claims"][0]["text"]
        if case["expect_flag"]:
            edit = case["mutation"]
            assert source[edit["start_char"] : edit["end_char"]] == edit["before"]
            assert claim == source[: edit["start_char"]] + edit["after"] + source[edit["end_char"] :]
            assert source != claim
        else:
            assert source == claim
            assert case["mutation"] is None


def test_mutation_metrics_keep_misses_and_undefined_precision_visible():
    module = mutation_module()
    suite = module.generate()
    # Test metric mechanics independently of current matcher performance.
    rows = [{"id": case["id"], "category": "missed" if case["expect_flag"] else "clear"} for case in suite["cases"]]
    metrics = module.summarize({"results": rows}, suite)["per_mutation_type"]
    assert set(metrics) == {"sign_flip", "bound_direction", "digit_transposition", "homoglyph"}
    for counts in metrics.values():
        assert counts == {"tp": 0, "fn": 4, "fp": 0, "tn": 4, "recall": 0.0, "precision": None}
    rows[0]["category"] = "false_positive"
    rows[1]["category"] = "caught"
    sign = module.summarize({"results": rows}, suite)["per_mutation_type"]["sign_flip"]
    assert sign["precision"] == 0.5
    assert sign["recall"] == 0.25


def test_mutation_run_counts_every_case_without_cherry_picking():
    module = mutation_module()
    spec = importlib.util.spec_from_file_location("claim_bench_mutations", ROOT / "evals/claim_checks/run.py")
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    result = module.summarize(runner.run(ROOT / "evals/claim_checks/mutation_cases.json", 1), module.generate())
    assert len(result["results"]) == 32
    for counts in result["per_mutation_type"].values():
        assert counts["tp"] + counts["fn"] == 4
        assert counts["fp"] + counts["tn"] == 4
