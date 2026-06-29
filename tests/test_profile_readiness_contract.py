import json
from pathlib import Path

from jsonschema import Draft202012Validator

from agenda_intelligence import services

ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def assert_readiness_contract(response: dict, schema_name: str, *, profile: str, status_field: str, routing_field: str):
    schema = load_json(ROOT / "schemas" / "v1" / schema_name)
    Draft202012Validator(schema).validate(response)

    contract = response["readiness_contract"]
    assert contract["profile"] == profile
    assert contract["status"] == response[status_field]
    assert contract["routing"] == {"field": routing_field, "value": response[routing_field]}
    assert contract["blocking_gaps"] == response.get("evidence_gaps", [])
    assert contract["watch_next"] == response.get("watch_next", [])
    assert contract["human_review_required"] is response["human_review_required"]
    assert contract["boundary_notice"] == response.get("not_advice_notice", response.get("boundary_notice"))


def test_middle_corridor_readiness_contract_is_additive():
    request = load_json(
        ROOT / "examples" / "kazakhstan-middle-corridor" / "contract" / "pre_signature_escalate.request.json"
    )
    response = services.middle_corridor_deal_risk(request)["response"]

    assert_readiness_contract(
        response,
        "middle-corridor-deal-risk-response.schema.json",
        profile="middle_corridor_deal_risk",
        status_field="decision_readiness_label",
        routing_field="triage_recommendation",
    )
    assert response["readiness_contract"]["score"] == response["decision_readiness_score"]
    assert response["readiness_contract"]["signal"] == {"field": "risk_signal", "value": response["risk_signal"]}


def test_agentic_interaction_trust_readiness_contract_is_additive():
    request = load_json(ROOT / "examples" / "agentic-interaction-trust" / "contract" / "checkout_step_up.request.json")
    response = services.agentic_interaction_trust(request)["response"]

    assert_readiness_contract(
        response,
        "agentic-interaction-trust-response.schema.json",
        profile="agentic_interaction_trust",
        status_field="decision_readiness_label",
        routing_field="triage_recommendation",
    )
    assert response["readiness_contract"]["score"] == response["decision_readiness_score"]
    assert response["readiness_contract"]["signal"] == {"field": "trust_signal", "value": response["trust_signal"]}


def test_cis_secondary_sanctions_readiness_contract_is_additive(monkeypatch):
    monkeypatch.setenv("OPENSANCTIONS_DISABLED", "1")
    request = load_json(
        ROOT / "examples" / "cis-secondary-sanctions" / "contract" / "escalate_before_onboarding.request.json"
    )
    response = services.cis_secondary_sanctions_exposure(request)["response"]

    assert_readiness_contract(
        response,
        "cis-secondary-sanctions-response.schema.json",
        profile="cis_secondary_sanctions",
        status_field="decision_readiness_label",
        routing_field="triage_recommendation",
    )
    assert response["readiness_contract"]["score"] == response["decision_readiness_score"]
    assert response["readiness_contract"]["signal"] == {
        "field": "secondary_exposure_signal",
        "value": response["secondary_exposure_signal"],
    }


def test_gulf_maritime_readiness_contract_is_additive():
    request = load_json(
        ROOT / "examples" / "gulf-maritime-exposure" / "contract" / "escalate_before_fixture.request.json"
    )
    response = services.gulf_maritime_exposure(request)["response"]

    assert_readiness_contract(
        response,
        "gulf-maritime-exposure-response.schema.json",
        profile="gulf_maritime_exposure",
        status_field="decision_readiness_label",
        routing_field="triage_recommendation",
    )
    assert response["readiness_contract"]["score"] == response["decision_readiness_score"]
    assert response["readiness_contract"]["signal"] == {
        "field": "exposure_signal",
        "value": response["exposure_signal"],
    }


def test_market_entry_readiness_contract_is_additive():
    request = load_json(
        ROOT / "examples" / "kazakhstan-market-entry-readiness" / "contract" / "pre_signature_validation.request.json"
    )
    response = services.kazakhstan_market_entry_readiness(request)["response"]

    assert_readiness_contract(
        response,
        "market-entry-readiness-response.schema.json",
        profile="kazakhstan_market_entry_readiness",
        status_field="readiness_label",
        routing_field="gate_decision",
    )
    assert response["readiness_contract"]["score"] is None
    assert response["readiness_contract"]["signal"] is None
    assert response["readiness_contract"]["claim_audit"] == response["claim_audit"]
    assert response["readiness_contract"]["owner_actions"] == response["owner_actions"]


def test_public_response_fixtures_include_readiness_contract():
    fixture_dirs = [
        ROOT / "examples" / "kazakhstan-middle-corridor" / "contract",
        ROOT / "examples" / "agentic-interaction-trust" / "contract",
        ROOT / "examples" / "cis-secondary-sanctions" / "contract",
        ROOT / "examples" / "gulf-maritime-exposure" / "contract",
        ROOT / "examples" / "kazakhstan-market-entry-readiness" / "contract",
    ]

    fixtures = [path for fixture_dir in fixture_dirs for path in sorted(fixture_dir.glob("*.response.json"))]
    assert fixtures
    for fixture_path in fixtures:
        response = load_json(fixture_path)
        assert "readiness_contract" in response, fixture_path
        assert response["readiness_contract"]["profile"], fixture_path
        assert response["readiness_contract"]["status"], fixture_path
