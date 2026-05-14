#!/usr/bin/env python3
"""Smoke-test the installed or editable Agenda Intelligence MCP stdio server."""

from __future__ import annotations

import argparse
import json
import subprocess

REQUESTS = [
    {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "agenda-intelligence-smoke", "version": "1"},
        },
    },
    {"jsonrpc": "2.0", "method": "notifications/initialized"},
    {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
    {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {"name": "source_plan", "arguments": {"category": "technology-ai"}},
    },
    {
        "jsonrpc": "2.0",
        "id": 4,
        "method": "tools/call",
        "params": {
            "name": "score_output",
            "arguments": {
                "before_text": "Generic update. Monitor developments.",
                "after_text": (
                    "Signal classification: compliance-relevant development. "
                    "What changed: guidance moved toward implementation. "
                    "Main uncertainty: whether enforcement follows. "
                    "Watch next: regulator guidance and compliance deadline."
                ),
            },
        },
    },
    {
        "jsonrpc": "2.0",
        "id": 6,
        "method": "tools/call",
        "params": {
            "name": "verify_quotes",
            "arguments": {
                "pack_json": {
                    "topic": "smoke-test",
                    "evidence_mode": "user_provided",
                    "sources": [
                        {
                            "evidence_id": "e1",
                            "name": "Test source",
                            "url": "https://example.com",
                            "source_type": "official",
                            "quote": "hello world",
                        }
                    ],
                },
                "texts": {"e1": "This document says hello world clearly."},
            },
        },
    },
    {
        "jsonrpc": "2.0",
        "id": 5,
        "method": "tools/call",
        "params": {
            "name": "audit_claims",
            "arguments": {
                "audit_json": {
                    "topic": "smoke-test",
                    "claims": [
                        {
                            "claim_id": "c1",
                            "claim": "Test claim.",
                            "claim_type": "regulatory_change",
                            "evidence_ids": ["e1"],
                            "support_level": "direct",
                            "uncertainty": "None.",
                            "risk_if_wrong": "Low.",
                        }
                    ],
                    "evidence": [
                        {
                            "evidence_id": "e1",
                            "name": "Test source",
                            "url": "https://example.com",
                            "source_type": "official_document",
                        }
                    ],
                    "unsupported_claims": [],
                }
            },
        },
    },
]


def run_server(command: list[str]) -> list[dict]:
    stdin = "\n".join(json.dumps(request) for request in REQUESTS) + "\n"
    result = subprocess.run(command, input=stdin, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise SystemExit(f"MCP smoke command failed with {result.returncode}:\n{result.stderr}")
    try:
        return [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
    except json.JSONDecodeError as exc:
        raise SystemExit(f"MCP smoke returned invalid JSON: {exc}\n{result.stdout}") from exc


def assert_response_shape(responses: list[dict], expected_version: str | None) -> None:
    if len(responses) != 6:
        raise SystemExit(f"Expected 6 MCP responses, got {len(responses)}: {responses}")

    initialize = responses[0]["result"]
    server_info = initialize["serverInfo"]
    if server_info["name"] != "agenda-intelligence-md":
        raise SystemExit(f"Unexpected MCP server name: {server_info}")
    if expected_version and server_info["version"] != expected_version:
        raise SystemExit(f"Expected MCP version {expected_version}, got {server_info['version']}")

    tools = {tool["name"] for tool in responses[1]["result"]["tools"]}
    expected_tools = {
        "validate_brief",
        "validate_evidence",
        "audit_claims",
        "get_protocol",
        "list_lenses",
        "get_lens",
        "source_plan",
        "score_output",
        "verify_quotes",
    }
    missing = expected_tools - tools
    if missing:
        raise SystemExit(f"Missing MCP tools: {sorted(missing)}")

    tool_result = responses[2]["result"]
    if tool_result.get("isError"):
        raise SystemExit(f"MCP source_plan returned tool error: {tool_result}")
    payload = json.loads(tool_result["content"][0]["text"])
    if payload["category"] != "technology-ai":
        raise SystemExit(f"Unexpected source_plan category: {payload}")
    if "must_check" not in payload["plan"]:
        raise SystemExit(f"source_plan payload missing must_check: {payload}")

    score_result = responses[3]["result"]
    if score_result.get("isError"):
        raise SystemExit(f"MCP score_output returned tool error: {score_result}")
    score_payload = json.loads(score_result["content"][0]["text"])
    if not score_payload["implemented"]:
        raise SystemExit(f"score_output is still a stub: {score_payload}")
    if score_payload["after_score"] <= score_payload["before_score"]:
        raise SystemExit(f"score_output did not improve after output: {score_payload}")

    vq_result = responses[4]["result"]
    if vq_result.get("isError"):
        raise SystemExit(f"MCP verify_quotes returned tool error: {vq_result}")
    vq_payload = json.loads(vq_result["content"][0]["text"])
    if not vq_payload.get("implemented"):
        raise SystemExit(f"verify_quotes not implemented: {vq_payload}")
    vq_summary = vq_payload.get("summary", {})
    if vq_summary.get("present") != 1 or vq_summary.get("total_quotes") != 1:
        raise SystemExit(f"verify_quotes summary unexpected: {vq_summary}")

    audit_result = responses[5]["result"]
    if audit_result.get("isError"):
        raise SystemExit(f"MCP audit_claims returned tool error: {audit_result}")
    audit_payload = json.loads(audit_result["content"][0]["text"])
    if not audit_payload.get("implemented"):
        raise SystemExit(f"audit_claims not implemented: {audit_payload}")
    if not audit_payload.get("valid"):
        raise SystemExit(f"audit_claims reported invalid for well-formed input: {audit_payload}")
    summary = audit_payload.get("summary", {})
    if summary.get("claim_count") != 1 or summary.get("evidence_count") != 1:
        raise SystemExit(f"audit_claims summary unexpected: {summary}")
    if summary.get("orphan_evidence_refs"):
        raise SystemExit(f"audit_claims found unexpected orphans: {summary}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-test agenda-intelligence-mcp")
    parser.add_argument(
        "--command",
        default="agenda-intelligence-mcp",
        help="MCP server command to run. Use 'python -m agenda_intelligence.mcp_stdio' for editable installs.",
    )
    parser.add_argument("--expected-version", help="Expected MCP server version")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    command = args.command.split()
    if not command:
        raise SystemExit("--command must not be empty")
    responses = run_server(command)
    assert_response_shape(responses, args.expected_version)
    print(f"OK: MCP stdio smoke passed via {' '.join(command)}")


if __name__ == "__main__":
    main()
