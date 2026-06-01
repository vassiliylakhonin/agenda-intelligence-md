import json
import re
from pathlib import Path

from jsonschema import Draft202012Validator

from agenda_intelligence.mcp_server import source_plan

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_DIR = ROOT / "examples" / "kazakhstan-middle-corridor" / "contract"
REQUEST_SCHEMA_PATH = ROOT / "schemas" / "v1" / "middle-corridor-deal-risk-request.schema.json"
RESPONSE_SCHEMA_PATH = ROOT / "schemas" / "v1" / "middle-corridor-deal-risk-response.schema.json"
TAXONOMY_PATH = ROOT / "source-requirements" / "middle-corridor-deal-risk.json"

REQUIRED_BEFORE_GO = {
    "counterparty_registry_extract",
    "beneficial_ownership_source",
    "sanctions_list_extract",
    "customs_or_regulatory_source",
    "insurance_clause_or_underwriter_note",
    "vessel_or_carrier_history",
}

FORBIDDEN_CLEARANCE_WORDING = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bcleared\b",
        r"\bapproved\b",
        r"\bcompliant\b",
        r"\bsanctions safe\b",
        r"\blegal conclusion\b",
        r"\bcompliance approval\b",
        r"\bno sanctions risk\b",
    ]
]


def load_json(path: Path):
    return json.loads(path.read_text())


def assert_valid(schema_path: Path, fixture_path: Path):
    schema = load_json(schema_path)
    fixture = load_json(fixture_path)
    Draft202012Validator(schema).validate(fixture)


def test_middle_corridor_request_fixtures_validate():
    request_fixtures = sorted(CONTRACT_DIR.glob("*.request.json"))
    assert request_fixtures

    for fixture_path in request_fixtures:
        assert_valid(REQUEST_SCHEMA_PATH, fixture_path)


def test_middle_corridor_response_fixtures_validate():
    response_fixtures = sorted(CONTRACT_DIR.glob("*.response.json"))
    assert response_fixtures

    for fixture_path in response_fixtures:
        assert_valid(RESPONSE_SCHEMA_PATH, fixture_path)


def test_middle_corridor_taxonomy_contains_required_before_go_sources():
    taxonomy = load_json(TAXONOMY_PATH)

    assert taxonomy["category"] == "middle-corridor-deal-risk"
    assert REQUIRED_BEFORE_GO <= set(taxonomy["required_before_go"])
    assert "pre-compliance evidence triage" in taxonomy["boundary"]


def test_middle_corridor_source_plan_is_discoverable():
    result = source_plan("middle-corridor-deal-risk")

    assert result["implemented"] is True
    assert result["error"] is None
    assert result["plan"]["category"] == "middle-corridor-deal-risk"
    assert REQUIRED_BEFORE_GO <= set(result["plan"]["required_before_go"])


def test_middle_corridor_response_fixtures_include_not_advice_notice():
    for fixture_path in sorted(CONTRACT_DIR.glob("*.response.json")):
        response = load_json(fixture_path)
        assert response["not_advice_notice"]
        assert (
            "Not legal, sanctions, compliance, financial, investment, insurance, or trading advice."
            in response["not_advice_notice"]
        )


def test_middle_corridor_response_fixtures_include_readiness_score():
    allowed_labels = {
        "insufficient_information",
        "not_decision_ready",
        "partial",
        "review_ready",
    }

    for fixture_path in sorted(CONTRACT_DIR.glob("*.response.json")):
        response = load_json(fixture_path)
        assert 0 <= response["decision_readiness_score"] <= 100
        assert response["decision_readiness_label"] in allowed_labels


def test_middle_corridor_response_fixtures_do_not_imply_clearance():
    for fixture_path in sorted(CONTRACT_DIR.glob("*.response.json")):
        text = json.dumps(load_json(fixture_path), sort_keys=True)
        for pattern in FORBIDDEN_CLEARANCE_WORDING:
            assert not pattern.search(text), f"{fixture_path.name} contains forbidden wording: {pattern.pattern}"


def test_middle_corridor_flags_high_risk_jurisdiction():
    """Counterparty in a sanctions-relevant jurisdiction must be flagged (ADR 0015)."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau -> Baku -> Poti -> EU",
        "cargo": "dual-use machine tools",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
            {"role": "consignee", "name": "RU Buyer", "jurisdiction": "Russia"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "port_operator_notice", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "escalate before signature?",
        "decision_stage": "pre_signature",
    }
    resp = services.middle_corridor_deal_risk(req)["response"]
    assert "counterparty in a sanctions-relevant / high-risk jurisdiction" in resp["top_risks"]
    assert "limitations" in resp
    assert any("escalation flag for human review" in line for line in resp["limitations"])
    # Boundary: must NOT phrase it as a determination.
    joined = " ".join(resp["limitations"])
    assert "not a sanctions determination" in joined


def test_middle_corridor_clean_jurisdiction_not_flagged():
    """Negative control: an all-Kazakhstan counterparty set must not trigger the flag,
    and the structural score path is unchanged."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "port_operator_notice", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "escalate?",
        "decision_stage": "pre_signature",
    }
    resp = services.middle_corridor_deal_risk(req)["response"]
    assert "counterparty in a sanctions-relevant / high-risk jurisdiction" not in resp["top_risks"]
    assert "counterparty in a re-export / circumvention-watch jurisdiction" not in resp["top_risks"]
    assert "limitations" not in resp


