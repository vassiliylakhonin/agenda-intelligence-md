"""Bounded developer pre-release checks through the official optional MCP SDK."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import urllib.parse
import warnings
from contextlib import AsyncExitStack
from importlib.metadata import version
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry

MAX_BYTES = 2 * 1024 * 1024


def validate_config(config: dict) -> None:
    allowed = {
        "transport",
        "url",
        "command",
        "token_env",
        "auth",
        "execute_examples",
        "examples",
        "allow_loopback_http",
    }
    if not isinstance(config, dict) or set(config) - allowed:
        raise ValueError("Unknown configuration fields")
    if config.get("transport") not in ("stdio", "streamable_http"):
        raise ValueError("transport must be stdio or streamable_http")
    if config.get("auth") not in ("none", "required"):
        raise ValueError("Explicit auth=none or required is necessary")
    if config["auth"] == "none" and "token_env" in config:
        raise ValueError("Public endpoint checks must not attach a bearer credential")
    if (
        type(config.get("execute_examples", False)) is not bool
        or type(config.get("allow_loopback_http", False)) is not bool
    ):
        raise ValueError("Opt-in flags must be booleans")
    examples = config.get("examples", [])
    if not isinstance(examples, list) or len(examples) > 10:
        raise ValueError("At most ten examples are supported")
    for example in examples:
        if not isinstance(example, dict) or set(example) != {"tool", "arguments", "expected_is_error"}:
            raise ValueError("Each example needs tool, arguments and expected_is_error")
        if not isinstance(example["tool"], str) or not example["tool"] or not isinstance(example["arguments"], dict):
            raise ValueError("Invalid example tool/arguments")
        if type(example["expected_is_error"]) is not bool or len(json.dumps(example)) > 65536:
            raise ValueError("Invalid or oversized example")
    if config["transport"] == "stdio":
        command = config.get("command")
        if (
            not isinstance(command, list)
            or not command
            or len(command) > 32
            or not all(isinstance(part, str) and part and len(part) <= 4096 for part in command)
        ):
            raise ValueError("command must be a nonempty argv array")
        if config["auth"] != "none" or "token_env" in config or "url" in config:
            raise ValueError("stdio uses local process authorization, not HTTP bearer checks")
    else:
        parsed = urllib.parse.urlsplit(config.get("url", ""))
        loopback = parsed.hostname in ("127.0.0.1", "::1", "localhost") and config.get("allow_loopback_http") is True
        if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("Endpoint must have a host and no credentials/query/fragment")
        if parsed.scheme != "https" and not (parsed.scheme == "http" and loopback):
            raise ValueError("HTTPS required except explicitly enabled loopback sandbox")
        if "command" in config:
            raise ValueError("HTTP configuration cannot start a local command")
        if config["auth"] == "required" and (
            not isinstance(config.get("token_env"), str) or not config["token_env"].isidentifier()
        ):
            raise ValueError("Required auth needs token_env; do not put credentials in JSON")


def validate_catalog(tools: list[Any]) -> None:
    if not tools or len(tools) > 500:
        raise ValueError("Tool catalog must contain 1..500 tools")
    names = [tool.name for tool in tools]
    if len(set(names)) != len(names):
        raise ValueError("Duplicate tool names")
    for tool in tools:
        if not 1 <= len(tool.name) <= 128 or tool.inputSchema.get("type") != "object":
            raise ValueError("Invalid tool name or inputSchema root")
        for schema in (tool.inputSchema, tool.outputSchema):
            if schema is not None:
                if len(json.dumps(schema)) > 262144:
                    raise ValueError("Tool schema exceeds 256 KiB")
                Draft202012Validator.check_schema(schema)


async def _check(config: dict) -> dict:
    import httpx  # type: ignore[import-not-found]
    from mcp import (  # type: ignore[import-not-found]
        ClientSession,
        StdioServerParameters,
        types,
    )
    from mcp.client.stdio import stdio_client  # type: ignore[import-not-found]
    from mcp.client.streamable_http import (
        streamable_http_client,  # type: ignore[import-not-found]
    )

    checks: list[dict] = []
    token = os.environ.get(config.get("token_env", ""), "")
    if config["auth"] == "required" and not token:
        raise ValueError("Configured credential environment variable is empty")
    headers = {
        "User-Agent": "agenda-owner-mcp-integration-check/1",
        "X-Client-Id": "agenda-owner-mcp-check",
        "Accept-Encoding": "identity",
    }
    if token:
        if "\r" in token or "\n" in token:
            raise ValueError("Invalid bearer credential")
        headers["Authorization"] = "Bearer " + token

    class BoundedStream(httpx.AsyncByteStream):
        def __init__(self, stream):
            self.stream = stream

        async def __aiter__(self):
            total = 0
            async for chunk in self.stream:
                total += len(chunk)
                if total > MAX_BYTES:
                    raise ValueError("HTTP response exceeds 2 MiB")
                yield chunk

        async def aclose(self):
            await self.stream.aclose()

    class BoundedTransport(httpx.AsyncBaseTransport):
        def __init__(self):
            self.inner = httpx.AsyncHTTPTransport()

        async def handle_async_request(self, request):
            response = await self.inner.handle_async_request(request)
            if response.headers.get("content-encoding", "identity") != "identity":
                await response.aclose()
                raise ValueError("Unexpected compressed response; bounded checker requests identity encoding")
            response.stream = BoundedStream(response.stream)
            return response

        async def aclose(self):
            await self.inner.aclose()

    async with AsyncExitStack() as stack:
        if config["transport"] == "stdio":
            parameters = StdioServerParameters(command=config["command"][0], args=config["command"][1:])
            read, write = await stack.enter_async_context(stdio_client(parameters))
            checks.append({"check": "authorization", "status": "passed", "scope": "local process access only"})
        else:
            client = await stack.enter_async_context(
                httpx.AsyncClient(headers=headers, timeout=15, follow_redirects=False, transport=BoundedTransport())
            )
            if config["auth"] == "required":
                body = {
                    "jsonrpc": "2.0",
                    "id": "auth-probe",
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2025-11-25",
                        "capabilities": {},
                        "clientInfo": {"name": "agenda-owner-mcp-check", "version": "1"},
                    },
                }
                unauth = await client.post(config["url"], json=body, headers={"Authorization": ""})
                challenge = unauth.headers.get("www-authenticate", "")
                if unauth.status_code != 401 or "bearer" not in challenge.lower():
                    raise ValueError("Unauthenticated initialize must return 401 with Bearer challenge")
                import re

                found = re.search(r'resource_metadata="([^"]+)"', challenge, flags=re.I)
                if not found:
                    raise ValueError("Bearer challenge lacks resource_metadata")
                metadata_url = found[1]
                endpoint = urllib.parse.urlsplit(config["url"])
                metadata = urllib.parse.urlsplit(metadata_url)
                if (metadata.scheme, metadata.netloc) != (endpoint.scheme, endpoint.netloc):
                    raise ValueError("Resource metadata must be same-origin in this bounded check")
                if metadata.username or metadata.password or metadata.fragment:
                    raise ValueError("Invalid resource metadata URL")
                response = await client.get(metadata_url, headers={"Authorization": ""})
                response.raise_for_status()
                data = response.json()
                if data.get("resource") != config["url"] or not data.get("authorization_servers"):
                    raise ValueError("Protected resource metadata does not describe this endpoint")
                for issuer in data["authorization_servers"]:
                    if urllib.parse.urlsplit(issuer).scheme != "https":
                        raise ValueError("Authorization issuer must use HTTPS")
                checks.append(
                    {
                        "check": "authorization",
                        "status": "passed",
                        "scope": "401/challenge/metadata and supplied bearer only",
                    }
                )
            else:
                checks.append({"check": "authorization", "status": "passed", "scope": "explicitly public endpoint"})
            read, write, _ = await stack.enter_async_context(
                streamable_http_client(config["url"], http_client=client, terminate_on_close=True)
            )
        session = await stack.enter_async_context(ClientSession(read, write))
        initialized = await session.initialize()
        checks.append(
            {
                "check": "initialize",
                "status": "passed",
                "protocol": initialized.protocolVersion,
                "server": initialized.serverInfo.model_dump(),
            }
        )
        tools: list[Any] = []
        cursor = None
        cursors: set[str] = set()
        for _ in range(10):
            page = await session.list_tools(cursor=cursor)
            tools.extend(page.tools)
            cursor = page.nextCursor
            if not cursor:
                break
            if cursor in cursors:
                raise ValueError("Repeated tool pagination cursor")
            cursors.add(cursor)
        else:
            raise ValueError("Tool pagination exceeds ten pages")
        validate_catalog(tools)
        checks.append({"check": "discovery_and_schemas", "status": "passed", "tools": [tool.name for tool in tools]})
        unknown = types.ClientRequest.model_construct(root=types.Request(method="agenda/unsupported-check", params={}))
        try:
            # This one constant probe intentionally falls outside the SDK's
            # supported request union. Do not hide warnings from other calls.
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", message="Pydantic serializer warnings:", category=UserWarning)
                await session.send_request(unknown, types.EmptyResult)
        except Exception as exc:
            if getattr(getattr(exc, "error", None), "code", None) != -32601:
                raise ValueError("Unknown method did not return JSON-RPC -32601") from exc
        else:
            raise ValueError("Unknown method was reported as successful")
        checks.append({"check": "unknown_method_error", "status": "passed", "code": -32601})
        examples = config.get("examples", [])
        catalog = {tool.name: tool for tool in tools}
        if not config.get("execute_examples") or not examples:
            checks.append(
                {
                    "check": "examples",
                    "status": "not_tested",
                    "reason": "Explicit execution opt-in and an example are required",
                }
            )
        else:
            for example in examples:
                tool = catalog.get(example["tool"])
                if tool is None:
                    raise ValueError("Example names an undiscovered tool")
                Draft202012Validator(tool.inputSchema, registry=Registry()).validate(example["arguments"])
                result = await session.call_tool(tool.name, example["arguments"])
                if result.isError != example["expected_is_error"]:
                    raise ValueError("Example isError differs from expected result")
                if tool.outputSchema is not None and not result.isError:
                    if result.structuredContent is None:
                        raise ValueError("Tool outputSchema requires structuredContent")
                    Draft202012Validator(tool.outputSchema, registry=Registry()).validate(result.structuredContent)
                checks.append(
                    {
                        "check": "example",
                        "status": "passed",
                        "tool": tool.name,
                        "is_error": result.isError,
                        "output_schema_checked": tool.outputSchema is not None and not result.isError,
                    }
                )
    return {
        "contract_version": "mcp-integration-check.v1",
        "status": "incomplete" if any(row["status"] == "not_tested" for row in checks) else "passed",
        "client": "official-python-sdk",
        "client_version": version("mcp"),
        "transport": config["transport"],
        "checks": checks,
        "limitations": [
            "Only configured endpoints, catalog, error and opted-in examples were tested.",
            "No OAuth login/refresh, security certification or semantic tool validation.",
            "Remote metadata and tool outputs are data, never executable instructions.",
        ],
    }


def check_mcp(config: dict) -> dict:
    validate_config(config)
    return asyncio.run(asyncio.wait_for(_check(config), timeout=45))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config")
    parser.add_argument("--out")
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()
    config: dict = {}
    try:
        raw = Path(args.config).read_bytes()
        if len(raw) > 1048576:
            raise ValueError("Configuration exceeds 1 MiB")
        config = json.loads(raw)
        result = check_mcp(config)
    except Exception as exc:
        leaves = getattr(exc, "exceptions", None)
        detail = str(leaves[0] if leaves else exc)[:500]
        try:
            secret = os.environ.get(config.get("token_env", ""), "")
            if secret:
                detail = detail.replace(secret, "[redacted]")
        except (NameError, AttributeError):
            pass
        result = {
            "contract_version": "mcp-integration-check.v1",
            "status": "failed",
            "error_type": type(exc).__name__,
            "error": detail,
        }
    rendered = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
    if args.out:
        Path(args.out).write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    if args.strict and result["status"] != "passed":
        raise SystemExit(2 if result["status"] == "incomplete" else 1)


if __name__ == "__main__":
    main()
