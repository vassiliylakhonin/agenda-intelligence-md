"""Contract tests for the grounded_check service capability and CLI command."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from agenda_intelligence.services import grounded_check

ROOT = Path(__file__).resolve().parents[1]
CLI = [sys.executable, "-m", "agenda_intelligence.cli"]
ENV = {**os.environ, "PYTHONPATH": str(ROOT / "src")}
EXAMPLE_REQUEST = ROOT / "examples" / "grounded-check" / "request.json"

CORPUS_TEXT = (
    "Synthetic illustrative text. The operator association reported that container transit "
    "grew 62 percent in 2024 across the Middle Corridor. Total cargo volume reached 4.5 million "
    "tonnes in 2024, up from 2.8 million tonnes the year before."
)


def _request(claims: list[dict]) -> dict:
    return {
        "topic": "test",
        "claims": claims,
        "corpus": [{"corpus_id": "doc1", "title": "Note", "text": CORPUS_TEXT}],
    }


def run(*args: str, expect_zero: bool = True) -> subprocess.CompletedProcess[str]:
    res = subprocess.run(CLI + list(args), capture_output=True, text=True, cwd=ROOT, env=ENV)
    if expect_zero:
        assert res.returncode == 0, f"cmd failed ({res.returncode}): {res.stderr}\n{res.stdout}"
    return res


# ---------- golden ----------


def test_grounded_claim_with_verbatim_quote():
    result = grounded_check(
        _request(
            [
                {
                    "claim_id": "c1",
                    "claim_text": "Container transit grew 62 percent in 2024 across the Middle Corridor.",
                    "quotes": [{"corpus_id": "doc1", "quote": "container transit grew 62 percent in 2024"}],
                }
            ]
        )
    )
    assert result["valid"]
    response = result["response"]
    assert response["grounding_signal"] == "grounded"
    item = response["results"][0]
    assert item["grounding_status"] == "grounded"
    assert item["quote_checks"] == [{"corpus_id": "doc1", "status": "present"}]
    assert item["best_passage"]["corpus_id"] == "doc1"
    assert item["unmatched_numbers"] == []
    assert response["human_review_required"] is True
    assert "factually true" in response["not_advice_notice"]


def test_ungrounded_claim_and_unmatched_number():
    result = grounded_check(
        _request(
            [
                {
                    "claim_id": "c1",
                    "claim_text": "Regulators approved a dedicated corridor subsidy of 900 million euros.",
                }
            ]
        )
    )
    assert result["valid"]
    response = result["response"]
    item = response["results"][0]
    assert item["grounding_status"] == "ungrounded"
    assert "900" in item["unmatched_numbers"]
    assert response["grounding_signal"] == "ungrounded"
    assert any("claim c1" in action for action in response["owner_actions"])


def test_misquote_forces_ungrounded():
    result = grounded_check(
        _request(
            [
                {
                    "claim_id": "c1",
                    "claim_text": "Container transit grew 62 percent in 2024 across the Middle Corridor.",
                    "quotes": [{"corpus_id": "doc1", "quote": "container transit grew 82 percent in 2024"}],
                }
            ]
        )
    )
    item = result["response"]["results"][0]
    assert item["quote_checks"][0]["status"] == "absent"
    assert item["grounding_status"] == "ungrounded"


def test_unmatched_number_caps_grounded_at_weak():
    result = grounded_check(
        _request(
            [
                {
                    "claim_id": "c1",
                    # High term overlap with the corpus but a number the corpus never states.
                    "claim_text": "Container transit across the Middle Corridor reached 9.9 million tonnes in 2024.",
                }
            ]
        )
    )
    item = result["response"]["results"][0]
    assert "9.9" in item["unmatched_numbers"]
    assert item["grounding_status"] in {"weakly_grounded", "ungrounded"}
    assert item["grounding_status"] != "grounded"


def test_quote_against_unknown_corpus_id():
    result = grounded_check(
        _request(
            [
                {
                    "claim_id": "c1",
                    "claim_text": "Container transit grew 62 percent in 2024.",
                    "quotes": [{"corpus_id": "doc-missing", "quote": "container transit grew 62 percent"}],
                }
            ]
        )
    )
    item = result["response"]["results"][0]
    assert item["quote_checks"][0]["status"] == "missing_corpus_text"


def test_example_request_is_valid_and_mixed():
    request = json.loads(EXAMPLE_REQUEST.read_text())
    result = grounded_check(request)
    assert result["valid"]
    response = result["response"]
    statuses = {item["claim_id"]: item["grounding_status"] for item in response["results"]}
    assert statuses["c1"] == "grounded"
    assert statuses["c3"] == "ungrounded"
    assert response["grounding_signal"] == "ungrounded"


# ---------- failure ----------


def test_schema_invalid_request():
    result = grounded_check({"claims": [], "corpus": []})
    assert result["valid"] is False
    assert result["response"] is None
    assert result["errors"]


def test_duplicate_ids_rejected():
    request = {
        "claims": [
            {"claim_id": "c1", "claim_text": "one"},
            {"claim_id": "c1", "claim_text": "two"},
        ],
        "corpus": [{"corpus_id": "doc1", "text": "text"}],
    }
    result = grounded_check(request)
    assert result["valid"] is False
    assert any("duplicate" in err for err in result["errors"])


# ---------- CLI ----------


def test_cli_grounded_check_json():
    res = run("grounded-check", str(EXAMPLE_REQUEST), "--format", "json")
    payload = json.loads(res.stdout)
    assert payload["grounding_signal"] == "ungrounded"
    assert payload["claim_count"] == 3


def test_cli_grounded_check_strict_exit():
    res = run("grounded-check", str(EXAMPLE_REQUEST), "--strict", expect_zero=False)
    assert res.returncode == 1
    assert "grounding_signal=ungrounded" in res.stdout


# ---------- MCP wiring ----------


def test_mcp_tool_registered():
    from agenda_intelligence import mcp_server
    from agenda_intelligence.mcp_stdio import TOOLS

    assert "grounded_check" in TOOLS
    result = mcp_server.grounded_check(json.loads(EXAMPLE_REQUEST.read_text()))
    assert result["valid"]
