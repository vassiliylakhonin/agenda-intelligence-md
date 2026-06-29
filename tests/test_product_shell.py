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
MEMO_SCHEMA = ROOT / "schemas" / "v1" / "agenda-memo.schema.json"
MEMO_QUALITY_FIXTURES = ROOT / "tests" / "fixtures" / "memo_quality"


@pytest.fixture(autouse=True)
def _no_api_key(monkeypatch):
    """Force skeleton mode by default; tests that want the LLM branch opt in."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


def _memo_example() -> dict:
    schema = json.loads(MEMO_SCHEMA.read_text(encoding="utf-8"))
    return schema["examples"][0]


def _memo_quality_fixture(relative_path: str) -> dict:
    return json.loads((MEMO_QUALITY_FIXTURES / relative_path).read_text(encoding="utf-8"))


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


def test_analyze_sanctions_routes_sector_specialist():
    request = {
        "question": "What secondary sanctions exposure should a payments fintech watch?",
        "geography": "global",
        "depth": "quick_brief",
    }
    result = mcp_server.analyze(request)

    assert result["valid_request"] is True
    assert {"module": "sanctions-sector", "role": "sector_specialist"} in result["modules_used"]
    memo_validation = mcp_server.validate_memo(result["memo"])
    assert memo_validation["valid"] is True, memo_validation["errors"]


def test_analyze_markdown_output_adds_rendered_memo():
    request = {
        "question": "What second-order risks should an AI-policy team watch globally?",
        "geography": "global",
        "depth": "quick_brief",
        "output_format": "markdown",
    }
    result = mcp_server.analyze(request)

    assert result["valid_request"] is True
    assert result["memo"] is not None
    assert result["rendered_memo"].startswith("# Skeleton memo")
    assert "## Watch Next" in result["rendered_memo"]
    memo_validation = mcp_server.validate_memo(result["memo"])
    assert memo_validation["valid"] is True, memo_validation["errors"]


def test_analyze_prompt_includes_server_verified_request_context():
    request = {
        "question": "Should we open a corridor-risk desk?",
        "decision_context": "Whether to hire an analyst this quarter.",
        "audience": "founder",
        "geography": ["Kazakhstan", "Caspian"],
        "time_horizon": "next 90 days",
        "evidence_mode": "mixed",
        "depth": "decision_pack",
    }
    result = mcp_server.analyze(request)

    prompt = result["system_prompt"]
    assert "===== REQUEST CONTEXT - SERVER VERIFIED =====" in prompt
    assert '- audience: "founder"' in prompt
    assert '- depth: "decision_pack"' in prompt
    assert '- evidence_mode: "mixed"' in prompt
    assert "do not invent citations" in prompt
    assert "Do not upgrade reasoning_only or mixed analysis into live-source-backed analysis." in prompt


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
    fake_memo = _memo_quality_fixture("golden/evidence-readiness-good.json")

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
    assert result["memo_quality_ok"] is True, result["memo_quality_errors"]
    assert "owner_actions_are_actionable" in result["memo_quality_passed"]
    assert result["memo"]["risk_summary"]["short"].startswith("The file is not decision ready")


def test_analyze_overrides_self_graded_audit_score(monkeypatch):
    """A model cannot pass itself off as fully validated by reporting score=0.99.

    The server must overwrite ``audit.validation_score`` and
    ``audit.validation_details`` with machine-verified values, while preserving
    the model's self-grade in ``audit.self_assessed_score`` for transparency.
    Provenance entries (substantive content) must survive.
    """
    fake_memo = {
        "meta": {
            "evidence_mode": "reasoning_only",
            "depth": "standard",
            "modules_used": [
                {"module": "global-think-tank-analyst", "role": "reasoning_method"},
                {"module": "central-asia-caspian", "role": "regional_specialist"},
                {"module": "sanctions-sector", "role": "sector_specialist"},
            ],
            "timestamp": "2026-05-20T13:00:00Z",
        },
        "risk_summary": {"short": "x", "detailed": "x"},
        # unknowns intentionally empty — a real failure mode the model may
        # quietly skip; machine audit must catch it.
        "analysis": {"facts": ["f"], "assessments": ["a"], "assumptions": ["u"], "unknowns": []},
        "watch_next": [{"indicator": "i"}],
        "audit": {
            "validation_score": 0.99,  # the model grading itself
            "validation_details": [{"check": "everything", "passed": True}],
            "provenance": [{"claim": "real claim", "basis": "assessment"}],
        },
    }
    monkeypatch.setattr(product, "_call_anthropic", lambda s, u: json.dumps(fake_memo))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-used")
    result = mcp_server.analyze({"question": "sanctions q", "geography": "Kazakhstan"})

    audit = result["memo"]["audit"]
    assert audit["machine_verified"] is True
    assert audit["self_assessed_score"] == 0.99
    assert audit["validation_score"] < 0.99, "machine score must not blindly accept the LLM self-grade"
    failed = [c["check"] for c in audit["validation_details"] if not c["passed"]]
    assert "unknowns_acknowledged" in failed
    # Provenance is substantive content and must survive the rewrite.
    assert audit["provenance"] == [{"claim": "real claim", "basis": "assessment"}]
    assert result["memo_valid"] is True
    assert result["memo_quality_ok"] is False
    assert result["memo_quality_errors"]


def test_analyze_reports_quality_failure_separately_from_schema_validity(monkeypatch):
    fake_memo = _memo_quality_fixture("failure/overconfident-clearance.json")
    monkeypatch.setattr(product, "_call_anthropic", lambda s, u: json.dumps(fake_memo))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-used")

    result = mcp_server.analyze({"question": "sanctions q", "geography": "Kazakhstan"})

    assert result["memo_valid"] is True, result["memo_errors"]
    assert result["memo_quality_ok"] is False
    assert any("overreach" in error for error in result["memo_quality_errors"])


def test_analyze_llm_branch_handles_non_json_response(monkeypatch):
    monkeypatch.setattr(product, "_call_anthropic", lambda s, u: "I cannot produce JSON, sorry.")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-used")
    result = mcp_server.analyze({"question": "Q?", "geography": "global"})
    assert result["llm_invoked"] is True
    assert result["memo_valid"] is False
    assert result["memo"] is None
    assert "could not parse JSON" in " ".join(result["memo_errors"])
    assert result["memo_quality_ok"] is False
    assert result["memo_quality_errors"] == ["memo_missing"]


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


# ---------------------------------------------------------------------------
# route_modules direct unit tests
# ---------------------------------------------------------------------------


def _modules(geography, question=""):
    return {m["module"] for m in product.route_modules(geography, question)}


def test_route_modules_eu_exact_geography():
    """Bare ``"EU"`` as geography must trigger the EU regional specialist."""
    mods = _modules("EU")
    assert "eu" in mods
    assert "global-think-tank-analyst" in mods


def test_route_modules_eu_europe_geography():
    """``"Europe"`` as geography also triggers EU lens."""
    assert "eu" in _modules("Europe")


def test_route_modules_eu_phrase_in_question():
    """Long-form EU phrases in question text trigger the EU lens even when
    geography is ``"global"``."""
    assert "eu" in _modules("global", "How does the EU AI Act affect GPAI?")
    assert "eu" in _modules("global", "GDPR enforcement against AI systems is intensifying.")


def test_route_modules_no_false_positive_on_substring_eu():
    """The bare two-letter ``eu`` must NOT match inside arbitrary words like
    ``exposure`` or ``queue``. Regression guard for the eval-discovered EU
    routing gap (see evals/agent-eval/gtta-global-policy.md observation 3)."""
    mods = _modules("global", "We have exposure to China and a queue of regulatory items.")
    assert "eu" not in mods


def test_route_modules_global_only_routes_gtta():
    """A purely global question with no regional or sector terms must route
    only the reasoning method."""
    assert _modules("global", "AI governance trajectory worldwide") == {"global-think-tank-analyst"}


def test_route_modules_combines_eu_and_sanctions():
    """EU routing composes with sanctions sector when both are present."""
    mods = _modules("EU", "EU sanctions enforcement under the latest package")
    assert {"global-think-tank-analyst", "eu", "sanctions-sector"} <= mods


def test_route_modules_eu_lens_content_loadable():
    """The MODULE_PATHS entry for ``eu`` must resolve to a real file in the
    packaged data tree."""
    assert product._load_module_text("eu") is not None


# ---------------------------------------------------------------------------
# audience_detail (ADR 0009)
# ---------------------------------------------------------------------------


def test_audience_detail_flows_into_request_context():
    """Optional `audience_detail` is rendered alongside `audience` in the
    verified request-context block so the host model sees both the
    enum-bound prototype and the caller's original framing."""
    result = mcp_server.analyze(
        {
            "question": "Q?",
            "audience": "founder",
            "audience_detail": "AI company leadership, product and compliance teams",
        }
    )
    prompt = result["system_prompt"]
    assert "audience" in prompt
    assert "audience_detail" in prompt
    assert "AI company leadership" in prompt


