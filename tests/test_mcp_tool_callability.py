"""Guards on what an agent can learn from the MCP tool listing alone.

An agent picks and fills a tool from `tools/list` without reading the repo. A
parameter declared as a bare object pointing at a schema file name it has never
seen forces it to guess the payload, fail validation, and drop the tool. These
tests assert the listing carries enough contract to build a first call, and that
every vertical worker deployed as a live A2A endpoint is reachable over MCP too.
"""

import json
from pathlib import Path

from agenda_intelligence.mcp_stdio import TOOLS, handle_message

ROOT = Path(__file__).resolve().parents[1]

# Tools whose payload the caller must construct, and the schema key that
# describes it. get_schema serves the nested detail; the listing carries the
# top-level shape.
CONSTRUCTIVE_TOOLS = {
    "analyze": ("request", "agenda_request"),
    "check_evidence_packet": ("packet_json", "evidence_packet_request"),
    "verify_claims": ("request_json", "claim_verification_request"),
    "middle_corridor_deal_risk": ("deal_risk_request", "middle_corridor_deal_risk_request"),
    "cis_secondary_sanctions_exposure": ("exposure_request", "cis_secondary_sanctions_request"),
    "agentic_interaction_trust": ("trust_request", "agentic_interaction_trust_request"),
    "gulf_maritime_exposure": ("exposure_request", "gulf_maritime_exposure_request"),
    "kazakhstan_market_entry_readiness": ("readiness_request", "market_entry_readiness_request"),
    "agent_output_verification": ("audit_json", "evidence_audit"),
    "pre_action_check": ("action_request", "pre_action_check_request"),
}

# Every vertical worker with a live A2A endpoint must also be callable over MCP.
# Two of them (market entry, output verification) shipped as A2A profiles only,
# so an MCP client could not reach them at all.
LIVE_WORKER_TOOLS = {
    "middle_corridor_deal_risk",
    "cis_secondary_sanctions_exposure",
    "agentic_interaction_trust",
    "gulf_maritime_exposure",
    "kazakhstan_market_entry_readiness",
    "agent_output_verification",
}


def _listed_tools() -> dict:
    response = handle_message({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    return {tool["name"]: tool for tool in response["result"]["tools"]}


def test_every_live_worker_is_reachable_over_mcp():
    listed = _listed_tools()

    missing = sorted(LIVE_WORKER_TOOLS - set(listed))
    assert not missing, f"live A2A workers with no MCP tool: {missing}"


def test_constructive_parameters_declare_their_fields():
    listed = _listed_tools()

    for tool_name, (param, _schema_key) in CONSTRUCTIVE_TOOLS.items():
        shape = listed[tool_name]["inputSchema"]["properties"][param]
        assert shape.get("type") == "object", tool_name
        properties = shape.get("properties")
        assert isinstance(properties, dict) and properties, f"{tool_name}.{param} exposes no field names"
        assert shape.get("required"), f"{tool_name}.{param} does not say which fields are required"


def test_constructive_parameters_point_at_the_full_schema():
    listed = _listed_tools()

    for tool_name, (param, schema_key) in CONSTRUCTIVE_TOOLS.items():
        description = listed[tool_name]["inputSchema"]["properties"][param]["description"]
        assert f"get_schema('{schema_key}')" in description, tool_name


def test_local_refs_are_resolved_not_left_empty():
    # The request schemas keep object definitions in $defs. An unresolved $ref
    # renders as {} — the guessing game these hints exist to remove.
    listed = _listed_tools()
    counterparty = listed["cis_secondary_sanctions_exposure"]["inputSchema"]["properties"]["exposure_request"][
        "properties"
    ]["counterparty"]

    assert set(counterparty.get("properties", {})) >= {"name", "jurisdiction", "sector"}
    assert counterparty.get("required") == ["name", "jurisdiction"]


def test_bundled_example_travels_with_the_tool():
    listed = _listed_tools()
    shape = listed["cis_secondary_sanctions_exposure"]["inputSchema"]["properties"]["exposure_request"]

    examples = shape.get("examples")
    assert isinstance(examples, list) and len(examples) == 1
    assert {"counterparty", "risk_question", "decision_stage"} <= set(examples[0])


def test_market_entry_tool_runs_the_golden_contract_fixture():
    fixture = ROOT / "examples" / "kazakhstan-market-entry-readiness" / "contract"
    request = json.loads((fixture / "pre_signature_validation.request.json").read_text())

    result = TOOLS["kazakhstan_market_entry_readiness"]["handler"]({"readiness_request": request})

    assert result["valid"] is True
    assert result["response"]["gate_decision"] == "proceed_to_validation"


def test_market_entry_tool_reports_schema_errors_on_a_bad_request():
    result = TOOLS["kazakhstan_market_entry_readiness"]["handler"]({"readiness_request": {"entry_mode": "nonsense"}})

    assert result["valid"] is False
    assert result["errors"]


def test_output_verification_tool_allows_relay_on_a_grounded_audit():
    audit = {
        "topic": "corridor status",
        "claims": [
            {
                "claim_id": "c1",
                "claim": "The regulation entered into force on 1 May 2026.",
                "support_level": "direct",
                "evidence_ids": ["e1"],
                "supporting_quotes": [{"evidence_id": "e1", "quote": "in force from 1 May 2026"}],
            }
        ],
        "evidence": [{"evidence_id": "e1", "source_type": "official_document", "name": "Official gazette"}],
    }

    result = TOOLS["agent_output_verification"]["handler"]({"audit_json": audit})

    assert result["valid"] is True
    assert result["response"]["verdict"] == "allow_relay"
    assert result["response"]["not_advice_notice"]


def test_output_verification_tool_reports_schema_errors_on_a_bad_audit():
    result = TOOLS["agent_output_verification"]["handler"]({"audit_json": {"claims": "not-a-list"}})

    assert result["valid"] is False
    assert result["errors"]


def test_pre_action_check_tool_routes_high_risk_output_to_approval():
    request = {
        "run_id": "mcp-pre-action",
        "actor": {"id": "review-agent", "type": "ai_agent"},
        "requested_action": "publish a claim-backed summary",
        "target": {"id": "public-channel", "type": "publication"},
        "risk_tier": "high",
        "claims": [
            {
                "claim_id": "c1",
                "claim": "The release is available.",
                "support_level": "direct",
                "evidence_ids": ["e1"],
                "supporting_quotes": [{"evidence_id": "e1", "quote": "Release available"}],
            }
        ],
        "evidence": [{"evidence_id": "e1", "source_type": "official_document"}],
    }

    result = TOOLS["pre_action_check"]["handler"]({"action_request": request})

    assert result["valid"] is True
    assert result["response"]["decision"] == "require_approval"
