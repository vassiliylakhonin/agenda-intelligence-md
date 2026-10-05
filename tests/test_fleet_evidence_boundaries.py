"""Caller-level regression probes for metadata gaming and contradictory outcomes."""

import json
from pathlib import Path

import pytest

from agenda_intelligence import services
from agenda_intelligence.corridor_bankability import screen_corridor_bankability

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    (
        services.middle_corridor_deal_risk,
        "kazakhstan-middle-corridor/contract/ready_for_human_review.request.json",
        "risk_signal",
    ),
    (
        services.agentic_interaction_trust,
        "agentic-interaction-trust/contract/checkout_step_up.request.json",
        "trust_signal",
    ),
    (
        services.cis_secondary_sanctions_exposure,
        "cis-secondary-sanctions/contract/ready_for_human_review.request.json",
        "secondary_exposure_signal",
    ),
    (
        services.gulf_maritime_exposure,
        "gulf-maritime-exposure/contract/ready_for_human_review.request.json",
        "exposure_signal",
    ),
]


def load(relative):
    return json.loads((ROOT / "examples" / relative).read_text())


def run(service, request):
    result = (
        service(request, allow_live_retrieval=False)
        if service == services.cis_secondary_sanctions_exposure
        else service(request)
    )
    assert result["valid"], result.get("errors")
    return result["response"]


@pytest.mark.parametrize("service,fixture,signal", CASES)
def test_document_labels_never_establish_low_risk_or_high_trust(service, fixture, signal):
    response = run(service, load(fixture))
    assert (
        response[signal] not in {"low", "high", "medium_high"}
        if signal == "trust_signal"
        else response[signal] != "low"
    )


@pytest.mark.parametrize("service,fixture,signal", CASES)
def test_impossible_source_dates_do_not_raise_readiness(service, fixture, signal):
    request = load(fixture)
    for source in request["dated_sources"]:
        source["date"] = "2026-02-30"
    response = run(service, request)
    assert response["decision_readiness_score"] == 0


def test_asserted_guarantee_does_not_waive_debt_coverage():
    result = screen_corridor_bankability(
        {
            "project_name": "Synthetic port",
            "corridor_leg": "Aktau-Baku",
            "capex_usd_m": 100,
            "ifi_debt_usd_m": 60,
            "dscr_min": 0.8,
            "has_sovereign_guarantee": True,
        }
    )
    assert next(c for c in result["covenant_checks"] if c["test"] == "minimum_dscr_floor")["result"] == "FAILS"
    assert result["bankability_status"] == "HIGH_DEFAULT_RISK"


def test_market_entry_open_blocker_pauses_even_with_complete_document_labels():
    request = load("kazakhstan-market-entry-readiness/contract/pre_signature_validation.request.json")
    request["known_blockers"] = ["Authority to sign is disputed"]
    response = run(services.kazakhstan_market_entry_readiness, request)
    assert response["gate_decision"] == "pause_for_evidence"
    assert "Authority to sign is disputed" in response["strongest_reason_to_pause"]
    assert any("blocker" in a["action"].lower() for a in response["owner_actions"])


@pytest.mark.parametrize("service,fixture,signal", CASES)
def test_reusing_a_source_id_for_every_document_type_cannot_complete_pack(service, fixture, signal):
    request = load(fixture)
    for source in request["dated_sources"]:
        source["id"] = "same-record"
    response = run(service, request)
    assert response["decision_readiness_score"] == 0
    assert response["source_record_review"]["issues"]
    assert response["source_record_review"]["source_content_verified"] is False


def test_full_agent_manifest_labels_are_not_authorization_and_do_not_hide_adverse_report():
    request = load("agentic-interaction-trust/contract/checkout_step_up.request.json")
    types = services.AGENTIC_INTERACTION_TRUST_REQUIRED_BEFORE_ACTION
    request["dated_sources"] = [
        {"id": f"src-{i}", "source_type": t, "title": t, "date": "2024-02-29"} for i, t in enumerate(types)
    ]
    response = run(services.agentic_interaction_trust, request)
    assert response["triage_recommendation"] == "escalate_to_human_review"
    assert response["trust_signal"] == "medium"
    request["dated_sources"].append(
        {
            "id": "adverse",
            "source_type": "fraud_or_account_takeover_signal",
            "title": "Reported account compromise",
            "date": "2026-02-30",
        }
    )
    response = run(services.agentic_interaction_trust, request)
    assert response["triage_recommendation"] == "block_until_verified"
    assert response["decision_readiness_label"] == "not_decision_ready"
