"""Actual official-client HTTP transport and bearer challenge checks."""

import json
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from agenda_intelligence.mcp_check import check_mcp

pytest.importorskip("mcp")


@contextmanager
def merchant_server(*, public_by_mistake=False):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def reply(self, code, body=None, extra=None):
            raw = json.dumps(body).encode() if body is not None else b""
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            for key, value in (extra or {}).items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            if self.path == "/.well-known/oauth-protected-resource":
                self.reply(200, {"resource": origin + "/mcp", "authorization_servers": ["https://issuer.example"]})
            else:
                self.reply(405)

        def do_DELETE(self):
            self.reply(200)

        def do_POST(self):
            request = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            if not public_by_mistake and self.headers.get("Authorization") != "Bearer sandbox-credential":
                self.reply(
                    401,
                    {},
                    {
                        "WWW-Authenticate": 'Bearer resource_metadata="'
                        + origin
                        + '/.well-known/oauth-protected-resource"'
                    },
                )
                return
            method = request["method"]
            if method.startswith("notifications/"):
                self.reply(202)
                return
            response = {"jsonrpc": "2.0", "id": request["id"]}
            if method == "initialize":
                response["result"] = {
                    "protocolVersion": "2025-11-25",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "owner-sandbox", "version": "1"},
                }
            elif method == "tools/list":
                response["result"] = {
                    "tools": [
                        {
                            "name": "echo",
                            "inputSchema": {
                                "type": "object",
                                "properties": {"value": {"type": "integer"}},
                                "required": ["value"],
                                "additionalProperties": False,
                            },
                            "outputSchema": {
                                "type": "object",
                                "properties": {"value": {"type": "integer"}},
                                "required": ["value"],
                            },
                        }
                    ]
                }
            elif method == "tools/call":
                response["result"] = {
                    "content": [{"type": "text", "text": "sandbox"}],
                    "structuredContent": request["params"]["arguments"],
                    "isError": False,
                }
            else:
                response["error"] = {"code": -32601, "message": "Unknown method"}
            self.reply(200, response)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    origin = "http://127.0.0.1:" + str(server.server_port)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield {
            "transport": "streamable_http",
            "url": origin + "/mcp",
            "allow_loopback_http": True,
            "auth": "required",
            "token_env": "MCP_SANDBOX_TOKEN",
            "execute_examples": True,
            "examples": [{"tool": "echo", "arguments": {"value": 7}, "expected_is_error": False}],
        }
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_official_http_client_auth_schema_and_example(monkeypatch):
    monkeypatch.setenv("MCP_SANDBOX_TOKEN", "sandbox-credential")
    with merchant_server() as config:
        report = check_mcp(config)
    assert report["status"] == "passed"
    assert report["checks"][-1]["output_schema_checked"] is True
    assert report["checks"][0]["scope"] == "401/challenge/metadata and supplied bearer only"


def test_required_auth_catches_accidentally_public_endpoint(monkeypatch):
    monkeypatch.setenv("MCP_SANDBOX_TOKEN", "sandbox-credential")
    with merchant_server(public_by_mistake=True) as config:
        with pytest.raises(Exception, match="401"):
            check_mcp(config)
