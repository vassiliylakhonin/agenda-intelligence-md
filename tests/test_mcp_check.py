"""Configuration and schema failures plus a real optional SDK exchange."""

import copy
import importlib.util
import sys
from types import SimpleNamespace

import pytest

from agenda_intelligence.mcp_check import check_mcp, validate_catalog, validate_config

CONFIG = {
    "transport": "stdio",
    "command": [sys.executable, "-m", "agenda_intelligence.mcp_stdio"],
    "auth": "none",
    "execute_examples": True,
    "examples": [{"tool": "list_signals", "arguments": {}, "expected_is_error": False}],
}


@pytest.mark.parametrize(
    "change",
    [
        {"command": "python -m arbitrary"},
        {"auth": "required"},
        {"execute_examples": "true"},
        {"token": "secret"},
        {"token_env": "TOKEN"},
    ],
)
def test_invalid_or_ambiguous_config_is_refused(change):
    with pytest.raises(ValueError):
        validate_config({**CONFIG, **change})


def test_http_credentials_and_insecure_remote_are_refused():
    for url in [
        "http://example.com/mcp",
        "https://user:secret@example.com/mcp",
        "https://example.com/mcp?token=secret",
    ]:
        with pytest.raises(ValueError):
            validate_config({"transport": "streamable_http", "url": url, "auth": "none"})


def test_schema_failures_and_duplicate_names_cannot_pass():
    tool = SimpleNamespace(name="example", inputSchema={"type": "object"}, outputSchema={"type": "object"})
    validate_catalog([tool])
    with pytest.raises(ValueError):
        validate_catalog([tool, tool])
    broken = copy.deepcopy(tool)
    broken.inputSchema = {"type": "invented-type"}
    with pytest.raises(Exception):
        validate_catalog([broken])


@pytest.mark.skipif(importlib.util.find_spec("mcp") is None, reason="optional official MCP SDK not installed")
def test_official_sdk_discovers_real_stdio_server_and_executes_opted_in_example():
    report = check_mcp(CONFIG)
    assert report["status"] == "passed"
    assert report["client_version"] == "1.30.0"
    assert any(row["check"] == "unknown_method_error" and row["code"] == -32601 for row in report["checks"])
    assert any(row["check"] == "example" and row["tool"] == "list_signals" for row in report["checks"])