def test_audience_detail_optional_and_omitted_cleanly():
    """A request without `audience_detail` must validate and produce no
    `audience_detail` line in the rendered context block."""
    result = mcp_server.analyze({"question": "Q?", "audience": "analyst"})
    assert result["valid_request"] is True
    assert "audience_detail" not in result["system_prompt"]


def test_audience_detail_rejects_empty_string():
    """Schema sets `minLength: 1` on `audience_detail`; empty string must
    fail validation rather than silently render an empty field."""
    result = mcp_server.analyze({"question": "Q?", "audience": "analyst", "audience_detail": ""})
    assert result["valid_request"] is False
    assert result["errors"], "expected at least one schema error"


# ---------------------------------------------------------------------------
# Tripled-canon sync guard
#
# `route_modules` term sets exist in three places that MUST stay in sync,
# otherwise agents loading AGENTS.md or llms.txt see routing terms that do
# not match what `analyze` actually routes on. The authoritative source is
# the Python constants; AGENTS.md and llms.txt are documentation mirrors.
# This guard checks each authoritative term appears verbatim (lowercased,
# substring match) in both AGENTS.md and llms.txt.
#
# When a routing term is intentionally documented under a longer phrase
# (e.g. `tcitr` → "Middle Corridor / TCITR"), the membership check still
# passes because we substring-match the canonical key. Add new exemptions
# to TERM_EXEMPT_DOCS below only after updating the docs to mention the
# canonical term.
# ---------------------------------------------------------------------------

