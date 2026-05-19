from agenda_intelligence.mcp_server import (
    get_lens,
    get_protocol,
    list_lenses,
    list_source_categories,
    score_output,
    source_coverage,
    source_plan,
)
from agenda_intelligence.mcp_stdio import handle_message


def test_get_protocol_entrypoint_returns_markdown():
    result = get_protocol("entrypoint")

    assert result["implemented"] is True
    assert result["error"] is None
    assert result["path"] == "Agenda-Intelligence.md"
    assert "Do not summarize public agenda by default" in result["protocol"]


def test_list_lenses_can_filter_by_type():
    result = list_lenses("regional")

    assert result["implemented"] is True
    assert result["error"] is None
    assert set(result["lenses"]) == {"regional"}
    assert "eu" in result["lenses"]["regional"]


def test_get_lens_returns_packaged_markdown():
    result = get_lens("regional", "eu")

    assert result["implemented"] is True
    assert result["error"] is None
    assert result["path"].endswith("regional/eu.md")
    assert "European Union" in result["lens"]


def test_source_plan_returns_packaged_requirements():
    result = source_plan("technology-ai")

    assert result["implemented"] is True
    assert result["error"] is None
    assert result["plan"]["category"] == "technology-ai"
    assert "must_check" in result["plan"]


def test_list_source_categories_returns_packaged_requirements_summary():
    result = list_source_categories()

    assert result["implemented"] is True
    assert result["error"] is None
    assert "sanctions" in result["category_ids"]
    assert "technology-ai" in result["category_ids"]
    sanctions = next(item for item in result["categories"] if item["category"] == "sanctions")
    assert sanctions["path"].endswith("sanctions.json")
    assert sanctions["must_check_count"] >= 1
    assert "does not discover sources" in result["note"].lower()


def test_source_plan_unknown_category_returns_error():
    result = source_plan("unknown")

    assert result["implemented"] is True
    assert result["plan"] is None
    assert "Unknown source category" in result["error"]


def test_source_coverage_reports_missing_sources():
    result = source_coverage(
        {
            "topic": "sanctions claim",
            "evidence_mode": "user_provided",
            "claims": [
                {
                    "claim": "Company X is sanctioned worldwide.",
                    "support_status": "partially_supported",
                    "sources": [
                        {
                            "name": "Media report",
                            "source_type": "media",
                            "freshness": "current",
                            "supports": ["Mentions sanctions risk."],
                            "limits": ["No official list."],
                        }
                    ],
                }
            ],
            "unsupported_claims": ["Official list evidence missing."],
        },
        "sanctions",
    )

    assert result["implemented"] is True
    assert result["valid_category"] is True
    assert "sanctions_list" in result["missing_required_sources"]
    sanctions_detail = next(
        item for item in result["required_source_details"] if item["required_source"] == "sanctions_list"
    )
    assert sanctions_detail["status"] == "missing"
    assert sanctions_detail["matched_sources"] == []
    assert result["strict_gate_passed"] is False


def test_source_coverage_defaults_to_evidence_source_category():
    result = source_coverage(
        {
            "topic": "sanctions claim",
            "evidence_mode": "user_provided",
            "source_category": "sanctions",
            "claims": [
                {
                    "claim": "Company X is sanctioned worldwide.",
                    "support_status": "partially_supported",
                    "sources": [],
                }
            ],
            "unsupported_claims": ["Official source coverage is missing."],
        }
    )

    assert result["implemented"] is True
    assert result["valid_category"] is True
    assert result["category"] == "sanctions"
    assert "sanctions_list" in result["missing_required_sources"]


def test_source_coverage_requires_category_argument_or_evidence_field():
    result = source_coverage({"claims": []})

    assert result["implemented"] is True
    assert result["valid_category"] is False
    assert "Missing source category" in result["error"]


