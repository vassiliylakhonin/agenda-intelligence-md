"""Actionable diagnostics must explain rejected evidence without weakening gates."""

import json
from pathlib import Path

from agenda_intelligence.services import critical_minerals_due_diligence

ROOT = Path(__file__).resolve().parents[1]


def mineral_request():
    request = json.loads(
        (ROOT / "examples/critical-minerals-due-diligence/contract/ready_for_human_review.request.json").read_text()
    )
    for source in request["supplied_sources"]:
        source["title"] = source["title"].replace("Illustrative", "Provided")
        source["excerpt"] = source["excerpt"].replace("ILLUSTRATIVE ONLY. ", "")
    return request


def test_mineral_rejection_surfaces_exact_keys_fields_and_blank_repairs_in_main_response():
    request = mineral_request()
    expected_key = request["supplied_sources"][0]["source_type"]
    request["supplied_sources"][0]["source_type"] = expected_key.replace("_", " ")
    del request["supplied_sources"][0]["issuing_authority"]
    result = critical_minerals_due_diligence(request)
    assert result["valid"], result
    response = result["response"]
    assert response["decision_readiness_score"] < 100
    diagnostic = response["remediation"]
    key_issue = next(issue for issue in diagnostic["issues"] if issue["code"] == "unknown_source_type")
    assert key_issue["field"] == "/supplied_sources/0/source_type"
    assert expected_key in key_issue["allowed_values"]
    assert key_issue["category"] == "rejected_data"
    assert key_issue["basis"]["kind"] == "service_rule"
    assert key_issue["repair"]["example"]["source_type"] == expected_key
    assert key_issue["repair"]["example"]["excerpt"] == ""
    assert any(issue["field"] == "/supplied_sources/0/issuing_authority" for issue in diagnostic["issues"])


def test_unknown_structured_fields_are_not_silently_discarded_by_prompt_fallback():
    request = mineral_request()
    request["supplied_soruces"] = request["supplied_sources"]
    request["prompt"] = "Review this mineral dossier"
    result = critical_minerals_due_diligence(request)
    assert result["valid"] is False
    assert any("supplied_soruces" in str(error) for error in result["errors"])


def test_nested_unknown_field_cannot_be_laundered_with_prompt():
    request = mineral_request()
    request["supplied_sources"][0]["scope"]["commmodity"] = "copper"
    request["prompt"] = "Please evaluate"
    result = critical_minerals_due_diligence(request)
    assert result["valid"] is False
    assert any(issue["field"] == "/supplied_sources/0/scope/commmodity" for issue in result["remediation"]["issues"])


def test_report_revision_catches_two_real_structural_failures_without_deleting_claims():
    from agenda_intelligence.report_review import review_report_revision

    before = json.loads((ROOT / "examples/report-review/before.json").read_text())
    after = json.loads((ROOT / "examples/report-review/revised.json").read_text())
    result = review_report_revision(before, after)
    original, revised = (result[key]["evaluation"] for key in ("before", "after"))
    assert {issue["code"] for issue in original["remediation"]["issues"]} >= {
        "quote_mismatch",
        "broken_evidence_reference",
    }
    assert original["verdict"] == "block_unsafe_claims"
    assert revised["verdict"] == "verify_before_relay"
    assert revised["unsafe_claims"] == []
    assert original["claim_count"] == revised["claim_count"] == 2
    assert result["removed_claim_ids"] == []
    assert result["hosted_calls"] == 0
    assert result["authorization_granted"] is False
    assert revised["readiness_score"] <= 84


def test_report_revision_refuses_unchanged_input():
    import pytest

    from agenda_intelligence.report_review import review_report_revision

    request = json.loads((ROOT / "examples/report-review/before.json").read_text())
    with pytest.raises(ValueError, match="unchanged_input"):
        review_report_revision(request, request)


def test_structural_success_never_claims_semantic_truth_or_authorizes_use():
    from agenda_intelligence.services import agent_output_verification

    request = json.loads((ROOT / "examples/report-review/revised.json").read_text())
    request["claims"][0]["claim"] = "The notice takes effect on 1 June 2026."
    response = agent_output_verification(request)["response"]
    # Quote occurrence cannot establish that its date entails the caller's claim.
    assert response["verdict"] == "verify_before_relay"
    assert response["authorization_granted"] is False
    assert response["human_review_required"] is True


def test_python_worker_diagnostics_have_parity_for_all_twelve_profiles():
    import shutil
    import subprocess

    import pytest

    from agenda_intelligence.remediation import build_remediation

    node = shutil.which("node")
    if not node:
        pytest.skip("Node.js required for Worker parity")
    script = """
      import {WORKED_EXAMPLES} from './deploy/cloudflare-worker/src/worked-examples.js';
      console.log(JSON.stringify(WORKED_EXAMPLES));
    """
    examples = json.loads(subprocess.check_output([node, "--input-type=module", "-e", script], cwd=ROOT, text=True))
    assert len(examples) == 12
    for profile, example in examples.items():
        request = example["request"].get("request", example["request"])
        response = example["response"]
        before = json.dumps(response, sort_keys=True)
        assert build_remediation(response, profile=profile, request=request) == response["remediation"], profile
        assert json.dumps(response, sort_keys=True) == before


def test_technical_failure_has_no_fake_input_repair():
    from agenda_intelligence.remediation import technical_remediation

    issue = technical_remediation("agent_output_verification", "trial_store_unavailable")["issues"][0]
    assert issue["category"] == "technical_error"
    assert issue["field"] is None
    assert issue["repair"]["action"] == "check_service_status"
    assert issue["repair"]["example"] is None
    assert issue["recheck"]["automatic_check_available"] is False


def test_scope_mismatch_points_inside_the_source_scope_object():
    request = mineral_request()
    request["supplied_sources"][0]["scope"]["commodity"] = "another commodity"
    response = critical_minerals_due_diligence(request)["response"]
    assert any(issue["field"] == "/supplied_sources/0/scope/commodity" for issue in response["remediation"]["issues"])
