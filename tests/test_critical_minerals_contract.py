"""Contract and service tests for Critical Minerals Due Diligence."""

from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator

from agenda_intelligence import a2a_adapter
from agenda_intelligence.services import (
    critical_minerals_due_diligence,
    extract_critical_minerals_parameters,
)

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


def test_extract_critical_minerals_parameters_unstructured_prompt():
    prompt = "Due diligence for rare earth extraction project in East Kazakhstan for EU offtake"
    extracted = extract_critical_minerals_parameters(raw_text=prompt)
    assert extracted["commodity"] == "rare_earth_elements"
    assert extracted["origin_jurisdiction"] == "Kazakhstan"
    assert extracted["decision_stage"] == "pre_offtake_agreement"
    assert extracted["inferred_parameters"] is True
    assert isinstance(extracted["supplied_sources"], list)

    validator = Draft202012Validator(load_json(REQUEST_SCHEMA_PATH))
    clean = {k: v for k, v in extracted.items() if k != "inferred_parameters"}
    validator.validate(clean)


def test_critical_minerals_due_diligence_smart_fallback():
    prompt_req = {
        "prompt": "Evaluate lithium supply chain from Karaganda, Kazakhstan",
        "auto_complete": True,
    }
    result = critical_minerals_due_diligence(prompt_req)
    assert result["valid"] is True
    assert result["inferred_parameters"] is True
    assert result["response"]["commodity"] == "lithium"
    assert result["response"]["origin_jurisdiction"] == "Kazakhstan"


def test_a2a_critical_minerals_smart_fallback():
    payload = {
        "jsonrpc": "2.0",
        "id": "req-smart-fallback-cm",
        "method": "message/send",
        "params": {
            "capability": "critical_minerals_due_diligence",
            "prompt": "Due diligence for rare earth extraction project in East Kazakhstan",
        },
    }
    response = a2a_adapter.handle_jsonrpc(payload)
    assert "error" not in response
    task = response["result"]
    assert task["status"]["state"] == "TASK_STATE_COMPLETED"
    assert task["metadata"]["inferred_parameters"] is True
    assert task["metadata"]["product_profile"] == "critical_minerals_due_diligence"
    assert len(task["artifacts"]) > 0


def test_critical_minerals_us_ira_feoc_assessment():
    req = {
        "prompt": "Lithium spodumene offtake from Kazakhstan refined in China for US clean vehicle market",
        "auto_complete": True,
    }
    result = critical_minerals_due_diligence(req)
    assert result["valid"] is True
    resp = result["response"]
    assert resp["commodity"] == "lithium"
    assert resp["target_market"] == "us"
    assert any("FEOC Disqualification" in r["category"] for r in resp["top_risks"])
    assert any("FEOC 25% Threshold" in l["layer"] for l in resp["exposure_layers"])


def test_critical_minerals_uranium_safeguards_gate():
    req = {
        "prompt": "Uranium yellowcake U3O8 offtake from Kazakhstan via Caspian Middle Corridor",
        "auto_complete": True,
    }
    result = critical_minerals_due_diligence(req)
    assert result["valid"] is True
    resp = result["response"]
    assert resp["commodity"] == "uranium"
    assert any("Nuclear Regulatory" in r["category"] for r in resp["top_risks"])
    assert any("IAEA Safeguards" in l["layer"] for l in resp["exposure_layers"])


def test_critical_minerals_titanium_aerospace_gate():
    req = {
        "prompt": "Titanium aerospace sponge from Ust-Kamenogorsk Kazakhstan for EU offtake",
        "auto_complete": True,
    }
    result = critical_minerals_due_diligence(req)
    assert result["valid"] is True
    resp = result["response"]
    assert resp["commodity"] == "titanium"
    assert any("Aerospace Grade Certification" in r["category"] for r in resp["top_risks"])

