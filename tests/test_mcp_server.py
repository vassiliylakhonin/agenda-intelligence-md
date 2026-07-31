import json
from pathlib import Path

from agenda_intelligence import mcp_stdio
from agenda_intelligence.mcp_server import (
    check_memo_quality,
    get_lens,
    get_protocol,
    get_schema,
    list_lenses,
    list_source_categories,
    score_output,
    source_coverage,
    source_plan,
    validate_brief,
)
from agenda_intelligence.mcp_stdio import handle_message

FIXTURES = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "memo_quality"


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
        "check_memo_quality",
    }


def test_mcp_stdio_category_fields_constrained_to_packaged_enum():
    """source_plan / source_coverage category slugs are constrained to the
    packaged set on the live tools/list surface (computed, not hardcoded)."""
    response = handle_message({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    tools = {tool["name"]: tool for tool in response["result"]["tools"]}

    expected = set(list_source_categories()["category_ids"])
    assert expected, "no packaged source categories found"

    for name in ("source_plan", "source_coverage"):
        category = tools[name]["inputSchema"]["properties"]["category"]
        assert set(category["enum"]) == expected, f"{name}.category enum diverged from packaged slugs"


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


def test_check_memo_quality_tool_accepts_good_memo():
    memo = json.loads((FIXTURES / "golden/evidence-readiness-good.json").read_text(encoding="utf-8"))

    result = check_memo_quality(memo)

    assert result["implemented"] is True
    assert result["schema_valid"] is True
    assert result["ok"] is True, result["errors"]


_EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def _call_tool(name, arguments):
    response = handle_message(
        {"jsonrpc": "2.0", "id": 99, "method": "tools/call", "params": {"name": name, "arguments": arguments}}
    )
    result = response["result"]
    payload = json.loads(result["content"][0]["text"])
    return result, payload


def test_mcp_stdio_tools_list_includes_vertical_workers():
    response = handle_message({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    names = {tool["name"] for tool in response["result"]["tools"]}
    assert {
        "middle_corridor_deal_risk",
        "cis_secondary_sanctions_exposure",
        "agentic_interaction_trust",
        "gulf_maritime_exposure",
    } <= names


def test_mcp_stdio_check_memo_quality_tool_call_reports_bad_memo():
    memo = json.loads((FIXTURES / "failure/overconfident-clearance.json").read_text(encoding="utf-8"))

    result, payload = _call_tool("check_memo_quality", {"memo_json": memo})

    assert result["isError"] is False
    assert payload["implemented"] is True
    assert payload["schema_valid"] is True
    assert payload["ok"] is False
    assert payload["errors"]


def test_mcp_tool_middle_corridor_deal_risk_golden():
    req = json.loads(
        (_EXAMPLES / "kazakhstan-middle-corridor/contract/ready_for_human_review.request.json").read_text()
    )
    result, payload = _call_tool("middle_corridor_deal_risk", {"deal_risk_request": req})
    assert result["isError"] is False
    assert payload["valid"] is True
    assert payload["response"]["human_review_required"] is True
    assert payload["response"]["triage_recommendation"] == "ready_for_human_review"


def test_mcp_tool_cis_secondary_sanctions_exposure_golden_local_no_live_retrieval():
    req = json.loads(
        (_EXAMPLES / "cis-secondary-sanctions/contract/escalate_before_onboarding.request.json").read_text()
    )
    result, payload = _call_tool("cis_secondary_sanctions_exposure", {"exposure_request": req})
    assert result["isError"] is False
    assert payload["valid"] is True
    assert payload["response"]["human_review_required"] is True
    # local stdio must not perform live retrieval
    assert payload["live_retrieval_status"] in {"disabled", "degraded", "not_attempted"}


def test_mcp_tool_agentic_interaction_trust_golden():
    req = json.loads(
        (_EXAMPLES / "agentic-interaction-trust/contract/unknown_a2a_agent_escalate.request.json").read_text()
    )
    result, payload = _call_tool("agentic_interaction_trust", {"trust_request": req})
    assert result["isError"] is False
    assert payload["valid"] is True
    assert payload["response"]["human_review_required"] is True


def test_mcp_tool_vertical_worker_missing_argument_is_tool_error():
    result, payload = _call_tool("middle_corridor_deal_risk", {})
    assert result["isError"] is True
    assert "Missing required argument" in result["content"][0]["text"]


def test_mcp_tool_gulf_maritime_exposure_golden():
    req = json.loads((_EXAMPLES / "gulf-maritime-exposure/contract/ready_for_human_review.request.json").read_text())
    result, payload = _call_tool("gulf_maritime_exposure", {"exposure_request": req})
    assert result["isError"] is False
    assert payload["valid"] is True
    assert payload["response"]["human_review_required"] is True
    assert payload["response"]["triage_recommendation"] == "ready_for_human_review"


def test_validate_brief_returns_all_missing_fields_not_just_first():
    """An empty brief is missing several required fields; the validator must
    surface all of them in one call so an agent can fix the payload in one pass."""
    result = validate_brief({})
    assert result["valid"] is False
    assert len(result["errors"]) > 1, result["errors"]
    assert any("bottom_line" in e for e in result["errors"])


def test_get_schema_returns_named_schema_with_resolvable_aliases():
    for name in ("agenda_brief", "agenda-brief.schema.json", "agenda-brief"):
        result = get_schema(name)
        assert result["error"] is None, name
        assert result["name"] == "agenda_brief"
        assert result["path"].endswith("agenda-brief.schema.json")
        assert isinstance(result["schema"], dict)
        assert "bottom_line" in result["schema"].get("properties", {})


def test_get_schema_lists_available_when_name_omitted():
    result = get_schema()
    assert result["error"] is None
    names = {item["name"] for item in result["available"]}
    assert {"agenda_brief", "evidence_pack", "agenda_memo"} <= names
    assert result["count"] == len(result["available"])


def test_get_schema_unknown_name_reports_available():
    result = get_schema("does-not-exist")
    assert result["schema"] is None
    assert "Unknown schema" in result["error"]
    assert "agenda_brief" in result["available"]


def test_mcp_stdio_get_schema_tool_call_returns_schema():
    result, payload = _call_tool("get_schema", {"name": "evidence_pack"})
    assert result["isError"] is False
    assert payload["name"] == "evidence_pack"
    assert isinstance(payload["schema"], dict)


# --- 2026-07-28 stateless core -------------------------------------------------


def test_server_discover_advertises_versions_and_identity():
    response = handle_message({"jsonrpc": "2.0", "id": 1, "method": "server/discover"})

    result = response["result"]
    assert result["protocolVersions"][0] == mcp_stdio.PROTOCOL_VERSION == "2026-07-28"
    assert "tools" in result["capabilities"]
    assert result["serverInfo"]["name"] == "agenda-intelligence-md"
    assert result["instructions"]


def test_every_result_declares_result_type_and_server_identity():
    """Identity moved into per-result _meta when the handshake was removed, so a
    client that never calls initialize still learns who answered."""
    for method in ("server/discover", "tools/list", "ping"):
        response = handle_message({"jsonrpc": "2.0", "id": 1, "method": method})
        result = response["result"]
        assert result["resultType"] == "complete", method
        assert result["_meta"][mcp_stdio.META_SERVER_INFO]["name"] == "agenda-intelligence-md", method


def test_tools_list_is_cacheable_and_stable():
    first = handle_message({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})["result"]
    second = handle_message({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})["result"]

    assert first["ttlMs"] > 0
    assert first["cacheScope"] == "public"
    assert [tool["name"] for tool in first["tools"]] == [tool["name"] for tool in second["tools"]]


def test_supported_protocol_version_in_meta_is_accepted():
    response = handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list",
            "params": {"_meta": {mcp_stdio.META_PROTOCOL_VERSION: "2026-07-28"}},
        }
    )

    assert "error" not in response
    assert response["result"]["tools"]


def test_unsupported_protocol_version_in_meta_is_rejected():
    response = handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list",
            "params": {"_meta": {mcp_stdio.META_PROTOCOL_VERSION: "1999-01-01"}},
        }
    )

    assert response["error"]["code"] == mcp_stdio.UNSUPPORTED_PROTOCOL_VERSION == -32022
    assert "2026-07-28" in response["error"]["data"]["supported"]


def test_legacy_handshake_still_answered_for_older_clients():
    """initialize left the protocol in 2026-07-28; clients that still send it
    must keep working, because the server holds no session state either way."""
    response = handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "test"}},
        }
    )

    assert response["result"]["protocolVersion"] == "2025-03-26"
    assert handle_message({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None
