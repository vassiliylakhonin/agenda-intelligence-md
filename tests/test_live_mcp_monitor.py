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


def test_transport_retry_recovers_and_records_disconnect():
    import asyncio
    from http.client import RemoteDisconnected

    calls = []
    events = []

    async def operation():
        calls.append(1)
        if len(calls) == 1:
            raise RemoteDisconnected("Remote end closed connection without response")
        return {"status": 200}

    assert asyncio.run(monitor.transport_retry(operation, "health", events, delay=0)) == {"status": 200}
    assert len(calls) == 2
    assert events[0]["check"] == "health"
    assert events[0]["attempt"] == 1


def test_transport_retry_keeps_persistent_failure():
    import asyncio
    import ssl

    calls = []

    async def operation():
        calls.append(1)
        raise ssl.SSLEOFError("unexpected EOF")

    with pytest.raises(ssl.SSLEOFError):
        asyncio.run(monitor.transport_retry(operation, "health", [], delay=0))
    assert len(calls) == 3


@pytest.mark.parametrize("error", [ValueError("catalog drift"), RuntimeError("protocol failure")])
def test_transport_retry_does_not_retry_contract_errors(error):
    import asyncio

    calls = []

    async def operation():
        calls.append(1)
        raise error

    with pytest.raises(type(error)):
        asyncio.run(monitor.transport_retry(operation, "sdk", [], delay=0))
    assert len(calls) == 1


def test_transport_retry_keeps_http_refusal_and_certificate_failure():
    import asyncio
    import ssl

    async def refusal():
        return {"status": 403}

    events = []
    assert asyncio.run(monitor.transport_retry(refusal, "urllib", events, delay=0)) == {"status": 403}
    assert events == []
    assert not monitor.transient_transport_error(ssl.SSLCertVerificationError("invalid certificate"))


def test_sdk_exception_group_requires_only_transport_errors():
    from http.client import RemoteDisconnected

    assert monitor.transient_transport_error(ExceptionGroup("sdk", [RemoteDisconnected()]))
    assert not monitor.transient_transport_error(ExceptionGroup("sdk", [RemoteDisconnected(), ValueError()]))


def test_check_host_recovers_health_transport_but_reports_default_403(monkeypatch):
    import asyncio
    from http.client import RemoteDisconnected

    baseline = __import__("json").loads((monitor.ROOT / "scripts/mcp-catalog-baseline.json").read_text())
    name = "vizier"
    health_calls = []

    def probe(url, body=None, identify=True):
        if url.endswith("/health"):
            health_calls.append(1)
            if len(health_calls) == 1:
                raise RemoteDisconnected("Remote end closed connection without response")
            data = {"status": "ok"}
        elif url.endswith("/agent-card.json"):
            data = {"name": name, "skills": ["verify"]}
        elif not identify:
            return {"status": 403, "data": {"cloudflare_error": True, "error_code": 1010}, "ray_id": "test"}
        elif body["method"] == "initialize":
            data = {"result": {"protocolVersion": "2025-03-26", "serverInfo": {"name": name}}}
        else:
            data = {"result": {"tools": [{"name": tool} for tool in baseline[name]]}}
        return {"status": 200, "data": data, "ray_id": "test"}

    async def sdk(url, expected):
        return {"tools": expected, "protocol": "2025-03-26"}

    monkeypatch.setattr(monitor, "probe", probe)
    monkeypatch.setattr(monitor, "sdk_discovery", sdk)
    host = asyncio.run(monitor.check_host(name))
    assert all(check["passed"] for check in host["checks"])
    assert len(health_calls) == 2
    assert host["transport_events"][0]["check"] == "health"
    assert host["default_urllib"]["classification"] == "cloudflare_browser_signature_banned"


def test_sdk_wrapped_certificate_failure_is_not_transient():
    import ssl

    httpx = pytest.importorskip("httpx")

    try:
        try:
            raise ssl.SSLCertVerificationError("invalid certificate")
        except ssl.SSLCertVerificationError as error:
            raise httpx.ConnectError("TLS connect failed") from error
    except httpx.ConnectError as error:
        assert not monitor.transient_transport_error(error)


def test_transport_classification_works_without_optional_sdk(monkeypatch):
    import builtins

    original_import = builtins.__import__

    def without_httpx(name, *args, **kwargs):
        if name == "httpx":
            raise ImportError("SDK not installed")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", without_httpx)
    assert not monitor.transient_transport_error(ValueError("catalog drift"))
