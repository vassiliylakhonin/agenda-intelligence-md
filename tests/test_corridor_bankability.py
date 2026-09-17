"""Tests for Trans-Caspian Corridor Bankability Engine and MCP tool integration."""

from agenda_intelligence.corridor_bankability import (
    evaluate_covenants,
    screen_corridor_bankability,
)
from agenda_intelligence.mcp_stdio import handle_message


def test_corridor_bankability_free_teaser():
    payload = {
        "project_name": "Aktau Port Container Hub Expansion",
        "corridor_leg": "Aktau-Baku",
        "capex_usd_m": 85.0,
        "ifi_debt_usd_m": 60.0,
        "dscr_min": 1.35,
        "has_sovereign_guarantee": False,
        "currency_mismatch": True,
    }
    result = screen_corridor_bankability(payload, is_paid=False)

    assert result["project_name"] == "Aktau Port Container Hub Expansion"
    assert result["corridor_leg"] == "Aktau-Baku"
    assert result["bankability_status"] in ("BANKABLE_CORE", "CONDITIONALLY_BANKABLE")
    assert result["unlocked_full_dossier"] is False
    assert "full_dossier" not in result

    # Check x402 unlock challenge
    unlock = result["x402_unlock"]
    assert unlock["protocol"] == "x402"
    assert unlock["amount_usdc"] == 25.0
    assert unlock["network"] == "base"
    assert unlock["chain_id"] == 8453
    assert len(unlock["includes_in_full_tier"]) >= 4

    # Check covenant evaluation
    covenant_checks = result["covenant_checks"]
    floor_check = next(c for c in covenant_checks if c["test"] == "minimum_dscr_floor")
    assert floor_check["result"] == "PASSES"
    leverage_check = next(c for c in covenant_checks if c["test"] == "maximum_leverage")
    assert leverage_check["result"] == "PASSES"

    # Bottleneck analysis
    bottleneck = result["corridor_bottleneck_analysis"]
    assert "water level drop" in bottleneck["bottleneck_description"]


def test_corridor_bankability_paid_dossier():
    payload = {
        "project_name": "Khorgos Dry Port Yard Expansion",
        "corridor_leg": "Khorgos-Aktau",
        "capex_usd_m": 120.0,
        "ifi_debt_usd_m": 80.0,
        "dscr_min": 1.25,
        "has_sovereign_guarantee": False,
        "currency_mismatch": False,
    }
    result = screen_corridor_bankability(payload, is_paid=True)

    assert result["unlocked_full_dossier"] is True
    assert "x402_unlock" not in result

    full_dossier = result["full_dossier"]
    assert full_dossier["status"] == "UNLOCKED"
    assert full_dossier["settlement_currency"] == "USDC"
    assert full_dossier["settlement_network"] == "base"
    assert len(full_dossier["waterfall_schedule_15yr"]) == 15
    assert full_dossier["waterfall_schedule_15yr"][0]["year"] == 1
    assert full_dossier["waterfall_schedule_15yr"][-1]["year"] == 15

    # Check investment memo markdown
    memo = full_dossier["dossier_markdown"]
    assert "Khorgos Dry Port Yard Expansion" in memo
    assert "European Bank for Reconstruction and Development (EBRD)" in memo
    assert full_dossier["financial_model_sha256"]
    assert full_dossier["excel_financial_model_sha256"]


def test_sovereign_guarantee_covenants():
    checks, conditions = evaluate_covenants(
        dscr_min=1.10,
        debt_share=0.85,
        has_sovereign_guarantee=True,
    )

    floor_check = next(c for c in checks if c["test"] == "minimum_dscr_floor")
    assert floor_check["result"] == "NOT_APPLICABLE"

    leverage_check = next(c for c in checks if c["test"] == "maximum_leverage")
    assert leverage_check["result"] == "FAILS"

    assert any("decree number" in c for c in conditions)


def test_mcp_stdio_corridor_bankability_dispatch():
    message = {
        "jsonrpc": "2.0",
        "id": "test-bankability-1",
        "method": "tools/call",
        "params": {
            "name": "corridor_bankability_screen",
            "arguments": {
                "project_name": "Baku-Tbilisi Rail Terminal",
                "corridor_leg": "Baku-Poti",
                "capex_usd_m": 50.0,
                "ifi_debt_usd_m": 35.0,
                "dscr_min": 1.40,
            },
        },
    }

    response = handle_message(message)
    assert response is not None
    assert response["id"] == "test-bankability-1"
    assert "error" not in response
    content = response["result"]["content"]
    assert len(content) > 0

    import json
    data = json.loads(content[0]["text"])
    assert data["project_name"] == "Baku-Tbilisi Rail Terminal"
    assert data["unlocked_full_dossier"] is False
    assert data["x402_unlock"]["amount_usdc"] == 25.0


def test_corridor_bankability_smart_fallback():
    from agenda_intelligence.corridor_bankability import extract_bankability_parameters

    # Case 1: Unstructured prompt text
    extracted = extract_bankability_parameters(
        {}, raw_text="Screen debt covenants for Aktau ferry terminal expansion CapEx $45M on Aktau-Baku leg"
    )
    assert extracted["corridor_leg"] == "Aktau-Baku"
    assert extracted["capex_usd_m"] == 45.0
    assert extracted["ifi_debt_usd_m"] == 31.5
    assert extracted["dscr_min"] == 1.30
    assert "Terminal" in extracted["project_name"]

    # Case 2: MCP stdio tool call with partial/prompt argument
    msg = {
        "jsonrpc": "2.0",
        "id": "test-fallback-1",
        "method": "tools/call",
        "params": {
            "name": "corridor_bankability_screen",
            "arguments": {
                "prompt": "Evaluate Khorgos logistics dry port expansion $100M",
            },
        },
    }
    resp = handle_message(msg)
    assert resp is not None
    assert "error" not in resp
    import json

    res_data = json.loads(resp["result"]["content"][0]["text"])
    assert res_data["corridor_leg"] == "Khorgos-Aktau"
    assert res_data["financial_metrics"]["total_capex_usd_m"] == 100.0
    assert res_data["unlocked_full_dossier"] is False
    assert res_data["x402_unlock"]["amount_usdc"] == 25.0

