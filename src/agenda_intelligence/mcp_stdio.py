"""Minimal stdio MCP transport for Agenda Intelligence tools."""

import json
import sys
from typing import Any, Callable, Optional

from agenda_intelligence import __version__, mcp_server

PROTOCOL_VERSION = "2025-03-26"

JsonDict = dict[str, Any]


def _schema(properties: JsonDict, required: Optional[list[str]] = None) -> JsonDict:
    return {
        "type": "object",
        "properties": properties,
        "required": required or [],
        "additionalProperties": False,
    }


TOOLS: dict[str, dict[str, Any]] = {
    "validate_brief": {
        "description": "Validate an agenda brief JSON object against agenda-brief.schema.json.",
        "inputSchema": _schema({"brief_json": {"type": "object"}}, ["brief_json"]),
        "handler": lambda args: mcp_server.validate_brief(args["brief_json"]),
    },
    "validate_evidence": {
        "description": "Validate an evidence pack JSON object against evidence-pack.schema.json.",
        "inputSchema": _schema({"evidence_json": {"type": "object"}}, ["evidence_json"]),
        "handler": lambda args: mcp_server.validate_evidence(args["evidence_json"]),
    },
    "audit_claims": {
        "description": (
            "Validate a claim-level evidence-audit JSON object against "
            "evidence-audit.schema.json and return a small summary: support-level "
            "distribution, orphan evidence_id refs, and unsupported_claims count. "
            "Schema-level only; does not verify factual truth."
        ),
        "inputSchema": _schema({"audit_json": {"type": "object"}}, ["audit_json"]),
        "handler": lambda args: mcp_server.audit_claims(args["audit_json"]),
    },
    "get_protocol": {
        "description": "Return packaged protocol markdown by name, or use 'entrypoint'.",
        "inputSchema": _schema({"name": {"type": "string"}}, ["name"]),
        "handler": lambda args: mcp_server.get_protocol(args["name"]),
    },
    "list_lenses": {
        "description": "List available regional and sector lenses.",
        "inputSchema": _schema({"lens_type": {"type": "string", "enum": ["regional", "sector"]}}),
        "handler": lambda args: mcp_server.list_lenses(args.get("lens_type")),
    },
    "get_lens": {
        "description": "Return packaged lens markdown by type and id.",
        "inputSchema": _schema(
            {
                "lens_type": {"type": "string", "enum": ["regional", "sector"]},
                "lens_id": {"type": "string"},
            },
            ["lens_type", "lens_id"],
        ),
        "handler": lambda args: mcp_server.get_lens(args["lens_type"], args["lens_id"]),
    },
    "source_plan": {
        "description": "Return packaged source requirements for a source category.",
        "inputSchema": _schema({"category": {"type": "string"}}, ["category"]),
        "handler": lambda args: mcp_server.source_plan(args["category"]),
    },
    "score_output": {
        "description": "Score before/after agenda-analysis output with the protocol marker rubric.",
        "inputSchema": _schema(
            {
                "before_text": {"type": "string"},
                "after_text": {"type": "string"},
            },
            ["before_text", "after_text"],
        ),
        "handler": lambda args: mcp_server.score_output(args["before_text"], args["after_text"]),
    },
    "verify_quotes": {
        "description": (
            "Verify that quoted fragments in an evidence pack are present in the provided "
            "source texts. Pass `texts` as a dict mapping evidence_id → plain text. "
            "Sources without a matching texts entry are reported as missing_source_text. "
            "Local-text only; does not make outbound network requests. "
            "Does not discover sources, score source reputation, gather live news, "
            "or verify factual truth."
        ),
        "inputSchema": _schema(
            {
                "pack_json": {"type": "object"},
                "texts": {"type": "object"},
            },
            ["pack_json"],
        ),
        "handler": lambda args: mcp_server.verify_quotes(args["pack_json"], args.get("texts")),
    },
}


def _tool_definitions() -> list[JsonDict]:
    tools = []
    for name, spec in TOOLS.items():
        tools.append(
            {
                "name": name,
                "description": spec["description"],
                "inputSchema": spec["inputSchema"],
            }
        )
    return tools


def _response(message_id: Any, result: JsonDict) -> JsonDict:
    return {"jsonrpc": "2.0", "id": message_id, "result": result}


def _error(message_id: Any, code: int, message: str, data: Any = None) -> JsonDict:
    error: JsonDict = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": message_id, "error": error}


def _tool_result(payload: JsonDict, is_error: bool = False) -> JsonDict:
    return {
        "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False, indent=2)}],
        "isError": is_error,
    }


def _handle_initialize(message_id: Any, params: JsonDict) -> JsonDict:
    requested_version = params.get("protocolVersion")
    protocol_version = requested_version if isinstance(requested_version, str) else PROTOCOL_VERSION
    return _response(
        message_id,
        {
            "protocolVersion": protocol_version,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": "agenda-intelligence-md", "version": __version__},
            "instructions": "Use these tools for agenda-analysis protocol, evidence discipline, lenses, and schemas.",
        },
    )


def _handle_tools_list(message_id: Any) -> JsonDict:
    return _response(message_id, {"tools": _tool_definitions()})


def _handle_tools_call(message_id: Any, params: JsonDict) -> JsonDict:
    name = params.get("name")
    args = params.get("arguments") or {}
    if not isinstance(name, str):
        return _error(message_id, -32602, "tools/call requires a string tool name.")
    if not isinstance(args, dict):
        return _error(message_id, -32602, "tools/call arguments must be an object.")
    if name not in TOOLS:
        return _response(message_id, _tool_result({"error": f"Unknown tool: {name}"}, is_error=True))

    handler: Callable[[JsonDict], JsonDict] = TOOLS[name]["handler"]
    try:
        payload = handler(args)
        is_error = bool(payload.get("error")) or payload.get("valid") is False
        return _response(message_id, _tool_result(payload, is_error=is_error))
    except KeyError as exc:
        return _response(
            message_id, _tool_result({"error": f"Missing required argument: {exc.args[0]}"}, is_error=True)
        )
    except Exception as exc:
        return _response(message_id, _tool_result({"error": str(exc)}, is_error=True))


def handle_message(message: JsonDict) -> Optional[JsonDict]:
    message_id = message.get("id")
    method = message.get("method")
    params = message.get("params") or {}
    if params and not isinstance(params, dict):
        return _error(message_id, -32602, "Request params must be an object.")

    if method == "notifications/initialized":
        return None
    if method == "initialize":
        return _handle_initialize(message_id, params)
    if method == "ping":
        return _response(message_id, {})
    if method == "tools/list":
        return _handle_tools_list(message_id)
    if method == "tools/call":
        return _handle_tools_call(message_id, params)
    return _error(message_id, -32601, f"Method not found: {method}")


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError as exc:
            print(json.dumps(_error(None, -32700, "Parse error.", str(exc))), flush=True)
            continue
        if not isinstance(message, dict):
            print(json.dumps(_error(None, -32600, "Invalid request.")), flush=True)
            continue
        response = handle_message(message)
        if response is not None:
            print(json.dumps(response, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
