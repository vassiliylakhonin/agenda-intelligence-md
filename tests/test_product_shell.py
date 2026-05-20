"""Integration tests for the Agenda Intelligence product shell.

Three scenarios from the product spec:

1. ``analyze`` with geography="Kazakhstan", depth="quick_brief" → must load
   the GTTA reasoning method and the Central Asia + Caspian regional
   reference, and return a memo that validates against
   agenda-memo.schema.json.
2. ``analyze`` without regional specialization (geography="global") → must
   load only the GTTA reasoning method.
3. ``validate_memo`` accepts the schema example and rejects malformed memos.

The Anthropic API is not called: the tests run in skeleton mode (no
ANTHROPIC_API_KEY) and additionally mock-patch the SDK path so the
"LLM was invoked" branch is also exercised deterministically.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from agenda_intelligence import mcp_server, product

ROOT = Path(__file__).resolve().parents[1]
MEMO_SCHEMA = ROOT / "schemas" / "agenda-memo.schema.json"


@pytest.fixture(autouse=True)
def _no_api_key(monkeypatch):
    """Force skeleton mode by default; tests that want the LLM branch opt in."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


def _memo_example() -> dict:
    schema = json.loads(MEMO_SCHEMA.read_text(encoding="utf-8"))
    return schema["examples"][0]


# ---------------------------------------------------------------------------
# Scenario 1: Kazakhstan → GTTA + CA-Caspian
# ---------------------------------------------------------------------------


def test_analyze_kazakhstan_loads_ca_caspian():
    request = {
        "question": "How exposed is a Kazakhstan-incorporated payments fintech to secondary US sanctions?",
        "geography": "Kazakhstan",
        "depth": "quick_brief",
    }
    result = mcp_server.analyze(request)

    assert result["implemented"] is True
    assert result["valid_request"] is True
    assert result["errors"] == []

    modules = [m["module"] for m in result["modules_used"]]
    assert "global-think-tank-analyst" in modules, "GTTA must always load"
    assert "central-asia-caspian" in modules, "Kazakhstan must activate CA-Caspian"
    assert "gulf-middle-east" not in modules

    # Skeleton mode without API key — memo still validates the contract.
    memo_validation = mcp_server.validate_memo(result["memo"])
    assert memo_validation["valid"] is True, memo_validation["errors"]

    # System prompt is non-trivially populated.
    assert len(result["system_prompt"]) > 1000
    assert "MODULE: global-think-tank-analyst" in result["system_prompt"]
    assert "MODULE: central-asia-caspian" in result["system_prompt"]


# ---------------------------------------------------------------------------
# Scenario 2: global → GTTA only
# ---------------------------------------------------------------------------


def test_analyze_global_loads_only_gtta():
    request = {
        "question": "What second-order risks should an AI-policy team watch globally?",
        "geography": "global",
        "depth": "quick_brief",
    }
    result = mcp_server.analyze(request)

    assert result["valid_request"] is True
    modules = [m["module"] for m in result["modules_used"]]
    assert modules == [
        "global-think-tank-analyst"
    ], f"global geography must not activate regional specialists; got {modules}"
    assert "MODULE: central-asia-caspian" not in result["system_prompt"]
    assert "MODULE: gulf-middle-east" not in result["system_prompt"]


# ---------------------------------------------------------------------------
# Scenario 3: validate_memo on real and malformed memos
# ---------------------------------------------------------------------------


def test_validate_memo_accepts_schema_example():
    example = _memo_example()
    result = mcp_server.validate_memo(example)
    assert result["implemented"] is True
    assert result["valid"] is True
    assert result["errors"] == []


def test_validate_memo_rejects_missing_required_block():
    example = _memo_example()
    del example["risk_summary"]
    result = mcp_server.validate_memo(example)
    assert result["valid"] is False
    assert any("risk_summary" in e for e in result["errors"])


def test_validate_memo_rejects_unknown_top_level_field():
    example = _memo_example()
    example["surprise_field"] = "not allowed"
    result = mcp_server.validate_memo(example)
    assert result["valid"] is False


# ---------------------------------------------------------------------------
# LLM-invocation branch (mocked)
# ---------------------------------------------------------------------------


def test_analyze_llm_invoked_branch_with_mock(monkeypatch):
    """Exercise the path where _call_anthropic returns content."""
    fake_memo = _memo_example()

    def _fake_call(system_prompt: str, user_message: str) -> str:  # noqa: ARG001
        return json.dumps(fake_memo)

    monkeypatch.setattr(product, "_call_anthropic", _fake_call)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-used")

    result = mcp_server.analyze(
        {
            "question": "Test question",
            "geography": "Kazakhstan",
            "depth": "quick_brief",
        }
    )

    assert result["llm_invoked"] is True
    assert result["memo_valid"] is True, result["memo_errors"]
    assert result["memo"]["risk_summary"]["short"].startswith("Secondary US sanctions")


def test_analyze_llm_branch_handles_non_json_response(monkeypatch):
    monkeypatch.setattr(product, "_call_anthropic", lambda s, u: "I cannot produce JSON, sorry.")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-used")
    result = mcp_server.analyze({"question": "Q?", "geography": "global"})
    assert result["llm_invoked"] is True
    assert result["memo_valid"] is False
    assert result["memo"] is None
    assert "could not parse JSON" in " ".join(result["memo_errors"])


# ---------------------------------------------------------------------------
# Signals and deep_dive (round out coverage)
# ---------------------------------------------------------------------------


def test_list_signals_returns_index():
    result = mcp_server.list_signals()
    assert result["implemented"] is True
    assert isinstance(result["index"], (dict, list))


def test_get_signal_unknown_id():
    result = mcp_server.get_signal("not-a-real-signal-id")
    assert result["implemented"] is True
    assert "error" in result


def test_deep_dive_returns_planned_stub():
    result = mcp_server.deep_dive()
    assert result["implemented"] is False
    assert result["status"] == "planned"
    assert "v2" in result["message"]
