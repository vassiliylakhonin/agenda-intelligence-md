#!/usr/bin/env python3
"""Read-only discovery monitoring. No paid calls, grants, keys or settlement."""

import argparse
import asyncio
import http.client
import json
import os
import re
import socket
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = "Agenda-MCP-Monitor/1.0"
MAX_BYTES = 1_000_000


def transient_transport_error(error):
    """Retry transport interruptions only, never HTTP, TLS trust or contract failures."""
    cause = error
    seen = set()
    while isinstance(cause, BaseException) and id(cause) not in seen:
        seen.add(id(cause))
        if isinstance(cause, ssl.SSLCertVerificationError):
            return False
        cause = cause.__cause__ or cause.__context__
    nested = getattr(error, "exceptions", None)
    if nested is not None:
        return bool(nested) and all(transient_transport_error(item) for item in nested)
    if isinstance(error, urllib.error.HTTPError):
        return False
    if isinstance(error, urllib.error.URLError):
        return transient_transport_error(error.reason)
    if isinstance(error, ssl.SSLCertVerificationError):
        return False
    if isinstance(error, (ConnectionError, TimeoutError, socket.gaierror, ssl.SSLEOFError, http.client.IncompleteRead)):
        return True
    # SDK HTTP transport failures may be wrapped in an AnyIO exception group.
    try:
        import httpx
    except ImportError:
        return False

    return isinstance(error, (httpx.TimeoutException, httpx.NetworkError, httpx.RemoteProtocolError))


async def transport_retry(operation, label, events, delay=0.5):
    """At most three attempts for read-only discovery; retain every interruption."""
    for attempt in range(1, 4):
        try:
            return await operation()
        except Exception as error:
            if not transient_transport_error(error):
                raise
            events.append({"check": label, "attempt": attempt, "error": str(error)[:500]})
            if attempt == 3:
                raise
            await asyncio.sleep(delay * attempt)


def fleet_names():
    names = re.findall(r'^name\s*=\s*"([^"\n]+)"', (ROOT / "deploy/cloudflare-worker/wrangler.toml").read_text(), re.M)
    return list(dict.fromkeys([*names, "vizier"]))


def probe(url, body=None, identify=True):
    headers = {"Accept": "application/json, text/event-stream"}
    if identify:
        headers["User-Agent"] = USER_AGENT
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers=headers)
    try:
        response = urllib.request.urlopen(request, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("Response exceeded monitor size limit")
        try:
            data = json.loads(raw)
        except ValueError:
            data = {}
        return {"status": response.status, "data": data, "ray_id": response.headers.get("CF-Ray")}


def default_initialize():
    return {
        "jsonrpc": "2.0",
        "id": "compatibility-monitor",
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "Agenda-MCP-Monitor", "version": "1.0"},
        },
    }


def compatible_initialize(response):
    result = response.get("data", {}).get("result", {})
    return response["status"] == 200 and bool(result.get("protocolVersion")) and bool(result.get("serverInfo"))


def classify_edge(response):
    data = response.get("data", {})
    if response["status"] == 403 and data.get("cloudflare_error") is True and data.get("error_code") == 1010:
        return "cloudflare_browser_signature_banned"
    return "other_http_or_protocol_failure"


def validate_catalog(tools, expected=None):
    if not tools:
        raise ValueError("Empty MCP tool catalog")
    names = [tool.name for tool in tools]
    if len(names) != len(set(names)):
        raise ValueError("Duplicate MCP tool names")
    for tool in tools:
        if tool.inputSchema.get("type") != "object":
            raise ValueError(f"Invalid input schema: {tool.name}")
    if expected is not None and set(names) != set(expected):
        raise ValueError(
            f"MCP catalog drift: missing={sorted(set(expected) - set(names))}; "
            f"unexpected={sorted(set(names) - set(expected))}"
        )
    return names


async def sdk_discovery(url, expected):
    # Deliberately no custom headers: exercise the normal MCP SDK client identity.
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    async with streamablehttp_client(
        url, timeout=timedelta(seconds=20), sse_read_timeout=timedelta(seconds=20), terminate_on_close=False
    ) as (read, write, _):
        async with ClientSession(read, write) as session:
            initialized = await session.initialize()
            catalog = await session.list_tools()
            return {"protocol": initialized.protocolVersion, "tools": validate_catalog(catalog.tools, expected)}


