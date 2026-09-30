"""Offline failure-path tests for the read-only discovery monitor."""

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest

SPEC = importlib.util.spec_from_file_location(
    "live_mcp_monitor", Path(__file__).parents[1] / "scripts/check_live_mcp.py"
)
monitor = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(monitor)


def test_edge_attribution_requires_cloudflare_evidence():
    response = {"status": 403, "data": {"error_code": 1010, "cloudflare_error": True}}
    assert monitor.classify_edge(response) == "cloudflare_browser_signature_banned"
    response["data"]["cloudflare_error"] = False
    assert monitor.classify_edge(response) == "other_http_or_protocol_failure"


def test_200_error_is_not_initialize_success():
    assert not monitor.compatible_initialize({"status": 200, "data": {"error": {"code": -32600}}})


def test_default_urllib_has_separate_strict_gate():
    report = {"hosts": [{"checks": [{"passed": True}], "default_urllib": {"passed": False}}]}
    assert not monitor.failed(report)
    assert monitor.failed(report, True)
    report["hosts"][0]["checks"][0]["passed"] = False
    assert monitor.failed(report)


def test_duplicate_or_empty_tools_fail():
    tool = SimpleNamespace(name="test", inputSchema={"type": "object"})
    assert monitor.validate_catalog([tool]) == ["test"]
    for tools in [[], [tool, tool]]:
        with pytest.raises(ValueError):
            monitor.validate_catalog(tools)


def test_all_configured_workers_plus_vizier():
    names = monitor.fleet_names()
    assert len(names) == 13
    assert names.count("vizier") == 1
    assert "m2m-escrow-arbiter-a2a" in names


def test_missing_or_renamed_tool_is_a_regression():
    tool = SimpleNamespace(name="test", inputSchema={"type": "object"})
    with pytest.raises(ValueError, match="catalog drift"):
        monitor.validate_catalog([tool], ["test", "required_tool"])
    with pytest.raises(ValueError, match="catalog drift"):
        monitor.validate_catalog([tool], ["old_name"])


def test_baseline_covers_fleet():
    import json

    baseline = json.loads((monitor.ROOT / "scripts/mcp-catalog-baseline.json").read_text())
    assert set(baseline) == set(monitor.fleet_names())
