"""Portable HTTP API shell for Agenda Intelligence services.

This module intentionally uses only the Python standard library. It is a thin
adapter over :mod:`agenda_intelligence.services`, not a production web runtime
and not a replacement for the stdio MCP server.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from agenda_intelligence import __version__, services

MAX_BODY_BYTES = 1_000_000

BOUNDARY_NOTICE = (
    "No autonomous live source retrieval, no factual-truth verification, and no legal, compliance, "
    "sanctions, financial, investment, insurance, or trading advice. Human review is required for "
    "high-stakes decisions."
)


def _json_bytes(payload: dict) -> bytes:
    return json.dumps(payload, indent=2, sort_keys=True).encode("utf-8")


def _validation_unavailable(result: dict, label: str) -> tuple[int, dict] | None:
    """Return a 500 response when the service could not validate the request.

    A vertical-worker result carries ``valid is None`` when schema validation was
    unavailable (e.g. jsonschema not installed or a schema failed to load). That
    is a server-side fault, not a bad request, so it maps to 500 rather than 400.
    Returns ``None`` when validation ran (``valid`` is True or False).
    """
    if result.get("valid") is None:
        return 500, {
            "ok": False,
            "error": f"{label} request validation unavailable",
            "errors": result.get("errors", []),
        }
    return None


def handle_get(path: str) -> tuple[int, dict]:
    if path == "/healthz":
        return (
            200,
            {
                "ok": True,
                "service": "agenda-intelligence-http",
                "version": __version__,
            },
        )

    if path == "/readyz":
        return (
            200,
            {
                "ready": True,
                "service": "agenda-intelligence-http",
                "version": __version__,
                "service_layer": [
                    "audit_claims",
                    "source_coverage",
                    "score_output",
                    "middle_corridor_deal_risk",
                    "agentic_interaction_trust",
                    "cis_secondary_sanctions_exposure",
                    "gulf_maritime_exposure",
                ],
                "boundary": BOUNDARY_NOTICE,
            },
        )

    return 404, {"ok": False, "error": "Not found"}


def handle_post(path: str, payload: dict) -> tuple[int, dict]:
    if path == "/v1/audit-claims":
        audit_json = payload.get("audit_json", payload)
        if not isinstance(audit_json, dict):
            return 400, {"ok": False, "error": "audit_json must be a JSON object"}
        return 200, services.audit_claims(audit_json)

    if path == "/v1/source-coverage":
        evidence_json = payload.get("evidence_json", payload)
        category = payload.get("category")
        if not isinstance(evidence_json, dict):
            return 400, {"ok": False, "error": "evidence_json must be a JSON object"}
        if category is not None and not isinstance(category, str):
            return 400, {"ok": False, "error": "category must be a string"}
        return 200, services.source_coverage(evidence_json, category)

    if path == "/v1/score":
        before_text = payload.get("before_text")
        after_text = payload.get("after_text")
        if not isinstance(before_text, str) or not isinstance(after_text, str):
            return 400, {"ok": False, "error": "before_text and after_text must be strings"}
        return 200, services.score_output(before_text, after_text)

    if path == "/v1/middle-corridor/deal-risk":
        result = services.middle_corridor_deal_risk(payload)
        unavailable = _validation_unavailable(result, "Middle Corridor deal-risk")
        if unavailable is not None:
            return unavailable
        if not result.get("valid"):
            return 400, {"ok": False, "error": "Invalid Middle Corridor deal-risk request", "errors": result["errors"]}
        return 200, result["response"]

    if path == "/v1/agentic-interaction/trust":
        result = services.agentic_interaction_trust(payload)
        unavailable = _validation_unavailable(result, "agentic interaction trust")
        if unavailable is not None:
            return unavailable
        if not result.get("valid"):
            return 400, {"ok": False, "error": "Invalid agentic interaction trust request", "errors": result["errors"]}
        return 200, result["response"]

    if path == "/v1/cis-secondary-sanctions/exposure":
        result = services.cis_secondary_sanctions_exposure(payload)
        unavailable = _validation_unavailable(result, "CIS secondary-sanctions exposure")
        if unavailable is not None:
            return unavailable
        if not result.get("valid"):
            return 400, {
                "ok": False,
                "error": "Invalid CIS secondary-sanctions exposure request",
                "errors": result["errors"],
            }
        return 200, result["response"]

    if path == "/v1/gulf-maritime/exposure":
        result = services.gulf_maritime_exposure(payload)
        unavailable = _validation_unavailable(result, "Gulf maritime exposure")
        if unavailable is not None:
            return unavailable
        if not result.get("valid"):
            return 400, {
                "ok": False,
                "error": "Invalid Gulf maritime exposure request",
                "errors": result["errors"],
            }
        return 200, result["response"]

    return 404, {"ok": False, "error": "Not found"}


class AgendaIntelligenceHTTPHandler(BaseHTTPRequestHandler):
    """HTTP handler exposing a small JSON API over the shared service layer."""

    server_version = "AgendaIntelligenceHTTP/0.1"

    def log_message(self, _format: str, *args: Any) -> None:
        """Suppress default request logging so payloads are never logged here."""

    def _send_json(self, status: int, payload: dict) -> None:
        body = _json_bytes(payload)
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("cache-control", "no-store")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, status: int, message: str) -> None:
        self._send_json(
            status,
            {
                "ok": False,
                "error": message,
            },
        )

    def _read_json_body(self) -> dict | None:
        raw_length = self.headers.get("content-length")
        if raw_length is None:
            self._send_error(400, "Missing JSON request body")
            return None
        try:
            length = int(raw_length)
        except ValueError:
            self._send_error(400, "Invalid content-length")
            return None
        if length < 0 or length > MAX_BODY_BYTES:
            self._send_error(413, "Request body too large")
            return None

        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_error(400, "Request body must be valid JSON")
            return None
        if not isinstance(payload, dict):
            self._send_error(400, "Request body must be a JSON object")
            return None
        return payload

    def do_GET(self) -> None:
        status, body = handle_get(self.path)
        self._send_json(status, body)

    def do_POST(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            return

        status, body = handle_post(self.path, payload)
        self._send_json(status, body)


def serve(host: str = "127.0.0.1", port: int = 8080) -> None:
    server = ThreadingHTTPServer((host, port), AgendaIntelligenceHTTPHandler)
    print(f"agenda-intelligence-http listening on http://{host}:{port}", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run the Agenda Intelligence portable HTTP API shell.")
    parser.add_argument("--host", default=os.environ.get("AGENDA_INTELLIGENCE_HTTP_HOST", "127.0.0.1"))
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("AGENDA_INTELLIGENCE_HTTP_PORT", "8080")),
    )
    args = parser.parse_args(argv)
    serve(args.host, args.port)


if __name__ == "__main__":
    main()
