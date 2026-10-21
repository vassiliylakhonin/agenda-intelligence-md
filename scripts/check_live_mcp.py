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
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = "Agenda-MCP-Monitor/1.0"
OWNER_CLIENT_ID = "agenda-owner-mcp-monitor"
MAX_BYTES = 1_000_000
CORRIDOR = "corridor-bankability-analyst"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


READ_OPENER = urllib.request.build_opener(NoRedirect)


def unique_json_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate field in signed discovery JSON")
        result[key] = value
    return result


def reject_json_constant(_value):
    raise ValueError("Non-finite value in signed discovery JSON")


def verify_card_signature(origin, card, jwks):
    """Offline public-key check; the subprocess never fetches a key URL."""
    run = subprocess.run(
        ["node", str(ROOT / "scripts/verify_agent_card.mjs")],
        input=json.dumps(
            {"origin": origin, "card": card, "jwks": jwks}, ensure_ascii=False, separators=(",", ":"), allow_nan=False
        ),
        capture_output=True,
        text=True,
        timeout=10,
    )
    try:
        result = json.loads(run.stdout)
    except ValueError as error:
        raise ValueError("Signature verifier did not return a JSON result") from error
    if not isinstance(result, dict) or type(result.get("passed")) is not bool:
        raise ValueError("Invalid signature verifier result")
    if run.returncode != 0 and result["passed"]:
        raise ValueError("Signature verifier failed")
    return result


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
    return list(dict.fromkeys([*names, "vizier", CORRIDOR]))


def fleet_origins():
    origins = json.loads((ROOT / "scripts/mcp-monitor-origins.json").read_text())
    if set(origins) != set(fleet_names()) or any(
        not isinstance(origin, str) or re.fullmatch(r"https://(?:[a-z0-9-]+\.)?agendamcp\.dpdns\.org", origin) is None
        for origin in origins.values()
    ):
        raise ValueError("Monitor requires an explicit canonical origin for every configured Worker")
    return origins


def probe(url, body=None, identify=True):
    headers = {"Accept": "application/json, text/event-stream", "X-Client-Id": OWNER_CLIENT_ID}
    if identify:
        headers["User-Agent"] = USER_AGENT
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers=headers)
    try:
        response = READ_OPENER.open(request, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("Response exceeded monitor size limit")
        signed_document = urllib.parse.urlsplit(url).path in {"/.well-known/agent-card.json", "/.well-known/jwks.json"}
        try:
            data = json.loads(raw, object_pairs_hook=unique_json_object, parse_constant=reject_json_constant)
        except ValueError:
            if signed_document and response.status == 200:
                raise ValueError("Invalid signed discovery JSON") from None
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
    # Preserve the SDK's normal User-Agent while marking this owner-run monitor.
    # The marker affects telemetry classification only, never access or billing.
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    async with streamablehttp_client(
        url,
        headers={"X-Client-Id": OWNER_CLIENT_ID},
        timeout=timedelta(seconds=20),
        sse_read_timeout=timedelta(seconds=20),
        terminate_on_close=False,
    ) as (read, write, _):
        async with ClientSession(read, write) as session:
            initialized = await session.initialize()
            catalog = await session.list_tools()
            return {"protocol": initialized.protocolVersion, "tools": validate_catalog(catalog.tools, expected)}


def dependency_ready(data, require_snapshot=False):
    """Liveness and a catalog do not establish usable upstream data."""
    snapshot = data.get("snapshot", {})
    if not require_snapshot:
        return snapshot.get("status") in {"disabled", "success"}
    age, limit = snapshot.get("age_ms"), snapshot.get("max_age_ms")
    return (
        snapshot.get("status") == "success"
        and type(age) in (int, float)
        and type(limit) in (int, float)
        and 0 <= age <= limit <= 259200000
    )


async def check_host(name):
    origin = fleet_origins()[name]
    baseline = json.loads((ROOT / "scripts/mcp-catalog-baseline.json").read_text())
    checks = []
    transport_events = []

    async def read_probe(label, *args):
        return await transport_retry(lambda: asyncio.to_thread(probe, *args), label, transport_events)

    card = None
    discovery_paths = (
        [("health", "/healthz"), ("mcp_manifest", "/.well-known/mcp.json")]
        if name == CORRIDOR
        else [("health", "/health"), ("a2a_card", "/.well-known/agent-card.json")]
    )
    for label, path in discovery_paths:
        try:
            response = await read_probe(label, origin + path)
            data = response["data"]
            valid = response["status"] == 200 and bool(data)
            if label == "mcp_manifest":
                valid = valid and data.get("mcp_url") == origin + "/mcp" and bool(data.get("authentication"))
            if label == "a2a_card":
                valid = valid and isinstance(data, dict) and bool(data.get("skills")) and bool(data.get("name"))
                if valid:
                    card = data
            checks.append({"check": label, "passed": valid, "status": response["status"]})
        except Exception as error:
            checks.append({"check": label, "passed": False, "error": str(error)[:500]})
    # Corridor publishes MCP metadata only; do not invent signature coverage.
    if name != CORRIDOR:
        try:
            if card is None:
                raise ValueError("Signed card unavailable")
            jwks = await read_probe("a2a_card_jwks", origin + "/.well-known/jwks.json")
            if jwks["status"] != 200:
                raise ValueError("Public JWKS unavailable")
            signature = await asyncio.to_thread(verify_card_signature, origin, card, jwks["data"])
            checks.append({"check": "a2a_card_signature", **signature})
        except Exception as error:
            checks.append({"check": "a2a_card_signature", "passed": False, "error": str(error)[:500]})
    if name not in {"vizier", CORRIDOR}:
        try:
            response = await read_probe("dependency_readiness", origin + "/health/dependencies")
            valid = response["status"] == 200 and dependency_ready(
                response["data"], require_snapshot=name == "cis-secondary-sanctions-a2a"
            )
            checks.append({"check": "dependency_readiness", "passed": valid, **response})
        except Exception as error:
            checks.append({"check": "dependency_readiness", "passed": False, "error": str(error)[:500]})
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
    return {
        "host": name,
        "origin": origin,
        "checks": checks,
        "default_urllib": compatibility,
        "transport_events": transport_events,
    }


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
    lines = [
        "# Live MCP discovery",
        "",
        "| Host | SDK / urllib app / health / discovery / dependencies | Card signature | Default urllib |",
        "|---|---|---|---|",
    ]
    for host in hosts:
        passed = all(check["passed"] for check in host["checks"])
        signature = next((check for check in host["checks"] if check["check"] == "a2a_card_signature"), None)
        signature_label = "N/A (MCP only)" if signature is None else "PASS" if signature["passed"] else "FAIL"
        lines.append(
            f"| {host['host']} | {'PASS' if passed else 'FAIL'} | "
            f"{signature_label} | {host['default_urllib']['classification']} |"
        )
    summary = "\n".join(lines) + "\n"
    print(summary)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as stream:
            stream.write(summary)
    raise SystemExit(1 if failed(report, args.require_default_urllib) else 0)


if __name__ == "__main__":
    asyncio.run(main())
