"""Contract tests for the MCP authoring tools (create_brief, append_evidence).

These tools assemble protocol documents and hand them back to the caller. They
must never write files, fetch sources, or upgrade a claim's support status on
their own — the tests below pin that behavior alongside the golden path.
"""

import copy

from agenda_intelligence import mcp_server
from agenda_intelligence.mcp_stdio import TOOLS

GOLDEN_BRIEF_FIELDS = {
    "bottom_line": "The registration deadline moves the compliance burden forward by one quarter.",
    "signal_classification": "compliance_relevant_development",
    "what_changed": "The regulator published a final implementing act with an earlier effective date.",
    "main_uncertainty": "Whether the transition relief in Article 12 survives the parliamentary review.",
    "watch_next": ["Publication in the official journal", "Guidance from the national competent authority"],
}

GOLDEN_SOURCE = {
    "name": "Official journal notice",
    "url": "https://example.org/journal/2026-114",
    "source_type": "official",
    "freshness": "current",
    "supports": ["The effective date is 2026-09-01."],
    "limits": ["Does not address transition relief."],
}


# ---------------------------------------------------------------------------
# create_brief
# ---------------------------------------------------------------------------


def test_create_brief_golden_path_returns_valid_complete_brief():
    result = mcp_server.create_brief(GOLDEN_BRIEF_FIELDS)

    assert result["valid"] is True
    assert result["complete"] is True
    assert result["errors"] == []
    assert result["missing_required"] == []
    assert result["brief"]["bottom_line"] == GOLDEN_BRIEF_FIELDS["bottom_line"]


def test_create_brief_without_fields_returns_scaffold_and_required_list():
    result = mcp_server.create_brief()

    assert result["complete"] is False
    assert result["missing_required"] == [
        "bottom_line",
        "signal_classification",
        "what_changed",
        "main_uncertainty",
        "watch_next",
    ]
    # The scaffold still carries the honest default rather than an empty slot.
    assert result["brief"]["evidence_mode"] == "reasoning_only"


def test_create_brief_failure_case_reports_schema_errors():
    fields = dict(GOLDEN_BRIEF_FIELDS, signal_classification="extremely_important")
    result = mcp_server.create_brief(fields)

    assert result["valid"] is False
    assert result["complete"] is False
    assert result["errors"]


def test_create_brief_defaults_evidence_mode_to_reasoning_only():
    assert mcp_server.create_brief(GOLDEN_BRIEF_FIELDS)["brief"]["evidence_mode"] == "reasoning_only"
    explicit = mcp_server.create_brief(dict(GOLDEN_BRIEF_FIELDS, evidence_mode="user_provided"))
    assert explicit["brief"]["evidence_mode"] == "user_provided"


def test_create_brief_reports_unknown_fields_instead_of_dropping_them_silently():
    result = mcp_server.create_brief(dict(GOLDEN_BRIEF_FIELDS, verdict="approve"))

    assert result["ignored_fields"] == ["verdict"]
    assert "verdict" not in result["brief"]
    assert result["valid"] is True


# ---------------------------------------------------------------------------
# append_evidence
# ---------------------------------------------------------------------------


def test_append_evidence_golden_path_creates_valid_pack():
    result = mcp_server.append_evidence(
        {
            "topic": "EU implementing act timing",
            "claim": "The effective date moved to 2026-09-01.",
            "sources": [GOLDEN_SOURCE],
            "support_status": "supported",
        }
    )

    assert result["valid"] is True
    assert result["created_pack"] is True
    assert result["action"] == "claim_added"
    assert result["pack"]["claims"][0]["support_status"] == "supported"
    assert result["pack"]["unsupported_claims"] == []


def test_append_evidence_failure_case_requires_topic_for_a_new_pack():
    result = mcp_server.append_evidence({"claim": "Some claim."})

    assert result["valid"] is False
    assert result["pack"] is None
    assert "topic is required when pack_json is omitted" in result["errors"]


def test_append_evidence_rejects_empty_claim():
    result = mcp_server.append_evidence({"topic": "T", "claim": "   "})

    assert result["valid"] is False
    assert result["pack"] is None


def test_append_evidence_never_infers_supported():
    with_sources = mcp_server.append_evidence(
        {"topic": "T", "claim": "Sourced claim.", "sources": [GOLDEN_SOURCE]},
    )
    without_sources = mcp_server.append_evidence({"topic": "T", "claim": "Bare claim."})

    assert with_sources["pack"]["claims"][0]["support_status"] == "partially_supported"
    assert without_sources["pack"]["claims"][0]["support_status"] == "unsupported"


def test_append_evidence_extends_existing_claim_and_dedupes_sources():
    first = mcp_server.append_evidence(
        {"topic": "T", "claim": "Shared claim.", "sources": [GOLDEN_SOURCE]},
    )
    second_source = dict(GOLDEN_SOURCE, name="Regulator press release", url="https://example.org/press/9")
    second = mcp_server.append_evidence(
        {"pack_json": first["pack"], "claim": "Shared claim.", "sources": [GOLDEN_SOURCE, second_source]},
    )

    assert second["action"] == "sources_appended"
    assert second["claim_count"] == 1
    assert second["appended_sources"] == 1
    assert len(second["pack"]["claims"][0]["sources"]) == 2


def test_append_evidence_leaves_existing_status_untouched_without_explicit_override():
    first = mcp_server.append_evidence(
        {"topic": "T", "claim": "Shared claim.", "sources": [GOLDEN_SOURCE], "support_status": "supported"},
    )
    second = mcp_server.append_evidence(
        {"pack_json": first["pack"], "claim": "Shared claim.", "sources": []},
    )

    assert second["pack"]["claims"][0]["support_status"] == "supported"


def test_append_evidence_keeps_unsupported_claims_in_sync():
    first = mcp_server.append_evidence({"topic": "T", "claim": "Unbacked claim."})
    assert first["pack"]["unsupported_claims"] == ["Unbacked claim."]

    upgraded = mcp_server.append_evidence(
        {
            "pack_json": first["pack"],
            "claim": "Unbacked claim.",
            "sources": [GOLDEN_SOURCE],
            "support_status": "supported",
        }
    )
    assert upgraded["pack"]["unsupported_claims"] == []


def test_append_evidence_preserves_manual_unsupported_entries():
    first = mcp_server.append_evidence({"topic": "T", "claim": "Unbacked claim."})
    pack = copy.deepcopy(first["pack"])
    pack["unsupported_claims"] = ["A claim with no record of its own"]

    result = mcp_server.append_evidence({"pack_json": pack, "claim": "Another unbacked claim."})

    assert result["pack"]["unsupported_claims"] == [
        "A claim with no record of its own",
        "Unbacked claim.",
        "Another unbacked claim.",
    ]


def test_append_evidence_does_not_mutate_the_caller_pack():
    first = mcp_server.append_evidence({"topic": "T", "claim": "First claim."})
    original = copy.deepcopy(first["pack"])

    mcp_server.append_evidence({"pack_json": first["pack"], "claim": "Second claim."})

    assert first["pack"] == original


# ---------------------------------------------------------------------------
# Transport registration
# ---------------------------------------------------------------------------


def test_authoring_tools_are_registered_and_callable_over_stdio():
    for name in ("create_brief", "append_evidence"):
        assert name in TOOLS
        assert TOOLS[name]["inputSchema"]["additionalProperties"] is False

    result = TOOLS["append_evidence"]["handler"]({"topic": "T", "claim": "A claim."})
    assert result["valid"] is True

    scaffold = TOOLS["create_brief"]["handler"]({})
    assert scaffold["complete"] is False
