"""Contract and CLI tests for the evidence-packet preflight."""

from __future__ import annotations

import copy
import json
import os
import subprocess
import sys
from pathlib import Path

from agenda_intelligence import mcp_server
from agenda_intelligence.mcp_stdio import TOOLS
from agenda_intelligence.services import check_evidence_packet

ROOT = Path(__file__).resolve().parents[1]
EXAMPLE = ROOT / "examples" / "evidence-packet" / "request.json"
MCP_EXAMPLE = ROOT / "examples" / "evidence-packet" / "mcp_client.py"
CLI = [sys.executable, "-m", "agenda_intelligence.cli"]
ENV = {**os.environ, "PYTHONPATH": str(ROOT / "src")}


def example_request() -> dict:
    return json.loads(EXAMPLE.read_text())


def run(*args: str, expect_zero: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(CLI + list(args), capture_output=True, text=True, cwd=ROOT, env=ENV)
    if expect_zero:
        assert result.returncode == 0, f"cmd failed ({result.returncode}): {result.stderr}\n{result.stdout}"
    return result


def test_complete_packet_reports_structure_without_factuality_claim():
    result = check_evidence_packet(example_request())

    assert result["valid"] is True
    response = result["response"]
    assert response["packet_status"] == "packet_complete"
    assert response["factuality_status"] == "not_assessed"
    assert response["counts"] == {
        "packet_complete": 2,
        "source_review_required": 0,
        "packet_incomplete": 0,
    }
    assert response["human_review_required"] is True
    assert response["owner_actions"] == []


def test_missing_source_makes_packet_incomplete():
    request = example_request()
    request["claims"][0]["source_ids"] = ["missing-source"]
    request["claims"][0]["quotes"] = []

    response = check_evidence_packet(request)["response"]

    claim = response["claims"][0]
    assert response["packet_status"] == "packet_incomplete"
    assert claim["missing_source_ids"] == ["missing-source"]
    assert "missing_source:missing-source" in claim["issues"]


def test_absent_quote_makes_packet_incomplete():
    request = example_request()
    request["claims"][0]["quotes"][0]["text"] = "a statement the source never makes"

    response = check_evidence_packet(request)["response"]

    claim = response["claims"][0]
    assert claim["packet_status"] == "packet_incomplete"
    assert claim["quote_checks"] == [{"source_id": "model-card", "status": "absent"}]


def test_unmatched_number_requires_source_review():
    request = example_request()
    request["claims"][1]["text"] = "The evaluation was completed on 2026-06-30 across 999 test cases."

    response = check_evidence_packet(request)["response"]

    claim = response["claims"][1]
    assert response["packet_status"] == "source_review_required"
    assert claim["packet_status"] == "source_review_required"
    assert claim["lexical_support"]["unmatched_numbers"] == ["999"]


def test_duplicate_ids_fail_at_service_boundary():
    request = example_request()
    request["sources"].append(copy.deepcopy(request["sources"][0]))

    result = check_evidence_packet(request)

    assert result["valid"] is False
    assert result["response"] is None
    assert result["errors"] == ["duplicate source_id values: model-card"]


def test_cli_check_routes_an_empty_claim_list_to_packet_validation(tmp_path: Path):
    path = tmp_path / "invalid-packet.json"
    path.write_text(json.dumps({"claims": [], "sources": []}))

    result = run("check", str(path), expect_zero=False)

    assert result.returncode == 1
    assert "should be non-empty" in result.stderr


def test_cli_check_prints_packet_json():
    result = run("check", str(EXAMPLE), "--format", "json")

    payload = json.loads(result.stdout)
    assert payload["packet_status"] == "packet_complete"
    assert payload["factuality_status"] == "not_assessed"


def test_cli_check_strict_fails_for_review_packet(tmp_path: Path):
    request = example_request()
    request["claims"][1]["text"] = "The evaluation was completed across 999 test cases."
    path = tmp_path / "review.json"
    path.write_text(json.dumps(request))

    result = run("check", str(path), "--strict", expect_zero=False)

    assert result.returncode == 1
    assert "source_review_required" in result.stdout


def test_cli_check_preserves_legacy_agenda_brief_validation():
    result = run("check", "examples/agenda-brief.json")

    assert "OK: agenda brief validates" in result.stdout


def test_primary_packet_preflight_is_registered_and_callable_over_mcp():
    assert "check_evidence_packet" in TOOLS
    spec = TOOLS["check_evidence_packet"]
    assert spec["inputSchema"]["required"] == ["packet_json"]
    assert spec["inputSchema"]["additionalProperties"] is False

    result = mcp_server.check_evidence_packet(example_request())
    assert result["valid"] is True
    assert result["response"]["packet_status"] == "packet_complete"
    assert result["response"]["factuality_status"] == "not_assessed"

    transported = spec["handler"]({"packet_json": example_request()})
    assert transported == result


def test_focused_mcp_example_runs_against_checkout():
    result = subprocess.run(
        [
            sys.executable,
            str(MCP_EXAMPLE),
            "--command",
            f"{sys.executable} -m agenda_intelligence.mcp_stdio",
        ],
        capture_output=True,
        text=True,
        cwd=ROOT,
        env=ENV,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {
        "packet_status": "packet_complete",
        "factuality_status": "not_assessed",
        "human_review_required": True,
        "counts": {
            "packet_complete": 2,
            "source_review_required": 0,
            "packet_incomplete": 0,
        },
    }
