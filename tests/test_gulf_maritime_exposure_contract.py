import json
import re
from pathlib import Path

from jsonschema import Draft202012Validator

from agenda_intelligence import services

ROOT = Path(__file__).resolve().parents[1]
REQUEST_SCHEMA_PATH = ROOT / "schemas" / "v1" / "gulf-maritime-exposure-request.schema.json"
RESPONSE_SCHEMA_PATH = ROOT / "schemas" / "v1" / "gulf-maritime-exposure-response.schema.json"
TAXONOMY_PATH = ROOT / "source-requirements" / "gulf-maritime-exposure.json"

REQUIRED_BEFORE_REVIEW = {
    "vessel_registry_extract",
    "pi_insurance_certificate",
    "ownership_or_control_evidence",
    "sanctions_list_extract",
    "ais_track_record",
}

FORBIDDEN_CLEARANCE_WORDING = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bcleared\b",
        r"\bapproved\b",
        r"\bcompliant\b",
        r"\bsanctions safe\b",
        r"\bno sanctions risk\b",
        r"\bcompliance approval\b",
    ]
]


def load_json(path: Path):
    return json.loads(path.read_text())


GOLDEN_REQUEST = {
    "vessel": {"name": "Example Tanker", "flag": "Panama", "vessel_type": "crude oil tanker"},
    "voyage": {
        "chokepoint": "strait_of_hormuz",
        "origin": "undisclosed Gulf terminal",
        "destination": "ship-to-ship area, Gulf of Oman",
    },
    "cargo": "crude oil",
    "counterparties": [
        {"role": "registered_owner", "name": "Example Holding Ltd", "jurisdiction": "Marshall Islands"},
        {"role": "insurer_or_pi_club", "name": "Unknown"},
    ],
    "exposure_facets": ["iran_oil_exposure", "dark_fleet_indicators", "sts_transfer", "insurance_or_pi_gap"],
    "jurisdictions_in_scope": ["OFAC", "EU", "UK_OFSI"],
    "decision_stage": "pre_fixture",
    "dated_sources": [
        {"id": "g1", "source_type": "ais_track_record", "title": "AIS track extract", "date": "2026-05-28"}
    ],
    "risk_question": "Is this Hormuz transit ready to fix, or should it be escalated before fixture?",
    "requested_output": "structured_json",
}

_READY_SOURCE_TYPES = sorted(REQUIRED_BEFORE_REVIEW) + [
    "flag_registry_record",
    "sts_transfer_evidence",
    "cargo_or_bl_evidence",
]
READY_REQUEST = {
    "voyage": {"chokepoint": "strait_of_hormuz"},
    "exposure_facets": ["ownership_or_control"],
    "decision_stage": "committee_review",
    "dated_sources": [
        {"id": f"s{i}", "source_type": s, "title": s, "date": "2026-05-28"} for i, s in enumerate(_READY_SOURCE_TYPES)
    ],
    "risk_question": "Is the file ready for human review?",
}


def test_required_before_review_matches_taxonomy():
    taxonomy = load_json(TAXONOMY_PATH)
    assert set(taxonomy["required_before_go"]) == REQUIRED_BEFORE_REVIEW
    assert set(services.GULF_MARITIME_REQUIRED_BEFORE_REVIEW) == REQUIRED_BEFORE_REVIEW


def test_request_example_validates_against_schema():
    schema = load_json(REQUEST_SCHEMA_PATH)
    for example in schema.get("examples", []):
        Draft202012Validator(schema).validate(example)


def test_golden_request_escalates_before_fixture():
    result = services.gulf_maritime_exposure(GOLDEN_REQUEST)
    assert result["implemented"] is True
    assert result["valid"] is True, result["errors"]
    response = result["response"]
    Draft202012Validator(load_json(RESPONSE_SCHEMA_PATH)).validate(response)
    assert response["human_review_required"] is True
    assert response["triage_recommendation"] == "escalate_before_fixture"
    # sanctions_list_extract missing + iran_oil_exposure facet -> high signal
    assert response["exposure_signal"] == "high"
    assert "sanctions_list_extract" in response["minimum_sources_before_review"]
    assert any("Hormuz" in w for w in response["chokepoint_disruption_watch"])


def test_full_evidence_routes_to_human_review():
    result = services.gulf_maritime_exposure(READY_REQUEST)
    assert result["valid"] is True, result["errors"]
    response = result["response"]
    assert response["minimum_sources_before_review"] == []
    assert response["triage_recommendation"] == "ready_for_human_review"
    assert response["decision_readiness_label"] == "review_ready"


def test_invalid_request_is_rejected():
    bad = {"voyage": {"chokepoint": "strait_of_hormuz"}}  # missing required top-level fields
    result = services.gulf_maritime_exposure(bad)
    assert result["implemented"] is True
    assert result["valid"] is False
    assert result["response"] is None


def test_no_forbidden_clearance_wording():
    response = services.gulf_maritime_exposure(GOLDEN_REQUEST)["response"]
    blob = json.dumps(response)
    for pattern in FORBIDDEN_CLEARANCE_WORDING:
        assert not pattern.search(blob), pattern.pattern


_PRICE_CAP_BASE = {
    "voyage": {"chokepoint": "suez_canal"},
    "exposure_facets": ["russia_oil_price_cap"],
    "decision_stage": "pre_fixture",
    "dated_sources": [{"id": "p1", "source_type": "ais_track_record", "title": "AIS track", "date": "2026-05-28"}],
    "risk_question": "Is the price-cap attestation evidence sufficient before fixture?",
}


def test_price_cap_attestation_gap_surfaces_when_facet_present_and_attestation_absent():
    response = services.gulf_maritime_exposure(_PRICE_CAP_BASE)["response"]
    Draft202012Validator(load_json(RESPONSE_SCHEMA_PATH)).validate(response)
    dims = response["top_exposure_dimensions"]
    assert any("not yet evidenced" in d for d in dims), dims
    assert any("Russia oil price-cap" in d for d in dims), dims
    assert any("attestation refusal" in w for w in response["watch_next"]), response["watch_next"]


def test_price_cap_attestation_supplied_clears_gap_without_moving_score():
    with_attestation = json.loads(json.dumps(_PRICE_CAP_BASE))
    with_attestation["dated_sources"].append(
        {
            "id": "p2",
            "source_type": "price_cap_attestation_or_recordkeeping",
            "title": "per-loading price-cap attestation + itemized ancillary-cost records",
            "date": "2026-05-28",
        }
    )
    base = services.gulf_maritime_exposure(_PRICE_CAP_BASE)["response"]
    supplied = services.gulf_maritime_exposure(with_attestation)["response"]
    # gap note clears once the attestation is evidenced
    assert any("not yet evidenced" in d for d in base["top_exposure_dimensions"])
    assert not any("not yet evidenced" in d for d in supplied["top_exposure_dimensions"])
    # the new source type is not in required/context -> decision_readiness_score is unchanged
    assert supplied["decision_readiness_score"] == base["decision_readiness_score"]
