"""
MCP (Model-Control-Protocol) server skeleton for Agenda-Intelligence.md.

This is a placeholder implementation. Full MCP server would expose tools via
a standard protocol (e.g., HTTP/WebSocket) and call the underlying
`agenda_intelligence` CLI commands.

TODO:
- Implement tool discovery endpoint.
- Implement tool invocation for each function below.
- Add proper error handling and JSON-RPC compliance.
- Provide configuration for host/port.
"""

def get_protocol(name: str) -> dict:
    """Return the requested protocol markdown as a string."""
    # TODO: load from repo, parse agent-manifest.json
    return {"protocol": f"TODO: load protocol {name}"}


def list_lenses(lens_type: str | None = None) -> dict:
    """List available regional/sector lenses."""
    # TODO: read manifest
    return {"lenses": []}


def get_lens(lens_type: str, lens_id: str) -> dict:
    """Return a specific lens markdown."""
    return {"lens": f"TODO: lens {lens_type}/{lens_id}"}


def source_plan(category: str) -> dict:
    """Return source requirements for a category."""
    # TODO: read source-requirements/<category>.json
    return {"plan": []}


def validate_brief(brief_json: dict) -> dict:
    """Validate an agenda brief dict against schema."""
    # TODO: call jsonschema validation
    return {"valid": True, "errors": []}


def validate_evidence(evidence_json: dict) -> dict:
    """Validate an evidence pack dict against schema."""
    return {"valid": True, "errors": []}


def score_output(before_text: str, after_text: str) -> dict:
    """Score before/after output (heuristic)."""
    return {"score": 0, "details": "TODO"}
