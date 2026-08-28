"""The guardrail engine shipped with no tests, and its first rule rejected any
payload whose text contained the substring "human"."""

import json

import pytest

from agenda_intelligence.guardrails import GuardrailEngine, GuardrailViolation


@pytest.fixture
def engine():
    return GuardrailEngine()


@pytest.mark.parametrize(
    "claim",
    [
        "EU imposed human rights sanctions on the entity",
        "A humanitarian exemption applies to the shipment",
        "The consignee is a human rights NGO with an OFAC general licence",
    ],
)
def test_domain_vocabulary_is_not_treated_as_rendered_output(engine, claim):
    payload = {"decision": "ALLOW", "confidence_score": 0.95, "claim": claim}
    assert engine.enforce(json.dumps(payload)) == payload


@pytest.mark.parametrize("key", ["markdown", "html", "rendered_memo", "reviewer_checklist"])
def test_rendered_output_keys_are_rejected(engine, key):
    payload = {key: "## Reviewer checklist", "decision": "APPROVE", "confidence_score": 0.99}
    with pytest.raises(GuardrailViolation, match="rendered output"):
        engine.enforce(json.dumps(payload))


def test_block_below_the_confidence_floor_is_rejected(engine):
    with pytest.raises(GuardrailViolation, match="confidence"):
        engine.enforce(json.dumps({"decision": "BLOCK", "confidence_score": 0.4}))


def test_block_at_the_confidence_floor_passes(engine):
    payload = {"decision": "BLOCK", "confidence_score": 0.8}
    assert engine.enforce(json.dumps(payload)) == payload


def test_missing_confidence_on_a_block_is_rejected(engine):
    with pytest.raises(GuardrailViolation, match="confidence"):
        engine.enforce(json.dumps({"decision": "BLOCK"}))


def test_non_numeric_confidence_on_a_block_is_rejected(engine):
    """A string confidence must not compare as if it met the floor."""
    with pytest.raises(GuardrailViolation, match="confidence"):
        engine.enforce(json.dumps({"decision": "BLOCK", "confidence_score": "high"}))


def test_malformed_json_is_rejected(engine):
    with pytest.raises(GuardrailViolation, match="valid JSON"):
        engine.enforce("{not json")


def test_non_object_payload_is_rejected(engine):
    with pytest.raises(GuardrailViolation, match="JSON object"):
        engine.enforce(json.dumps(["BLOCK"]))
