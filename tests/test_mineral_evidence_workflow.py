"""Action-bound evidence requests and conservative, caller-supplied revision review."""

import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from agenda_intelligence.services import critical_minerals_due_diligence

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / "schemas/v1"


def dossier():
    # Synthetic structural control, not authenticated documents or external demand.
    request = json.loads(
        (ROOT / "examples/critical-minerals-due-diligence/contract/ready_for_human_review.request.json").read_text()
    )
    for source in request["supplied_sources"]:
        source["title"] = source["title"].replace("Illustrative", "Provided")
        source["excerpt"] = source["excerpt"].replace("ILLUSTRATIVE ONLY. ", "")
    return request


def evaluate(request):
    result = critical_minerals_due_diligence(request)
    assert result["valid"], result
    response = result["response"]
    Draft202012Validator(
        json.loads((SCHEMAS / "critical-minerals-due-diligence-response.schema.json").read_text())
    ).validate(response)
    return response, response["dossier_review"]["evidence_workflow"]


def test_evidence_request_contains_exact_repairs_and_a_non_evidence_blank_template():
    request = dossier()
    request["supplied_sources"] = request["supplied_sources"][:1]
    request["supplied_sources"][0]["valid_until"] = "2026-01-01"
    _, flow = evaluate(request)
    assert flow["decision"]["stage"] == "pre_offtake_agreement"
    assert flow["decision"]["question"] == request["decision_question"]
    first = flow["evidence_requests"][0]
    assert first["source_refs"] == ["supplied_sources[0]"]
    assert any("expired" in issue for issue in first["issues"])
    assert request["project_name"] in first["request_text"]
    assert first["source_template"]["excerpt"] == ""
    assert first["source_template"]["scope"]["project_name"] == request["project_name"]
    request["supplied_sources"] = [first["source_template"]]
    response, _ = evaluate(request)
    assert response["decision_readiness_score"] == 0
    assert flow["revision"]["status"] == "not_provided"


def test_updated_dossier_rechecks_both_inputs_and_reports_new_lost_and_remaining_coverage():
    request = dossier()
    previous = copy.deepcopy(request)
    previous["supplied_sources"] = previous["supplied_sources"][:1]
    request["supplied_sources"] = request["supplied_sources"][1:3]
    request["previous_submission"] = previous
    response, flow = evaluate(request)
    revision = flow["revision"]
    assert revision["status"] == "compared"
    assert revision["newly_reviewable_source_types"] == [
        source["source_type"] for source in request["supplied_sources"]
    ]
    assert revision["no_longer_reviewable_source_types"] == [previous["supplied_sources"][0]["source_type"]]
    assert len(revision["still_missing_source_types"]) == 5
    assert response["authorization_granted"] is False
    assert flow["documentary_next_step"] == "collect_evidence"


@pytest.mark.parametrize(
    "field,value",
    [
        ("decision_stage", "pre_exploration"),
        ("project_name", "Other project"),
        ("decision_question", "Ship now?"),
        ("target_market", "us"),
        ("counterparties", [{"name": "Other buyer", "role": "offtake_buyer", "jurisdiction": "Japan"}]),
    ],
)
def test_changed_decision_scope_cannot_be_presented_as_progress(field, value):
    request = dossier()
    request["previous_submission"] = copy.deepcopy(request)
    request[field] = value
    _, flow = evaluate(request)
    revision = flow["revision"]
    assert revision["status"] == "not_comparable"
    assert field in revision["changed_scope_fields"]
    assert revision["newly_reviewable_source_types"] == []
    assert revision["no_longer_reviewable_source_types"] == []


def test_expiry_regression_removed_blockers_and_unchanged_retry_are_not_improvements():
    request = dossier()
    request["supplied_sources"][0]["valid_until"] = request["assessment_date"]
    previous = copy.deepcopy(request)
    previous["blockers"] = ["Ownership disputed"]
    request["previous_submission"] = previous
    _, flow = evaluate(request)
    assert flow["revision"]["newly_reviewable_source_types"] == []
    assert flow["revision"]["removed_caller_blockers"] == ["Ownership disputed"]
    assert any("not proof" in line for line in flow["revision"]["limitations"])
    request["assessment_date"] = "2026-10-06"
    _, flow = evaluate(request)
    assert flow["revision"]["no_longer_reviewable_source_types"] == [request["supplied_sources"][0]["source_type"]]
    request["assessment_date"] = "2026-10-04"
    _, flow = evaluate(request)
    assert flow["revision"]["status"] == "not_comparable"
    assert "assessment_date_moved_backwards" in flow["revision"]["comparison_blockers"]


def test_complete_coverage_prepares_human_review_and_prior_input_does_not_change_current_decision():
    request = dossier()
    expected = critical_minerals_due_diligence(request)["response"]
    previous = copy.deepcopy(request)
    previous["supplied_sources"] = []
    request["previous_submission"] = previous
    response, flow = evaluate(request)
    assert flow["documentary_next_step"] == "prepare_human_review"
    assert flow["evidence_requests"] == []
    assert len(flow["revision"]["newly_reviewable_source_types"]) == 8
    assert flow["authorization_granted"] is False
    assert response["operational_decision"] == expected["operational_decision"]
    assert response["operational_decision"]["decision"] == "require_approval"


@pytest.mark.parametrize("previous", [None, {}, {"previous_submission": {}}, {"decision_readiness_score": 100}])
def test_previous_submission_is_a_request_not_an_untrusted_previous_verdict(previous):
    request = dossier()
    request["previous_submission"] = previous
    assert critical_minerals_due_diligence(request)["valid"] is False
