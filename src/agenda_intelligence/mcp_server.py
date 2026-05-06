"""
MCP (Model‑Control‑Protocol) server skeleton for Agenda‑Intelligence.md.

This module provides the tool functions that an MCP server would expose.
Validation and read-only resource tools are implemented. Scoring remains an
explicit stub until the quality evaluator is promoted beyond the CLI harness.
"""

import json
from importlib import resources
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


def _load_manifest() -> dict:
    manifest_path = resources.files(PACKAGE_NAME) / "data" / "agent-manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError("agent-manifest.json not found in package data")
    return json.loads(manifest_path.read_text())


def _read_data_file(relative_path: str) -> str:
    resource_path = resources.files(PACKAGE_NAME) / "data" / relative_path
    if not resource_path.is_file():
        raise FileNotFoundError(f"Resource not found in package data: {relative_path}")
    return resource_path.read_text()


def _load_data_json(relative_path: str) -> dict:
    return json.loads(_read_data_file(relative_path))


def _validate_json(data: dict, schema_name: str) -> dict:
    """Validate *data* against the named schema.

    Returns a dict with keys:
        implemented: True
        valid: bool
        errors: list[str]   (empty when valid)
    """
    try:
        from jsonschema import ValidationError, validate
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
    """Return the requested protocol markdown."""
    try:
        manifest = _load_manifest()
        if name == "entrypoint":
            relative_path = manifest["entrypoint"]
        else:
            matches = [
                path
                for path in manifest["protocols"]
                if path.rsplit("/", 1)[-1] == name or path.rsplit("/", 1)[-1].removesuffix(".md") == name
            ]
            if not matches:
                return {
                    "implemented": True,
                    "protocol": None,
                    "error": f"Unknown protocol: {name}",
                }
            relative_path = matches[0]
        return {
            "implemented": True,
            "name": name,
            "path": relative_path,
            "protocol": _read_data_file(relative_path),
            "error": None,
        }
    except Exception as e:
        return {"implemented": True, "protocol": None, "error": str(e)}


def list_lenses(lens_type: Optional[str] = None) -> dict:
    """List available lenses."""
    try:
        lenses = _load_manifest()["lenses"]
        if lens_type is not None:
            if lens_type not in lenses:
                return {
                    "implemented": True,
                    "lenses": {},
                    "error": f"Unknown lens type: {lens_type}",
                }
            lenses = {lens_type: lenses[lens_type]}
        return {"implemented": True, "lenses": lenses, "error": None}
    except Exception as e:
        return {"implemented": True, "lenses": None, "error": str(e)}


def get_lens(lens_type: str, lens_id: str) -> dict:
    """Return a specific lens."""
    try:
        lenses = _load_manifest()["lenses"]
        relative_path = lenses[lens_type][lens_id]
        return {
            "implemented": True,
            "type": lens_type,
            "id": lens_id,
            "path": relative_path,
            "lens": _read_data_file(relative_path),
            "error": None,
        }
    except KeyError:
        return {
            "implemented": True,
            "lens": None,
            "error": f"Unknown lens: {lens_type}/{lens_id}",
        }
    except Exception as e:
        return {"implemented": True, "lens": None, "error": str(e)}


def source_plan(category: str) -> dict:
    """Return source requirements for a category."""
    try:
        requirements = _load_manifest().get("source_acquisition", {}).get("requirements", {})
        if category not in requirements:
            return {
                "implemented": True,
                "category": category,
                "plan": None,
                "error": f"Unknown source category: {category}",
            }
        relative_path = requirements[category]
        return {
            "implemented": True,
            "category": category,
            "path": relative_path,
            "plan": _load_data_json(relative_path),
            "error": None,
        }
    except Exception as e:
        return {"implemented": True, "category": category, "plan": None, "error": str(e)}


def score_output(before_text: str, after_text: str) -> dict:
    """Score before/after output (not implemented)."""
    return {
        "implemented": False,
        "score": None,
        "error": "score_output is not implemented yet; use the CLI: agenda-intelligence score …",
    }
