#!/usr/bin/env python3
"""Smoke-test agenda-intelligence mcp-config client outputs."""

from __future__ import annotations

import argparse
import json
import subprocess

CLIENTS = ("generic", "claude-desktop", "cursor", "codex")


def run_cli(command: list[str], client: str) -> str:
    result = subprocess.run(
        command + ["mcp-config", "--client", client],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(f"mcp-config --client {client} failed with {result.returncode}:\n{result.stderr}")
    if not result.stdout.strip():
        raise SystemExit(f"mcp-config --client {client} returned empty stdout")
    return result.stdout


def assert_json_config(stdout: str, client: str) -> None:
    try:
        data = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{client} config is not valid JSON: {exc}\n{stdout}") from exc

    server = data.get("mcpServers", {}).get("agenda-intelligence")
    if not isinstance(server, dict):
        raise SystemExit(f"{client} config missing agenda-intelligence server: {data}")
    if server.get("command") != "agenda-intelligence-mcp":
        raise SystemExit(f"{client} config has unexpected command: {server}")

    if client == "generic":
        if "type" in server:
            raise SystemExit(f"generic config should remain minimal for compatibility: {server}")
        return

    if server.get("type") != "stdio":
        raise SystemExit(f"{client} config missing stdio type: {server}")
    if server.get("args") != []:
        raise SystemExit(f"{client} config should include empty args list: {server}")
    if server.get("env") != {}:
        raise SystemExit(f"{client} config should include empty env object: {server}")


def assert_codex_config(stdout: str) -> None:
    required_lines = {
        "[mcp_servers.agenda-intelligence]",
        'command = "agenda-intelligence-mcp"',
        "enabled = true",
        "startup_timeout_sec = 10",
        "tool_timeout_sec = 30",
    }
    lines = {line.strip() for line in stdout.splitlines() if line.strip()}
    missing = required_lines - lines
    if missing:
        raise SystemExit(f"codex config missing lines {sorted(missing)}:\n{stdout}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-test agenda-intelligence mcp-config client outputs")
    parser.add_argument(
        "--command",
        default="agenda-intelligence",
        help="Agenda Intelligence CLI command. Use 'python -m agenda_intelligence.cli' for editable installs.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    command = args.command.split()
    if not command:
        raise SystemExit("--command must not be empty")

    for client in CLIENTS:
        stdout = run_cli(command, client)
        if client == "codex":
            assert_codex_config(stdout)
        else:
            assert_json_config(stdout, client)
    print(f"OK: MCP config smoke passed via {' '.join(command)}")


if __name__ == "__main__":
    main()
