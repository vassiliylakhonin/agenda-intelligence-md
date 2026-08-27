"""Contract and service tests for Critical Minerals Due Diligence."""

from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator

from agenda_intelligence.services import critical_minerals_due_diligence

ROOT = Path(__file__).resolve().parents[1]
REQUEST_SCHEMA_PATH = ROOT / "schemas" / "v1" / "critical-minerals-due-diligence-request.schema.json"
RESPONSE_SCHEMA_PATH = ROOT / "schemas" / "v1" / "critical-minerals-due-diligence-response.schema.json"
TAXONOMY_PATH = ROOT / "source-requirements" / "critical-minerals-due-diligence.json"
EXAMPLE_DIR = ROOT / "examples" / "critical-minerals-due-diligence" / "contract"
DATA_DIR = ROOT / "src" / "agenda_intelligence" / "data"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_example_requests_validate():
    validator = Draft202012Validator(load_json(REQUEST_SCHEMA_PATH))
    for req_file in EXAMPLE_DIR.glob("*.request.json"):
        validator.validate(load_json(req_file))


def test_example_responses_validate():
    validator = Draft202012Validator(load_json(RESPONSE_SCHEMA_PATH))
    for resp_file in EXAMPLE_DIR.glob("*.response.json"):
        validator.validate(load_json(resp_file))


def test_service_execution_parity():
    for req_file in EXAMPLE_DIR.glob("*.request.json"):
        req = load_json(req_file)
        result = critical_minerals_due_diligence(req)
        assert result["valid"] is True
        resp_file = req_file.with_name(req_file.name.replace(".request.json", ".response.json"))
        expected = load_json(resp_file)
        assert result["response"] == expected


def test_dual_copy_parity():
    pairs = [
        (REQUEST_SCHEMA_PATH, DATA_DIR / "schemas" / "v1" / REQUEST_SCHEMA_PATH.name),
        (RESPONSE_SCHEMA_PATH, DATA_DIR / "schemas" / "v1" / RESPONSE_SCHEMA_PATH.name),
        (TAXONOMY_PATH, DATA_DIR / "source-requirements" / TAXONOMY_PATH.name),
    ]
    for src, dst in pairs:
        assert src.read_bytes() == dst.read_bytes(), f"Mismatch between {src} and {dst}"