async def check_host(name):
    origin = f"https://{name}.vassiliy-lakhonin.workers.dev"
    baseline = json.loads((ROOT / "scripts/mcp-catalog-baseline.json").read_text())
    checks = []
    transport_events = []

    async def read_probe(label, *args):
        return await transport_retry(lambda: asyncio.to_thread(probe, *args), label, transport_events)

    for label, path in [("health", "/health"), ("a2a_card", "/.well-known/agent-card.json")]:
        try:
            response = await read_probe(label, origin + path)
            data = response["data"]
            valid = response["status"] == 200 and bool(data)
            if label == "a2a_card":
                valid = valid and bool(data.get("skills")) and bool(data.get("name"))
            checks.append({"check": label, "passed": valid, "status": response["status"]})
        except Exception as error:
            checks.append({"check": label, "passed": False, "error": str(error)[:500]})
    try:
        discovery = await transport_retry(
            lambda: asyncio.wait_for(sdk_discovery(origin + "/mcp", baseline[name]), timeout=50),
            "mcp_sdk_default_identity",
            transport_events,
        )
        checks.append({"check": "mcp_sdk_default_identity", "passed": True, **discovery})
    except Exception as error:
        checks.append({"check": "mcp_sdk_default_identity", "passed": False, "error": str(error)[:500]})
    try:
        initialized = await read_probe("urllib_application_initialize", origin + "/mcp", default_initialize())
        listing = await read_probe(
            "urllib_application_tools",
            origin + "/mcp",
            {"jsonrpc": "2.0", "id": "urllib-tools", "method": "tools/list", "params": {}},
        )
        tools = listing["data"].get("result", {}).get("tools", [])
        names = [tool["name"] for tool in tools]
        valid = (
            compatible_initialize(initialized)
            and listing["status"] == 200
            and len(names) == len(set(names))
            and set(names) == set(baseline[name])
        )
        checks.append({"check": "urllib_application_identity", "passed": valid, "tools": names})
    except Exception as error:
        checks.append({"check": "urllib_application_identity", "passed": False, "error": str(error)[:500]})
    try:
        response = await read_probe("default_urllib", origin + "/mcp", default_initialize(), False)
        compatible = compatible_initialize(response)
        compatibility = {
            "passed": compatible,
            "status": response["status"],
            "classification": "compatible" if compatible else classify_edge(response),
            "ray_id": response["ray_id"],
        }
    except Exception as error:
        compatibility = {"passed": False, "classification": "transport_error", "error": str(error)[:500]}
    return {"host": name, "checks": checks, "default_urllib": compatibility, "transport_events": transport_events}


def failed(report, require_default_urllib=False):
    return any(
        not all(check["passed"] for check in host["checks"])
        or (require_default_urllib and not host["default_urllib"]["passed"])
        for host in report["hosts"]
    )


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("live-mcp-report.json"))
    parser.add_argument("--require-default-urllib", action="store_true")
    parser.add_argument("--worker", choices=fleet_names())
    args = parser.parse_args()
    semaphore = asyncio.Semaphore(3)

    async def limited(name):
        async with semaphore:
            return await check_host(name)

    hosts = await asyncio.gather(*(limited(name) for name in ([args.worker] if args.worker else fleet_names())))
    report = {"checked_at": datetime.now(timezone.utc).isoformat(), "read_only": True, "hosts": hosts}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    lines = ["# Live MCP discovery", "", "| Host | SDK / urllib app / health / A2A | Default urllib |", "|---|---|---|"]
    for host in hosts:
        passed = all(check["passed"] for check in host["checks"])
        lines.append(
            f"| {host['host']} | {'PASS' if passed else 'FAIL'} | {host['default_urllib']['classification']} |"
        )
    summary = "\n".join(lines) + "\n"
    print(summary)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as stream:
            stream.write(summary)
    raise SystemExit(1 if failed(report, args.require_default_urllib) else 0)


if __name__ == "__main__":
    asyncio.run(main())
