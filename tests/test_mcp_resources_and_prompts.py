"""Tests for MCP resources and prompts support."""

from __future__ import annotations

import json

from agenda_intelligence import mcp_server, mcp_stdio


def test_mcp_server_list_and_read_resources():
    resources = mcp_server.list_resources()
    assert len(resources) >= 2
    uris = [r["uri"] for r in resources]
    assert "agenda://manifest" in uris
    assert "agenda://protocol/core" in uris
    assert "agenda://schemas/v1/evidence_packet_request" in uris

    # Read manifest
    manifest_res = mcp_server.read_resource("agenda://manifest")
    assert manifest_res["mimeType"] == "application/json"
    manifest_obj = json.loads(manifest_res["text"])
    assert "tools" in manifest_obj.get("mcp", {})

    # Read protocol
    proto_res = mcp_server.read_resource("agenda://protocol/core")
    assert proto_res["mimeType"] == "text/markdown"
    assert "Protocol" in proto_res["text"] or "Agenda" in proto_res["text"]

    # Read schema
    schema_res = mcp_server.read_resource("agenda://schemas/v1/evidence_packet_request")
    assert schema_res["mimeType"] == "application/json"
    schema_obj = json.loads(schema_res["text"])
    assert "$schema" in schema_obj


def test_mcp_server_list_and_get_prompts():
    prompts = mcp_server.list_prompts()
    assert len(prompts) >= 3
    names = [p["name"] for p in prompts]
    assert "draft_evidence_memo" in names
    assert "self_correct_packet" in names
    assert "audit_evidence_claims" in names

    # Get draft_evidence_memo
    memo_prompt = mcp_server.get_prompt(
        "draft_evidence_memo",
        {"topic": "Semiconductor export control exposure", "decision_context": "Supplier onboarding"},
    )
    assert "Semiconductor export control exposure" in memo_prompt["messages"][0]["content"]["text"]
    assert "Supplier onboarding" in memo_prompt["messages"][0]["content"]["text"]

    # Get self_correct_packet
    repair_prompt = mcp_server.get_prompt(
        "self_correct_packet",
        {"packet_json": json.dumps({"claims": [{"claim_id": "c1", "text": "Claim", "source_ids": ["s1"]}]})},
    )
    assert len(repair_prompt["messages"]) > 0


def test_mcp_stdio_dispatch_resources_and_prompts():
    # Test server/discover capabilities
    discover_req = {"jsonrpc": "2.0", "id": 1, "method": "server/discover"}
    discover_resp = mcp_stdio.handle_message(discover_req)
    caps = discover_resp["result"]["capabilities"]
    assert "resources" in caps
    assert "prompts" in caps

    # Test resources/list
    res_list_req = {"jsonrpc": "2.0", "id": 2, "method": "resources/list"}
    res_list_resp = mcp_stdio.handle_message(res_list_req)
    assert "resources" in res_list_resp["result"]

    # Test resources/read
    res_read_req = {"jsonrpc": "2.0", "id": 3, "method": "resources/read", "params": {"uri": "agenda://manifest"}}
    res_read_resp = mcp_stdio.handle_message(res_read_req)
    assert "contents" in res_read_resp["result"]
    assert res_read_resp["result"]["contents"][0]["uri"] == "agenda://manifest"

    # Test prompts/list
    p_list_req = {"jsonrpc": "2.0", "id": 4, "method": "prompts/list"}
    p_list_resp = mcp_stdio.handle_message(p_list_req)
    assert "prompts" in p_list_resp["result"]

    # Test prompts/get
    p_get_req = {
        "jsonrpc": "2.0",
        "id": 5,
        "method": "prompts/get",
        "params": {"name": "draft_evidence_memo", "arguments": {"topic": "Cross-border settlement"}},
    }
    p_get_resp = mcp_stdio.handle_message(p_get_req)
    assert "messages" in p_get_resp["result"]
    assert "Cross-border settlement" in p_get_resp["result"]["messages"][0]["content"]["text"]