def test_middle_corridor_flags_circumvention_watch_jurisdiction():
    """Counterparty in a re-export / circumvention-watch jurisdiction (e.g. Armenia)
    must be flagged with the softer watch wording, distinct from the high-risk flag."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau -> Baku -> Poti -> EU",
        "cargo": "dual-use machine tools",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
            {"role": "consignee", "name": "Intermediary Trading", "jurisdiction": "Armenia"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "port_operator_notice", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "escalate before signature?",
        "decision_stage": "pre_signature",
    }
    resp = services.middle_corridor_deal_risk(req)["response"]
    assert "counterparty in a re-export / circumvention-watch jurisdiction" in resp["top_risks"]
    # Must NOT be mislabelled as a comprehensively sanctioned / high-risk jurisdiction.
    assert "counterparty in a sanctions-relevant / high-risk jurisdiction" not in resp["top_risks"]
    assert "limitations" in resp
    joined = " ".join(resp["limitations"])
    assert "diversion watch item" in joined
    assert "not a sanctions determination" in joined


def test_middle_corridor_high_risk_takes_precedence_over_watch():
    """A jurisdiction on the high-risk list is not also double-flagged as watch."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {"role": "consignee", "name": "RU Buyer", "jurisdiction": "Russia"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "port_operator_notice", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "escalate?",
        "decision_stage": "pre_signature",
    }
    resp = services.middle_corridor_deal_risk(req)["response"]
    assert "counterparty in a sanctions-relevant / high-risk jurisdiction" in resp["top_risks"]
    assert "counterparty in a re-export / circumvention-watch jurisdiction" not in resp["top_risks"]


def test_middle_corridor_exposure_layers_present_and_separated():
    """Response must decompose risk into domestic-legal vs foreign-sanctions layers,
    validate against the schema, and never assert compliance/clearance."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau -> Baku -> Poti -> EU",
        "cargo": "dual-use machine tools",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
            {"role": "consignee", "name": "Intermediary Trading", "jurisdiction": "Armenia"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "port_operator_notice", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "compliant at home but any foreign exposure before signature?",
        "decision_stage": "pre_signature",
    }
    result = services.middle_corridor_deal_risk(req)
    assert result["valid"] is True
    resp = result["response"]

    layers = resp["exposure_layers"]
    assert layers["domestic_legal_layer"]
    assert layers["foreign_sanctions_exposure_layer"]
    # The circumvention-watch signal must surface in the foreign-exposure layer.
    assert any("circumvention-watch" in line for line in layers["foreign_sanctions_exposure_layer"])
    # Boundary: the structured layers must not imply clearance.
    text = json.dumps(layers).lower()
    for word in ["cleared", "approved", "sanctions safe", "no sanctions risk"]:
        assert word not in text
    # Schema conformance of the full response (exposure_layers included).
    assert_valid(RESPONSE_SCHEMA_PATH, _write_tmp(resp))


def test_middle_corridor_surfaces_vessel_dsp_checklist_when_history_missing():
    """When vessel/carrier history is not supplied, the maritime leg gets a
    deceptive-shipping-practice verification checklist (OFAC-grounded), and the
    response stays schema-valid and within the evidence-gap boundary."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "dual-use machine tools",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "port_operator_notice", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "escalate before signature?",
        "decision_stage": "pre_signature",
    }
    result = services.middle_corridor_deal_risk(req)
    assert result["valid"] is True
    resp = result["response"]
    indicators = resp["vessel_due_diligence_indicators"]
    assert indicators
    blob = " ".join(indicators).lower()
    assert "ais" in blob
    assert "ship-to-ship" in blob or "sts" in blob
    # Boundary: a checklist of what to verify, never a clearance.
    for word in ["cleared", "approved", "sanctions safe"]:
        assert word not in blob
    assert_valid(RESPONSE_SCHEMA_PATH, _write_tmp(resp))


def test_middle_corridor_no_vessel_checklist_when_history_supplied():
    """Negative control: if vessel/carrier history is supplied, the checklist is
    not surfaced (the gap it addresses is closed)."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "vessel_or_carrier_history", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "escalate?",
        "decision_stage": "pre_signature",
    }
    resp = services.middle_corridor_deal_risk(req)["response"]
    assert "vessel_due_diligence_indicators" not in resp


def _write_tmp(obj):
    import tempfile

    path = Path(tempfile.mkstemp(suffix=".json")[1])
    path.write_text(json.dumps(obj))
    return path
