"""Offline failure-path tests for the read-only discovery monitor."""

import asyncio
import importlib.util
import io
import json
import subprocess
import sys
import tomllib
from contextlib import asynccontextmanager
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

SPEC = importlib.util.spec_from_file_location(
    "live_mcp_monitor", Path(__file__).parents[1] / "scripts/check_live_mcp.py"
)
monitor = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(monitor)


def test_default_urllib_probe_is_marked_without_changing_user_agent(monkeypatch):
    requests = []

    class Response(io.BytesIO):
        status = 200
        headers = {}

    def urlopen(request, timeout):
        requests.append(request)
        return Response(b'{"result":{}}')

    monkeypatch.setattr(monitor.READ_OPENER, "open", urlopen)
    assert monitor.probe("https://example.test/mcp", monitor.default_initialize(), identify=False)["status"] == 200
    assert requests[0].get_header("X-client-id") == monitor.OWNER_CLIENT_ID
    assert requests[0].get_header("User-agent") is None


def test_sdk_monitor_is_marked_without_overriding_default_user_agent(monkeypatch):
    options = []

    @asynccontextmanager
    async def transport(url, **kwargs):
        options.append(kwargs)
        yield None, None, None

    class Session:
        async def initialize(self):
            return SimpleNamespace(protocolVersion="2025-11-25")

        async def list_tools(self):
            return SimpleNamespace(tools=[SimpleNamespace(name="example", inputSchema={"type": "object"})])

    @asynccontextmanager
    async def session(read, write):
        yield Session()

    mcp = ModuleType("mcp")
    mcp.ClientSession = session
    client = ModuleType("mcp.client")
    stream = ModuleType("mcp.client.streamable_http")
    stream.streamablehttp_client = transport
    for name, module in [("mcp", mcp), ("mcp.client", client), ("mcp.client.streamable_http", stream)]:
        monkeypatch.setitem(sys.modules, name, module)
    assert asyncio.run(monitor.sdk_discovery("https://example.test/mcp", ["example"]))["tools"] == ["example"]
    assert options[0]["headers"] == {"X-Client-Id": monitor.OWNER_CLIENT_ID}


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


def test_monitor_origins_and_catalog_match_the_actual_hosted_runtime():
    config = tomllib.loads((monitor.ROOT / "deploy/cloudflare-worker/wrangler.toml").read_text())
    targets = [config, *config["env"].values()]
    inputs = [{"name": target["name"], "profile": target["vars"]["AGENT_PROFILE"]} for target in targets]
    script = """
    import {handleRequest} from './deploy/cloudflare-worker/src/index.js';
    let text='';for await (const chunk of process.stdin) text+=chunk;
    console.log=()=>{};
    const fleet=await (await handleRequest(new Request('https://example.test/.well-known/fleet.json'))).json();
    const result={};
    for(const item of JSON.parse(text)) {
      const response=await handleRequest(new Request('https://example.test/mcp',{
        method:'POST',headers:{'content-type':'application/json','x-client-id':'agenda-owner-monitor-contract'},
        body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})
      }),{AGENT_PROFILE:item.profile,WORKER_FREE_TRIAL:'1'});
      result[item.name]={origin:fleet.gates.find(g=>g.profile===item.profile).canonical_endpoint,
        tools:(await response.json()).result.tools.map(t=>t.name)};
    }
    process.stdout.write(JSON.stringify(result));
    """
    actual = json.loads(
        subprocess.run(
            ["node", "--input-type=module", "-e", script],
            input=json.dumps(inputs),
            cwd=monitor.ROOT,
            text=True,
            capture_output=True,
            check=True,
        ).stdout
    )
    baseline = json.loads((monitor.ROOT / "scripts/mcp-catalog-baseline.json").read_text())
    origins = monitor.fleet_origins()
    for name, value in actual.items():
        assert origins[name] == value["origin"]
        assert set(baseline[name]) == set(value["tools"])
    assert origins["vizier"] == "https://vizier.agendamcp.dpdns.org"


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
    requested_urls = []

    def probe(url, body=None, identify=True):
        requested_urls.append(url)
        if url.endswith("/health"):
            health_calls.append(1)
            if len(health_calls) == 1:
                raise RemoteDisconnected("Remote end closed connection without response")
            data = {"status": "ok"}
        elif url.endswith("/agent-card.json"):
            data = {"name": name, "skills": ["verify"]}
        elif url.endswith("/jwks.json"):
            data = {"keys": []}
        elif not identify:
            return {"status": 403, "data": {"cloudflare_error": True, "error_code": 1010}, "ray_id": "test"}
        elif body["method"] == "initialize":
            data = {"result": {"protocolVersion": "2025-03-26", "serverInfo": {"name": name}}}
        else:
            data = {"result": {"tools": [{"name": tool} for tool in baseline[name]]}}
        return {"status": 200, "data": data, "ray_id": "test"}

    async def sdk(url, expected):
        requested_urls.append(url)
        return {"tools": expected, "protocol": "2025-03-26"}

    monkeypatch.setattr(monitor, "probe", probe)
    monkeypatch.setattr(monitor, "sdk_discovery", sdk)
    monkeypatch.setattr(monitor, "verify_card_signature", lambda *args: {"passed": True})
    host = asyncio.run(monitor.check_host(name))
    assert all(check["passed"] for check in host["checks"])
    assert len(health_calls) == 2
    assert host["transport_events"][0]["check"] == "health"
    assert host["default_urllib"]["classification"] == "cloudflare_browser_signature_banned"
    assert all(url.startswith("https://vizier.agendamcp.dpdns.org/") for url in requested_urls)


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


