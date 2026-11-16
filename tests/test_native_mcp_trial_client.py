"""Exercise the actual Worker with the official MCP client and its schema checks."""

import asyncio
import json
import shutil
import subprocess
from pathlib import Path

import pytest

pytest.importorskip("mcp")
import httpx2  # noqa: E402

from mcp import ClientSession  # noqa: E402
from mcp.client.streamable_http import streamable_http_client  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PROFILES = (
    "agenda",
    "corridor_sanctions_assistant",
    "kazakhstan",
    "agent_output_verification",
    "agentic_interaction_trust",
    "agent_financial_guard",
    "m2m_escrow_arbiter",
    "cis_secondary_sanctions",
    "gulf_maritime_exposure",
    "market_entry_readiness",
    "critical_minerals_due_diligence",
    "dual_use_technology_export",
)


def test_official_mcp_client_can_check_and_execute_each_profile_without_http_adapter():
    node = shutil.which("node")
    if not node:
        pytest.skip("Native Worker MCP test requires Node.js with node:sqlite")
    server = subprocess.Popen(
        [node, str(ROOT / "tests/fixtures/native_trial_server.mjs")],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        line = server.stdout.readline()
        assert line, server.stderr.read() if server.poll() is not None else "Local bridge did not start"
        port = json.loads(line)["port"]

        async def check():
            async with httpx2.AsyncClient(headers={"X-Client-Id": "agenda-owner-native-sdk-test"}) as client:
                for profile in PROFILES:
                    async with streamable_http_client(
                        f"http://127.0.0.1:{port}/{profile}/mcp/agent",
                        http_client=client,
                        terminate_on_close=False,
                    ) as (read, write):
                        async with ClientSession(read, write) as session:
                            await session.initialize()
                            tools = (await session.list_tools()).tools
                            trial = next(tool for tool in tools if tool.name == "free_trial")
                            status = await session.call_tool("free_trial_status", {})
                            assert not status.is_error
                            before = status.structured_content["availability"]["remaining_attempts"]
                            assert before == (5 if profile == "agent_output_verification" else 2)
                            invalid = await session.call_tool("free_trial", {})
                            assert invalid.is_error and invalid.structured_content is None
                            example = trial.meta["com.agenda/readiness"]["example_arguments"]
                            result = await session.call_tool("free_trial", example)
                            assert not result.is_error
                            assert result.structured_content["trial"]["agent_profile"] == profile
                            assert result.structured_content["trial"]["payment_required"] is False
                            assert result.structured_content["trial"]["completion_recorded"] is True
                            after = await session.call_tool("free_trial_status", {})
                            assert after.structured_content["availability"]["remaining_attempts"] == before - 1

        asyncio.run(check())
    finally:
        server.terminate()
        server.wait(timeout=10)
        server.stdout.close()
        server.stderr.close()
