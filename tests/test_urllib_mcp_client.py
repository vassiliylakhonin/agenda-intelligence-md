"""Check shipped urllib discovery transport succeeds honestly and rejects RPC errors."""

import importlib.util
import io
import json
from pathlib import Path

import pytest

SPEC = importlib.util.spec_from_file_location(
    "urllib_mcp_client", Path(__file__).parents[1] / "scripts/urllib_mcp_client.py"
)
client = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(client)


def test_discovery_uses_application_identity(monkeypatch):
    methods = []

    def fetch(request, timeout):
        assert request.get_header("User-agent") == client.USER_AGENT
        assert timeout == 20
        body = json.loads(request.data)
        methods.append(body["method"])
        result = {"serverInfo": {"name": "fixture", "version": "1"}}
        if body["method"] == "tools/list":
            result = {"tools": [{"name": "fixture_tool"}]}
        return io.BytesIO(json.dumps({"jsonrpc": "2.0", "id": body["id"], "result": result}).encode())

    monkeypatch.setattr(client, "urlopen", fetch)
    assert client.discover("https://example.org/mcp") == {
        "server": {"name": "fixture", "version": "1"},
        "tools": ["fixture_tool"],
    }
    assert methods == ["initialize", "tools/list"]


def test_rpc_200_error_is_not_success(monkeypatch):
    monkeypatch.setattr(client, "urlopen", lambda *args, **kwargs: io.BytesIO(b'{"error":{"code":-32600}}'))
    with pytest.raises(RuntimeError):
        client.rpc("https://example.org/mcp", "initialize")