def test_signature_verifier_contracts():
    subprocess.run(
        ["node", "--test", "tests/test_agent_card_monitor.mjs"],
        cwd=monitor.ROOT,
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )


@pytest.mark.parametrize("raw", [b'{"name":"first","name":"second"}', b'{"name":NaN}', b'{"name":'])
def test_signed_discovery_json_refuses_ambiguous_or_invalid_documents(monkeypatch, raw):
    class Response(io.BytesIO):
        status = 200
        headers = {}

    monkeypatch.setattr(monitor.READ_OPENER, "open", lambda *args, **kwargs: Response(raw))
    for path in ["/.well-known/agent-card.json", "/.well-known/jwks.json"]:
        with pytest.raises(ValueError, match="Invalid signed discovery JSON"):
            monitor.probe("https://example.test" + path)


def test_monitor_rejects_redirect_without_following_it():
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    paths = []

    class Redirect(BaseHTTPRequestHandler):
        def do_GET(self):
            paths.append(self.path)
            self.send_response(302 if self.path == "/start" else 200)
            self.send_header("Location", "/unexpected")
            self.end_headers()

        def log_message(self, *_args):
            pass

    with ThreadingHTTPServer(("127.0.0.1", 0), Redirect) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            result = monitor.probe(f"http://127.0.0.1:{server.server_port}/start")
            assert result["status"] == 302
            assert paths == ["/start"]
        finally:
            server.shutdown()
            thread.join()


def test_invalid_signature_makes_the_complete_host_check_fail(monkeypatch):
    name = "vizier"
    baseline = json.loads((monitor.ROOT / "scripts/mcp-catalog-baseline.json").read_text())[name]
    requests = []

    def probe(url, body=None, identify=True):
        requests.append(url)
        if url.endswith("/health"):
            data = {"status": "ok"}
        elif url.endswith("/agent-card.json"):
            data = {"name": "Fixture", "skills": ["verify"]}
        elif url.endswith("/jwks.json"):
            data = {"keys": []}
        elif body["method"] == "initialize":
            data = {"result": {"protocolVersion": "2025-03-26", "serverInfo": {"name": name}}}
        else:
            data = {"result": {"tools": [{"name": value} for value in baseline]}}
        return {"status": 200, "data": data, "ray_id": "fixture"}

    async def sdk(url, expected):
        return {"tools": expected, "protocol": "2025-03-26"}

    monkeypatch.setattr(monitor, "probe", probe)
    monkeypatch.setattr(monitor, "sdk_discovery", sdk)
    monkeypatch.setattr(
        monitor, "verify_card_signature", lambda *args: {"passed": False, "reason": "invalid_signature"}
    )
    host = asyncio.run(monitor.check_host(name))
    signature = next(check for check in host["checks"] if check["check"] == "a2a_card_signature")
    assert not signature["passed"]
    assert monitor.failed({"hosts": [host]})
    assert requests.count("https://vizier.agendamcp.dpdns.org/.well-known/jwks.json") == 1
    assert all(url.startswith("https://vizier.agendamcp.dpdns.org/") for url in requests)
