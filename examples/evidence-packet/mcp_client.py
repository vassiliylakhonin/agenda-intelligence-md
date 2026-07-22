#!/usr/bin/env python3
"""Run check_evidence_packet through the installed MCP stdio server."""

from __future__ import annotations

import argparse
import json
import shlex
import subprocess
from pathlib import Path


PACKET_PATH = Path(__file__).with_name("request.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--command",
        default="agenda-intelligence-mcp",
        help="MCP server command. Defaults to the command installed from PyPI.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    packet = json.loads(PACKET_PATH.read_text(encoding="utf-8"))
    requests = [
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "evidence-packet-example", "version": "1"},
            },
        },
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "check_evidence_packet",
                "arguments": {"packet_json": packet},
            },
        },
    ]
    stdin = "\n".join(json.dumps(request) for request in requests) + "\n"
    result = subprocess.run(
        shlex.split(args.command),
        input=stdin,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(f"MCP server failed with {result.returncode}:\n{result.stderr}")

    responses = {
        response["id"]: response
        for line in result.stdout.splitlines()
        if line.strip()
        for response in [json.loads(line)]
        if "id" in response
    }
    tool_result = responses[2]["result"]
    if tool_result.get("isError"):
        raise SystemExit(tool_result["content"][0]["text"])

    payload = json.loads(tool_result["content"][0]["text"])
    response = payload["response"]
    summary = {
        "packet_status": response["packet_status"],
        "factuality_status": response["factuality_status"],
        "human_review_required": response["human_review_required"],
        "counts": response["counts"],
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