def test_source_coverage_reports_matched_source_details():
    result = source_coverage(
        {
            "topic": "sanctions claim",
            "evidence_mode": "live_source_backed",
            "claims": [
                {
                    "claim": "Company X appears on the OFAC list.",
                    "support_status": "supported",
                    "sources": [
                        {
                            "evidence_id": "e1",
                            "name": "OFAC SDN list entry",
                            "source_type": "official",
                            "freshness": "current",
                            "supports": ["Official sanctions list designation."],
                        }
                    ],
                }
            ],
            "unsupported_claims": [],
        },
        "sanctions",
    )

    sanctions_detail = next(
        item for item in result["required_source_details"] if item["required_source"] == "sanctions_list"
    )
    assert sanctions_detail["status"] == "covered"
    assert sanctions_detail["matched_sources"][0]["evidence_id"] == "e1"
    assert "ofac" in sanctions_detail["matched_sources"][0]["matched_terms"]


def test_source_coverage_explicit_missing_overrides_matched_source():
    result = source_coverage(
        {
            "topic": "sanctions claim",
            "evidence_mode": "mixed",
            "claims": [
                {
                    "claim": "Company X appears on a sanctions list.",
                    "support_status": "partially_supported",
                    "sources": [
                        {
                            "name": "OFAC SDN list mention",
                            "source_type": "official",
                            "freshness": "current",
                            "supports": ["Official sanctions list designation."],
                        }
                    ],
                }
            ],
            "required_but_missing_sources": ["sanctions_list"],
            "unsupported_claims": ["Sanctions list coverage is incomplete."],
        },
        "sanctions",
    )

    sanctions_detail = next(
        item for item in result["required_source_details"] if item["required_source"] == "sanctions_list"
    )
    assert "sanctions_list" in result["missing_required_sources"]
    assert sanctions_detail["status"] == "explicitly_missing"
    assert sanctions_detail["matched_sources"]


def test_source_coverage_unknown_category_returns_error():
    result = source_coverage({"claims": []}, "unknown")

    assert result["implemented"] is True
    assert result["valid_category"] is False
    assert "Unknown source category" in result["error"]


def test_score_output_scores_before_after_pair():
    result = score_output(
        "Generic update. Monitor developments.",
        (
            "Signal classification: compliance-relevant development. "
            "What changed: guidance moved toward implementation. "
            "Main uncertainty: whether enforcement follows. "
            "Watch next: regulator guidance and compliance deadline."
        ),
    )

    assert result["implemented"] is True
    assert result["error"] is None
    assert result["after_score"] > result["before_score"]
    assert result["required_markers"]["watch_next"] is True


def test_mcp_stdio_initialize_returns_tool_capability():
    response = handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "test"}},
        }
    )

    assert response["id"] == 1
    assert response["result"]["protocolVersion"] == "2025-03-26"
    assert "tools" in response["result"]["capabilities"]


def test_mcp_stdio_tools_list_includes_protocol_tool():
    response = handle_message({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})

    tools = response["result"]["tools"]
    assert {tool["name"] for tool in tools} >= {
        "get_protocol",
        "validate_brief",
        "list_source_categories",
        "source_plan",
        "source_coverage",
        "score_output",
    }


def test_mcp_stdio_tools_call_returns_json_text_content():
    response = handle_message(
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "source_plan", "arguments": {"category": "technology-ai"}},
        }
    )

    result = response["result"]
    assert result["isError"] is False
    assert result["content"][0]["type"] == "text"
    assert '"category": "technology-ai"' in result["content"][0]["text"]


def test_mcp_stdio_tools_call_unknown_tool_is_tool_error():
    response = handle_message(
        {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {"name": "unknown", "arguments": {}},
        }
    )

    assert response["result"]["isError"] is True
    assert "Unknown tool" in response["result"]["content"][0]["text"]


def test_mcp_stdio_tools_call_score_output_returns_score():
    response = handle_message(
        {
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {
                "name": "score_output",
                "arguments": {
                    "before_text": "Generic update. Monitor developments.",
                    "after_text": (
                        "Signal classification: compliance-relevant development. "
                        "What changed: guidance moved toward implementation. "
                        "Main uncertainty: whether enforcement follows. "
                        "Watch next: regulator guidance and compliance deadline."
                    ),
                },
            },
        }
    )

    assert response["result"]["isError"] is False
    assert '"implemented": true' in response["result"]["content"][0]["text"]
    assert '"after_score"' in response["result"]["content"][0]["text"]
