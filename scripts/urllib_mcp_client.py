#!/usr/bin/env python3
"""MCP discovery with urllib and an explicit application User-Agent."""

import argparse
import json
from urllib.request import Request, urlopen

USER_AGENT = "Agenda-urllib-client/1.0"


def rpc(endpoint, method, params=None, request_id=1):
    body = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params is not None:
        body["params"] = params
    request = Request(
        endpoint,
        data=json.dumps(body).encode(),
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
        method="POST",
    )
    with urlopen(request, timeout=20) as response:
        raw = response.read(1_000_001)
        if len(raw) > 1_000_000:
            raise ValueError("Response too large")
        result = json.loads(raw)
    if "error" in result:
        raise RuntimeError(result["error"])
    return result["result"]


def discover(endpoint):
    initialized = rpc(
        endpoint,
        "initialize",
        {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "Agenda-urllib-client", "version": "1.0"},
        },
    )
    tools = rpc(endpoint, "tools/list", {}, 2)["tools"]
    return {"server": initialized["serverInfo"], "tools": [tool["name"] for tool in tools]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "endpoint", nargs="?", default="https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/mcp"
    )
    print(json.dumps(discover(parser.parse_args().endpoint), indent=2, ensure_ascii=False))
