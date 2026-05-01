"""
MCP (Model‑Control‑Protocol) server skeleton for Agenda‑Intelligence.md.

This module provides the tool functions that an MCP server would expose.
Only the validation tools are implemented; the rest return an explicit
“not implemented” structure so that agents cannot mistake a stub for real work.
"""

import json
from importlib import resources
from pathlib import Path
from typing import Optional

PACKAGE_NAME = "agenda_intelligence"

# ---------------------------------------------------------------------------
# Validation helpers (re‑use the same schema loading as the CLI)
# ---------------------------------------------------------------------------

def _load_schema(schema_name: str) -> dict:
    """Load a JSON schema from the package data."""
    schema_path = resources.files(PACKAGE_NAME) / "data" / "schemas" / schema_name
    if not schema_path.is_file():
        raise FileNotFoundError(f"Schema not found in package data: {schema_name}")
    return json.loads(schema_path.read_text())


def _validate_json(data: dict, schema_name: str) -> dict:
    """Validate *data* against the named schema.

    Returns a dict with keys:
        implemented: True
        valid: bool
        errors: list[str]   (empty when valid)
    """
    try:
        from jsonschema import validate, ValidationError
    except ImportError:
        return {
            "implemented": False,
            "valid": None,
            "error": "jsonschema is not installed – cannot validate",
        }

    try:
        schema = _load_schema(schema_name)
        validate(instance=data, schema=schema)
        return {"implemented": True, "valid": True, "errors": []}
    except ValidationError as e:
        return {"implemented": True, "valid": False, "errors": [e.message]}
    except Exception as e:
        return {"implemented": True, "valid": None, "errors": [str(e)]}


# ---------------------------------------------------------------------------
# MCP tool functions
# ---------------------------------------------------------------------------

def validate_brief(brief_json: dict) -> dict:
    """Validate an agenda‑brief dict against agenda‑brief.schema.json."""
    return _validate_json(brief_json, "agenda-brief.schema.json")


def validate_evidence(evidence_json: dict) -> dict:
    """Validate an evidence‑pack dict against evidence‑pack.schema.json."""
    return _validate_json(evidence_json, "evidence-pack.schema.json")


def get_protocol(name: str) -> dict:
    """Return the requested protocol markdown (not implemented)."""
    return {
        "implemented": False,
        "result": None,
        "error": "get_protocol is not implemented yet; use the CLI: agenda-intelligence get-protocol …",
    }


def list_lenses(lens_type: Optional[str] = None) -> dict:
    """List available lenses (not implemented)."""
    return {
        "implemented": False,
        "lenses": None,
        "error": "list_lenses is not implemented yet; use the CLI: agenda-intelligence list-lenses …",
    }


def get_lens(lens_type: str, lens_id: str) -> dict:
    """Return a specific lens (not implemented)."""
    return {
        "implemented": False,
        "lens": None,
        "error": "get_lens is not implemented yet; use the CLI: agenda-intelligence get-lens …",
    }


def source_plan(category: str) -> dict:
    """Return source requirements for a category (not implemented)."""
    return {
        "implemented": False,
        "plan": None,
        "error": "source_plan is not implemented yet; use the CLI: agenda-intelligence source-plan …",
    }


def score_output(before_text: str, after_text: str) -> dict:
    """Score before/after output (not implemented)."""
    return {
        "implemented": False,
        "score": None,
        "error": "score_output is not implemented yet; use the CLI: agenda-intelligence score …",
    }
