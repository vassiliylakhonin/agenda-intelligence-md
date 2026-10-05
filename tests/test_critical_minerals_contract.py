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
    assert any("2025-09-30" in q for q in resp["dossier_review"]["applicability_questions"])
    assert "FEOC Disqualification" not in json.dumps(resp)


def test_critical_minerals_uranium_safeguards_gate():
    req = {
        "prompt": "Uranium yellowcake U3O8 offtake from Kazakhstan via Caspian Middle Corridor",
        "auto_complete": True,
    }
    result = critical_minerals_due_diligence(req)
    assert result["valid"] is True
    resp = result["response"]
    assert resp["commodity"] == "uranium"
    assert any("natural/enriched" in q for q in resp["dossier_review"]["applicability_questions"])
    assert "St. Petersburg" not in json.dumps(resp)


def test_critical_minerals_titanium_aerospace_gate():
    req = {
        "prompt": "Titanium aerospace sponge from Ust-Kamenogorsk Kazakhstan for EU offtake",
        "auto_complete": True,
    }
    result = critical_minerals_due_diligence(req)
    assert result["valid"] is True
    resp = result["response"]
    assert resp["commodity"] == "titanium"
    assert any("ore assay is not finished-product qualification" in q for q in resp["watch_next"])


def test_document_labels_do_not_verify_traceability_or_authorize_action():
    request = load_json(EXAMPLE_DIR / "ready_for_human_review.request.json")
    request["supplied_sources"] = [{"source_type": s["source_type"]} for s in request["supplied_sources"]]
    response = critical_minerals_due_diligence(request)["response"]
    assert response["traceability_status"] == "unverified"
    assert response["operational_decision"]["decision"] == "request_evidence"
    assert response["decision_readiness_score"] == 0


def test_country_and_commodity_do_not_establish_export_prohibition():
    request = load_json(EXAMPLE_DIR / "insufficient_information.request.json")
    request.update(commodity="graphite", origin_jurisdiction="Kazakhstan", target_market="us")
    response = critical_minerals_due_diligence(request)["response"]
    assert response["export_control_exposure"]["quota_restricted"] is False
    text = json.dumps(response)
    assert "FEOC Disqualification" not in text
    assert "$7,500" not in text


def test_complete_scoped_dossier_requires_human_approval():
    request = load_json(EXAMPLE_DIR / "ready_for_human_review.request.json")
    response = critical_minerals_due_diligence(request)["response"]
    assert response["decision_readiness_score"] == 100
    assert response["operational_decision"]["decision"] == "require_approval"
    assert response["traceability_status"] == "partial"
    assert response["risk_signal"] == "unknown"
    assert response["human_review_required"] is True


def test_expired_future_wrong_scope_and_duplicate_records_reduce_readiness():
    request = load_json(EXAMPLE_DIR / "ready_for_human_review.request.json")
    request["supplied_sources"][0]["valid_until"] = "2026-10-04"
    request["supplied_sources"][1]["date"] = "2026-10-06"
    request["supplied_sources"][2]["scope"]["origin_jurisdiction"] = "China"
    request["supplied_sources"][4]["document_id"] = request["supplied_sources"][3]["document_id"]
    response = critical_minerals_due_diligence(request)["response"]
    reviews = response["dossier_review"]["source_reviews"]
    assert "expired" in " ".join(reviews[0]["issues"])
    assert "after assessment_date" in " ".join(reviews[1]["issues"])
    assert "Scope mismatch" in " ".join(reviews[2]["issues"])
    assert "Duplicate document" in " ".join(reviews[4]["issues"])
    assert response["decision_readiness_score"] == 50
    assert len(response["readiness_contract"]["owner_actions"]) == 4
    assert response["operational_decision"]["decision"] == "request_evidence"


def test_dated_sources_are_reviewed_and_summary_cannot_replace_excerpt():
    request = load_json(EXAMPLE_DIR / "ready_for_human_review.request.json")
    request["dated_sources"] = request["supplied_sources"]
    request["supplied_sources"] = []
    assert critical_minerals_due_diligence(request)["response"]["decision_readiness_score"] == 100
    for source in request["dated_sources"]:
        source["summary"] = source.pop("excerpt")
        source["verified_by_counsel"] = True
    response = critical_minerals_due_diligence(request)["response"]
    assert response["decision_readiness_score"] == 0
    assert response["traceability_status"] == "unverified"


def test_invalid_calendar_date_and_caller_blocker_prevent_ready_result():
    request = load_json(EXAMPLE_DIR / "ready_for_human_review.request.json")
    request["supplied_sources"][0]["date"] = "2026-02-30"
    request["blockers"] = ["Ownership chart disputed"]
    response = critical_minerals_due_diligence(request)["response"]
    assert response["operational_decision"]["decision"] == "request_evidence"
    assert "Ownership chart disputed" in response["evidence_gaps"]
    assert "invalid issue date" in " ".join(response["dossier_review"]["source_reviews"][0]["issues"])


def test_stage_specific_requirements_and_legacy_responsible_sourcing_alias():
    request = load_json(EXAMPLE_DIR / "ready_for_human_review.request.json")
    request["supplied_sources"][4]["source_type"] = "csddd_human_rights_and_esg_audit"
    assert critical_minerals_due_diligence(request)["response"]["decision_readiness_score"] == 100
    request["decision_stage"] = "pre_exploration"
    response = critical_minerals_due_diligence(request)["response"]
    assert "tailings_and_environmental_permits" in response["minimum_sources_before_go"]
    assert "processing_and_refining_tolling_agreement" not in response["minimum_sources_before_go"]
    request["decision_stage"] = "pre_investment_decision"
    response = critical_minerals_due_diligence(request)["response"]
    assert "bankable_feasibility_study" in response["minimum_sources_before_go"]
    assert "mining_concession_or_license_extract" not in response["minimum_sources_before_go"]


def test_iso_week_date_is_not_accepted_as_calendar_issue_date():
    request = load_json(EXAMPLE_DIR / "ready_for_human_review.request.json")
    request["supplied_sources"][0]["date"] = "2026-W40-1"
    response = critical_minerals_due_diligence(request)["response"]
    assert "invalid issue date" in " ".join(response["dossier_review"]["source_reviews"][0]["issues"])
