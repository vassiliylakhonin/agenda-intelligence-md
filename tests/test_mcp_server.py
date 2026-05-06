from agenda_intelligence.mcp_server import (
    get_lens,
    get_protocol,
    list_lenses,
    score_output,
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


def test_source_plan_unknown_category_returns_error():
    result = source_plan("unknown")

    assert result["implemented"] is True
    assert result["plan"] is None
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
    assert {tool["name"] for tool in tools} >= {"get_protocol", "validate_brief", "source_plan", "score_output"}


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