TERM_EXEMPT_DOCS: set[str] = set()


def _doc_mirrors() -> dict[str, str]:
    return {
        "AGENTS.md": (ROOT / "AGENTS.md").read_text(encoding="utf-8").lower(),
        "llms.txt": (ROOT / "llms.txt").read_text(encoding="utf-8").lower(),
    }


@pytest.mark.parametrize(
    "term_set_name",
    ["CA_CASPIAN_TERMS", "GULF_ME_TERMS", "EU_TERMS", "SANCTIONS_TERMS"],
)
def test_routing_terms_documented_in_canon(term_set_name: str):
    """Every term in the authoritative routing set must appear in both
    AGENTS.md and llms.txt so the canon stays consistent with code."""
    terms: set[str] = getattr(product, term_set_name)
    docs = _doc_mirrors()
    missing: list[str] = []
    for term in sorted(terms):
        if term in TERM_EXEMPT_DOCS:
            continue
        for doc_name, doc_text in docs.items():
            if term not in doc_text:
                missing.append(f"{term_set_name}:{term!r} missing from {doc_name}")
    assert not missing, (
        "Routing term set drifted from canon docs. Update AGENTS.md "
        "Geography routing section and llms.txt Geography routing terms "
        "to mention each term verbatim (or add to TERM_EXEMPT_DOCS with a "
        "comment). Missing:\n  " + "\n  ".join(missing)
    )


# ---------------------------------------------------------------------------
# Result `mode`: host_completion vs server_completed (BYO-host clarity)
# ---------------------------------------------------------------------------


def test_analyze_skeleton_mode_is_host_completion():
    """Keyless analyze must self-describe as expected host-completion, not a failure."""
    result = mcp_server.analyze({"question": "sanctions q", "geography": "Kazakhstan"})

    assert result["llm_invoked"] is False
    assert result["mode"] == "host_completion"
    # The skeleton is still not a real memo, but the message must read as expected,
    # not as a crash.
    assert result["memo_valid"] is False
    assert any("host_completion" in e for e in result["memo_errors"])
    assert result["memo_quality_ok"] is False
    assert result["memo_quality_errors"] == ["schema_invalid"]


def test_analyze_server_completed_mode_when_llm_runs(monkeypatch):
    """When the model is invoked here, mode must report server_completed."""
    monkeypatch.setattr(product, "_call_anthropic", lambda s, u: json.dumps(_memo_example()))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-used")

    result = mcp_server.analyze({"question": "sanctions q", "geography": "Kazakhstan"})

    assert result["llm_invoked"] is True
    assert result["mode"] == "server_completed"
