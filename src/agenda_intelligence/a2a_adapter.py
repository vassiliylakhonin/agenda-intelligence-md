"""A2A adapter primitives for Agenda Intelligence.

This module is a protocol adapter over the shared service layer. It does not
perform live retrieval, persist caller payloads, or change MCP behavior.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

from agenda_intelligence import __version__, services

REPOSITORY_URL = "https://github.com/vassiliylakhonin/agenda-intelligence-md"
MIDDLE_CORRIDOR_SCHEMA = "schemas/v1/middle-corridor-deal-risk-request.schema.json"
MIDDLE_CORRIDOR_ENDPOINT = "/v1/middle-corridor/deal-risk"


def agent_card(base_url: str = "http://localhost:8080") -> dict:
    """Return a minimal A2A-compatible agent card."""
    return {
        "protocolVersion": "1.0",
        "name": "Agenda Intelligence Middle Corridor Deal Risk Gate",
        "description": (
            "A2A adapter for structured Kazakhstan / Middle Corridor deal-risk evidence triage. "
            "Routes structured JSON requests to the Agenda Intelligence service layer."
        ),
        "url": base_url,
        "provider": {
            "organization": "Vassiliy Lakhonin",
            "url": "https://vassiliylakhonin.github.io/",
        },
        "version": __version__,
        "capabilities": {
            "streaming": False,
            "pushNotifications": False,
        },
        "defaultInputModes": ["application/json"],
        "defaultOutputModes": ["application/json", "text/markdown"],
        "skills": [
            {
                "id": "middle-corridor-deal-risk-gate",
                "name": "Middle Corridor deal-risk gate",
                "description": (
                    "Converts route, cargo, counterparty, and dated-source inputs into an auditable "
                    "deal-risk readiness response with evidence gaps and human-review routing."
                ),
                "tags": ["kazakhstan", "middle-corridor", "deal-risk", "evidence-readiness"],
                "inputModes": ["application/json"],
                "outputModes": ["application/json", "text/markdown"],
            }
        ],
        "x_agenda_intelligence": {
            "repository": REPOSITORY_URL,
            "product_profile": "middle_corridor_deal_risk",
            "canonical_http_endpoint": MIDDLE_CORRIDOR_ENDPOINT,
            "schema": MIDDLE_CORRIDOR_SCHEMA,
            "boundaries": [
                "No autonomous live source retrieval.",
                "No factual-truth verification.",
                "No legal, compliance, sanctions, financial, investment, insurance, or trading advice.",
                "Human review is required for high-stakes decisions.",
            ],
        },
    }


def _try_parse_json_object(value: Any) -> dict | None:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if not stripped.startswith("{") or not stripped.endswith("}"):
        return None
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _looks_like_middle_corridor_request(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("route"), str)
        and isinstance(value.get("cargo"), str)
        and isinstance(value.get("counterparties"), list)
        and isinstance(value.get("dated_sources"), list)
        and isinstance(value.get("risk_question"), str)
        and isinstance(value.get("decision_stage"), str)
    )


def middle_corridor_request_from_params(params: dict) -> dict | None:
    """Extract a structured Middle Corridor request from A2A/JSON-RPC params."""
    candidates: list[Any] = [
        params.get("request"),
        params.get("middle_corridor_deal_risk_request"),
        params.get("input"),
        params,
    ]

    message = params.get("message")
    if isinstance(message, dict):
        if isinstance(message.get("data"), dict):
            candidates.append(message["data"])
        for part in message.get("parts", []) or []:
            if not isinstance(part, dict):
                continue
            candidates.extend([part.get("data"), part.get("json"), part.get("content")])
            parsed_text = _try_parse_json_object(part.get("text"))
            if parsed_text is not None:
                candidates.append(parsed_text)

    for candidate in candidates:
        parsed = _try_parse_json_object(candidate)
        if _looks_like_middle_corridor_request(parsed):
            return parsed
    return None


def _artifact_text(response: dict) -> str:
    missing = response.get("minimum_sources_before_go", [])
    missing_text = "\n".join(f"- {item}" for item in missing) if missing else "- none"
    return "\n".join(
        [
            "Middle Corridor deal-risk gate response",
            "",
            f"Recommendation: {response['triage_recommendation']}",
            f"Risk signal: {response['risk_signal']}",
            f"Decision readiness: {response['decision_readiness_score']}/100 ({response['decision_readiness_label']})",
            f"Human review required: {str(response['human_review_required']).lower()}",
            "",
            "Minimum sources before go:",
            missing_text,
            "",
            response["not_advice_notice"],
        ]
    )


def a2a_result_for_middle_corridor(request_json: dict) -> dict:
    result = services.middle_corridor_deal_risk(request_json)
    if not result.get("valid"):
        return {
            "id": "agenda-intelligence-a2a-result",
            "status": {"state": "failed"},
            "artifacts": [],
            "metadata": {
                "product_profile": "middle_corridor_deal_risk",
                "canonical_http_endpoint": MIDDLE_CORRIDOR_ENDPOINT,
                "schema": MIDDLE_CORRIDOR_SCHEMA,
                "valid": False,
                "errors": result.get("errors", []),
            },
        }

    response = result["response"]
    return {
        "id": "agenda-intelligence-a2a-result",
        "status": {"state": "completed"},
        "artifacts": [
            {
                "artifactId": "middle-corridor-deal-risk-response",
                "name": "Middle Corridor deal-risk response",
                "parts": [{"kind": "text", "text": _artifact_text(response)}],
            }
        ],
        "metadata": {
            "product_profile": "middle_corridor_deal_risk",
            "canonical_http_endpoint": MIDDLE_CORRIDOR_ENDPOINT,
            "schema": MIDDLE_CORRIDOR_SCHEMA,
            "human_review_required": response["human_review_required"],
            "not_advice_notice": response["not_advice_notice"],
            "response": response,
        },
    }


def jsonrpc_error(id_value: Any, code: int, message: str, data: dict | None = None) -> dict:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": id_value, "error": error}


def handle_jsonrpc(payload: dict, base_url: str = "http://localhost:8080") -> dict:
    """Handle the first A2A JSON-RPC slice."""
    if not isinstance(payload, dict) or payload.get("jsonrpc") != "2.0":
        return jsonrpc_error(None, -32600, "Invalid Request")

    id_value = payload.get("id")
    method = payload.get("method")
    if method in {"agent/card", "agentCard", "GetExtendedAgentCard"}:
        return {"jsonrpc": "2.0", "id": id_value, "result": agent_card(base_url)}

    if method in {"message/send", "tasks/send", "SendMessage"}:
        params = payload.get("params") or {}
        if not isinstance(params, dict):
            return jsonrpc_error(id_value, -32602, "Invalid params")
        request_json = middle_corridor_request_from_params(params)
        if request_json is None:
            return jsonrpc_error(
                id_value,
                -32602,
                "Missing structured Middle Corridor deal-risk request",
                {
                    "required_shape": {
                        "route": "string",
                        "cargo": "string",
                        "counterparties": "array",
                        "dated_sources": "array",
                        "risk_question": "string",
                        "decision_stage": "string",
                    },
                    "schema": MIDDLE_CORRIDOR_SCHEMA,
                },
            )
        return {"jsonrpc": "2.0", "id": id_value, "result": a2a_result_for_middle_corridor(request_json)}

    return jsonrpc_error(id_value, -32601, "Method not found", {"supported_methods": ["message/send", "agent/card"]})


def handle_stdin_jsonrpc(raw_input: str, base_url: str = "http://localhost:8080") -> dict:
    """Handle one JSON-RPC object read from stdin."""
    if not raw_input.strip():
        return jsonrpc_error(None, -32700, "Parse error", {"detail": "stdin is empty"})
    try:
        payload = json.loads(raw_input)
    except json.JSONDecodeError as error:
        return jsonrpc_error(None, -32700, "Parse error", {"detail": error.msg})
    if not isinstance(payload, dict):
        return jsonrpc_error(None, -32600, "Invalid Request")
    return handle_jsonrpc(payload, base_url)


def main() -> None:
    """Run the A2A JSON-RPC stdio shell."""
    base_url = os.environ.get("AGENDA_INTELLIGENCE_A2A_BASE_URL", "http://localhost:8080")
    response = handle_stdin_jsonrpc(sys.stdin.read(), base_url)
    json.dump(response, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
