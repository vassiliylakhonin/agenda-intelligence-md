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


def test_middle_corridor_operational_decision_escalates_when_evidence_missing():
    """Golden: a pre_signature request missing required-before-go evidence yields an escalate booking verb."""
    from agenda_intelligence import services

    response = services.middle_corridor_deal_risk(
        {
            "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
            "cargo": "dual-use-capable electronics",
            "counterparties": [{"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"}],
            "dated_sources": [{"id": "e1", "source_type": "port_operator_notice", "title": "x", "date": "2026-05-20"}],
            "risk_question": "escalate before signature?",
            "decision_stage": "pre_signature",
        }
    )["response"]
    decision = response["operational_decision"]
    assert decision["decision"] == "escalate"
    assert decision["applies_to"]
    assert decision["rationale"]
    # The gate never issues a hard reject - that is a compliance/legal call, outside the boundary.
    assert "reject" not in decision["rationale"].lower()
    # The whole response, with the new field, still validates against the response contract.
    Draft202012Validator(load_json(RESPONSE_SCHEMA_PATH)).validate(response)


def test_middle_corridor_operational_decision_schema_rejects_off_enum_decision():
    """Failure: an off-enum booking decision (e.g. a hard 'reject') must be rejected by the schema."""
    operational_decision_schema = load_json(RESPONSE_SCHEMA_PATH)["properties"]["operational_decision"]
    bad = {"decision": "reject", "applies_to": "quote / sign the booking", "rationale": "x"}
    errors = list(Draft202012Validator(operational_decision_schema).iter_errors(bad))
    assert errors
    assert any("reject" in str(error.message) for error in errors)


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


def test_middle_corridor_counterparty_readiness_partial_when_sources_missing():
    """Outward dossier-completeness reframe: with only some required-before-go sources
    supplied, status is partial, the counts reconcile against the required total, and the
    outstanding list matches minimum_sources_before_go. Schema-valid throughout."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "sanctions_list_extract", "title": "x", "date": "2026-05-21"},
        ],
        "risk_question": "escalate before signature?",
        "decision_stage": "pre_signature",
    }
    result = services.middle_corridor_deal_risk(req)
    assert result["valid"] is True
    resp = result["response"]

    readiness = resp["counterparty_readiness"]
    assert readiness["status"] == "partial"
    assert readiness["required_total"] == len(REQUIRED_BEFORE_GO)
    assert readiness["supplied_count"] + readiness["missing_count"] == readiness["required_total"]
    assert readiness["supplied_count"] == 1
    # Outstanding documents must equal the required-before-go gaps surfaced in the response.
    assert set(readiness["outstanding_documents"]) == set(resp["minimum_sources_before_go"])
    assert_valid(RESPONSE_SCHEMA_PATH, _write_tmp(resp))


def test_middle_corridor_counterparty_readiness_complete_when_all_required_supplied():
    """When every required-before-go source is supplied, the dossier reads complete_for_review
    with no outstanding documents -- still completeness, never a clearance."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": f"e{i}", "source_type": src, "title": "x", "date": "2026-05-20"}
            for i, src in enumerate(sorted(REQUIRED_BEFORE_GO))
        ],
        "risk_question": "ready for human review?",
        "decision_stage": "pre_signature",
    }
    result = services.middle_corridor_deal_risk(req)
    assert result["valid"] is True
    readiness = result["response"]["counterparty_readiness"]
    assert readiness["status"] == "complete_for_review"
    assert readiness["missing_count"] == 0
    assert readiness["supplied_count"] == len(REQUIRED_BEFORE_GO)
    assert readiness["outstanding_documents"] == []
    # Boundary: completeness note must not imply clearance/approval.
    note = readiness["presentable_note"].lower()
    for word in ["cleared", "approved", "compliant", "sanctions safe"]:
        assert word not in note


def test_middle_corridor_counterparty_readiness_document_ledger():
    """Per-document ledger: one entry per required-before-go source type, status received/missing,
    and date_received pulled from the supplied dated source when present. Schema-valid."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "sanctions_list_extract", "title": "x", "date": "2026-05-21"},
        ],
        "risk_question": "escalate before signature?",
        "decision_stage": "pre_signature",
    }
    result = services.middle_corridor_deal_risk(req)
    assert result["valid"] is True
    ledger = result["response"]["counterparty_readiness"]["document_ledger"]
    # One entry per required-before-go source type, no more.
    assert {e["source_type"] for e in ledger} == REQUIRED_BEFORE_GO
    assert len(ledger) == len(REQUIRED_BEFORE_GO)
    by_type = {e["source_type"]: e for e in ledger}
    # The supplied source is received with its date; the rest are missing with no date.
    assert by_type["sanctions_list_extract"]["status"] == "received"
    assert by_type["sanctions_list_extract"]["date_received"] == "2026-05-21"
    assert by_type["beneficial_ownership_source"]["status"] == "missing"
    assert "date_received" not in by_type["beneficial_ownership_source"]
    # Ledger received count reconciles with supplied_count.
    received = [e for e in ledger if e["status"] == "received"]
    assert len(received) == result["response"]["counterparty_readiness"]["supplied_count"]
    assert_valid(RESPONSE_SCHEMA_PATH, _write_tmp(result["response"]))


def test_middle_corridor_surfaces_reexport_control_checklist_when_end_user_evidence_missing():
    """When end-user / no-re-export evidence is not supplied, an end-use verification checklist
    (EU Sanctions Helpdesk / US diversion red flags) is surfaced, routed to human review, and the
    response stays schema-valid within the evidence-gap boundary."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti -> EU",
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
    indicators = resp["reexport_control_indicators"]
    assert indicators
    blob = " ".join(indicators).lower()
    assert "no-re-export" in blob or "no re-export" in blob
    assert "end-user" in blob
    for word in ["cleared", "approved", "sanctions safe"]:
        assert word not in blob
    assert_valid(RESPONSE_SCHEMA_PATH, _write_tmp(resp))


def test_middle_corridor_reexport_checklist_omitted_and_score_unchanged_when_end_user_supplied():
    """Negative control + score boundary: supplying end_user_or_reexport_evidence omits the
    checklist and does NOT change the decision_readiness_score (the source is not a scored
    required-before-go item, preserving ADR 0003 score comparability)."""
    from agenda_intelligence import services

    base = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "sanctions_list_extract", "title": "x", "date": "2026-05-21"},
        ],
        "risk_question": "escalate?",
        "decision_stage": "pre_signature",
    }
    without = services.middle_corridor_deal_risk(base)["response"]
    with_end_user = dict(base)
    with_end_user["dated_sources"] = base["dated_sources"] + [
        {"id": "e2", "source_type": "end_user_or_reexport_evidence", "title": "EUS", "date": "2026-05-22"},
    ]
    result = services.middle_corridor_deal_risk(with_end_user)
    assert result["valid"] is True
    resp = result["response"]
    assert "reexport_control_indicators" not in resp
    # Score comparability: adding the non-scored end-user evidence must not move the score.
    assert resp["decision_readiness_score"] == without["decision_readiness_score"]


def test_middle_corridor_surfaces_source_of_funds_checklist_when_evidence_missing():
    """When source-of-funds / source-of-wealth evidence is not supplied, an SOF/SOW verification
    checklist (FATF Rec 10 EDD guidance) is surfaced, routed to human review, and the response
    stays schema-valid within the evidence-gap boundary."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
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
    indicators = resp["source_of_funds_indicators"]
    assert indicators
    blob = " ".join(indicators).lower()
    assert "source of funds" in blob
    assert "source of wealth" in blob
    for word in ["cleared", "approved", "sanctions safe"]:
        assert word not in blob
    assert_valid(RESPONSE_SCHEMA_PATH, _write_tmp(resp))


def test_middle_corridor_sof_checklist_omitted_and_score_unchanged_when_evidence_supplied():
    """Negative control + score boundary: supplying source_of_funds_or_wealth_evidence omits the
    checklist and does NOT change the decision_readiness_score (not a scored required-before-go item)."""
    from agenda_intelligence import services

    base = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "sanctions_list_extract", "title": "x", "date": "2026-05-21"},
        ],
        "risk_question": "escalate?",
        "decision_stage": "pre_signature",
    }
    without = services.middle_corridor_deal_risk(base)["response"]
    with_sof = dict(base)
    with_sof["dated_sources"] = base["dated_sources"] + [
        {"id": "e2", "source_type": "source_of_funds_or_wealth_evidence", "title": "SOF", "date": "2026-05-22"},
    ]
    result = services.middle_corridor_deal_risk(with_sof)
    assert result["valid"] is True
    resp = result["response"]
    assert "source_of_funds_indicators" not in resp
    assert resp["decision_readiness_score"] == without["decision_readiness_score"]


def test_middle_corridor_surfaces_pep_checklist_when_evidence_missing():
    """When PEP-screening evidence is not supplied, a PEP screening checklist (FATF Rec 12/22)
    is surfaced, routed to human review, and the response stays schema-valid. It is a checklist
    of what to screen, never a PEP determination."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
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
    indicators = resp["pep_screening_indicators"]
    assert indicators
    blob = " ".join(indicators).lower()
    assert "pep" in blob
    assert "close associates" in blob
    for word in ["cleared", "approved", "sanctions safe"]:
        assert word not in blob
    assert_valid(RESPONSE_SCHEMA_PATH, _write_tmp(resp))


def test_middle_corridor_pep_checklist_omitted_and_score_unchanged_when_evidence_supplied():
    """Negative control + score boundary: supplying pep_screening_evidence omits the checklist
    and does NOT change the decision_readiness_score (not a scored required-before-go item)."""
    from agenda_intelligence import services

    base = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "sanctions_list_extract", "title": "x", "date": "2026-05-21"},
        ],
        "risk_question": "escalate?",
        "decision_stage": "pre_signature",
    }
    without = services.middle_corridor_deal_risk(base)["response"]
    with_pep = dict(base)
    with_pep["dated_sources"] = base["dated_sources"] + [
        {"id": "e2", "source_type": "pep_screening_evidence", "title": "PEP", "date": "2026-05-22"},
    ]
    result = services.middle_corridor_deal_risk(with_pep)
    assert result["valid"] is True
    resp = result["response"]
    assert "pep_screening_indicators" not in resp
    assert resp["decision_readiness_score"] == without["decision_readiness_score"]


def test_middle_corridor_surfaces_front_company_checklist_when_evidence_missing():
    """When business-substance evidence is not supplied, a front-company / business-substance
    checklist (EU Sanctions Helpdesk counterparty red flags) is surfaced, routed to human review,
    and the response stays schema-valid. It is a checklist of what to verify, never a
    shell-company determination."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
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
    indicators = resp["front_company_indicators"]
    assert indicators
    blob = " ".join(indicators).lower()
    assert "business substance" in blob
    assert "power of attorney" in blob
    for word in ["cleared", "approved", "sanctions safe", "is a shell"]:
        assert word not in blob
    assert_valid(RESPONSE_SCHEMA_PATH, _write_tmp(resp))


def test_middle_corridor_front_company_checklist_omitted_and_score_unchanged_when_evidence_supplied():
    """Negative control + score boundary: supplying business_substance_evidence omits the checklist
    and does NOT change the decision_readiness_score (not a scored required-before-go item)."""
    from agenda_intelligence import services

    base = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "sanctions_list_extract", "title": "x", "date": "2026-05-21"},
        ],
        "risk_question": "escalate?",
        "decision_stage": "pre_signature",
    }
    without = services.middle_corridor_deal_risk(base)["response"]
    with_substance = dict(base)
    with_substance["dated_sources"] = base["dated_sources"] + [
        {"id": "e2", "source_type": "business_substance_evidence", "title": "Substance", "date": "2026-05-22"},
    ]
    result = services.middle_corridor_deal_risk(with_substance)
    assert result["valid"] is True
    resp = result["response"]
    assert "front_company_indicators" not in resp
    assert resp["decision_readiness_score"] == without["decision_readiness_score"]


def test_middle_corridor_run_provenance_is_emitted_and_schema_valid():
    """Every response carries a run_provenance stamp: contract version, the response
    schema $id, and a sha256 digest of the request. Schema-valid throughout (ADR 0018)."""
    from agenda_intelligence import __version__, services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "sanctions_list_extract", "title": "x", "date": "2026-05-21"},
        ],
        "risk_question": "escalate before signature?",
        "decision_stage": "pre_signature",
    }
    resp = services.middle_corridor_deal_risk(req)["response"]
    prov = resp["run_provenance"]
    assert prov["contract_version"] == __version__
    assert prov["schema_id"].endswith("middle-corridor-deal-risk-response.schema.json")
    assert re.fullmatch(r"sha256:[0-9a-f]{64}", prov["input_digest"])
    assert_valid(RESPONSE_SCHEMA_PATH, _write_tmp(resp))


def test_middle_corridor_input_digest_is_deterministic_and_input_bound():
    """The digest is reproducible for the same request and changes when the input
    changes -- the reproducibility relation the stamp claims (ADR 0018)."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "sanctions_list_extract", "title": "x", "date": "2026-05-21"},
        ],
        "risk_question": "escalate before signature?",
        "decision_stage": "pre_signature",
    }
    first = services.middle_corridor_deal_risk(req)["response"]["run_provenance"]["input_digest"]
    second = services.middle_corridor_deal_risk(req)["response"]["run_provenance"]["input_digest"]
    assert first == second
    changed = dict(req, cargo="dual-use industrial equipment")
    changed_digest = services.middle_corridor_deal_risk(changed)["response"]["run_provenance"]["input_digest"]
    assert changed_digest != first


def test_middle_corridor_flags_named_sector_counterparty():
    """Counterparty with a non-'other' specified_sectors[] value must be flagged
    as an OFAC FAQ 1148 / 1151 FFI sanctions-exposure point under EO 14024 / EO 14114."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {
                "role": "consignee",
                "name": "KZ Industries",
                "jurisdiction": "Kazakhstan",
                "specified_sectors": ["manufacturing", "technology"],
            },
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "port_operator_notice", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "escalate before signature?",
        "decision_stage": "pre_signature",
    }
    resp = services.middle_corridor_deal_risk(req)["response"]
    assert "counterparty operates in an OFAC-named sector under EO 14024" in resp["top_risks"]
    assert "limitations" in resp
    joined = " ".join(resp["limitations"])
    assert "OFAC-named sector" in joined
    assert "not a sanctions determination" in joined
    foreign_layer = " ".join(resp["exposure_layers"]["foreign_sanctions_exposure_layer"])
    assert "OFAC-named sector" in foreign_layer


def test_middle_corridor_sector_other_only_not_flagged():
    """Negative control: a counterparty whose only sector value is 'other'
    must NOT trigger the OFAC-named-sector flag."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {
                "role": "forwarder",
                "name": "KZ Forwarder",
                "jurisdiction": "Kazakhstan",
                "specified_sectors": ["other"],
            },
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "port_operator_notice", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "escalate?",
        "decision_stage": "pre_signature",
    }
    resp = services.middle_corridor_deal_risk(req)["response"]
    assert "counterparty operates in an OFAC-named sector under EO 14024" not in resp["top_risks"]


def test_middle_corridor_flags_newly_formed_counterparty():
    """Counterparty with date_of_formation on or after 2022-02-24 in a high-risk
    or circumvention-watch jurisdiction must be flagged per the OFAC FFI advisory
    red-flag pattern."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "electronics",
        "counterparties": [
            {
                "role": "consignee",
                "name": "KZ NewCo",
                "jurisdiction": "Kazakhstan",
                "date_of_formation": "2022-03-15",
            },
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "port_operator_notice", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "escalate before signature?",
        "decision_stage": "pre_signature",
    }
    resp = services.middle_corridor_deal_risk(req)["response"]
    assert "counterparty newly formed in a transshipment-risk jurisdiction" in resp["top_risks"]
    assert "limitations" in resp
    joined = " ".join(resp["limitations"])
    assert "newly formed" in joined
    assert "not a sanctions determination" in joined


def test_middle_corridor_pre_2022_formation_not_flagged():
    """Negative control: a counterparty formed before the 2022-02-24 cutoff
    must NOT trigger the newly-formed red flag, even in a watch jurisdiction."""
    from agenda_intelligence import services

    req = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "counterparties": [
            {
                "role": "forwarder",
                "name": "KZ Old Co",
                "jurisdiction": "Kazakhstan",
                "date_of_formation": "2018-06-01",
            },
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "port_operator_notice", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "escalate?",
        "decision_stage": "pre_signature",
    }
    resp = services.middle_corridor_deal_risk(req)["response"]
    assert "counterparty newly formed in a transshipment-risk jurisdiction" not in resp["top_risks"]


def _write_tmp(obj):
    import tempfile

    path = Path(tempfile.mkstemp(suffix=".json")[1])
    path.write_text(json.dumps(obj))
    return path


def _base_request(route: str) -> dict:
    return {
        "route": route,
        "cargo": "containerized machinery",
        "counterparties": [
            {"role": "forwarder", "name": "KZ Forwarder", "jurisdiction": "Kazakhstan"},
        ],
        "dated_sources": [
            {"id": "e1", "source_type": "port_operator_notice", "title": "x", "date": "2026-05-20"},
        ],
        "risk_question": "screen before signature?",
        "decision_stage": "pre_signature",
    }


def test_middle_corridor_ships_route_and_customs_screening_layers():
    """Standing route-sanctions and customs-harmonization layers ship on every response."""
    from agenda_intelligence import services

    result = services.middle_corridor_deal_risk(_base_request("Altynkol -> Aktau -> Baku -> Poti -> EU"))
    assert result["valid"] is True
    resp = result["response"]
    assert resp["route_sanctions_exposure_indicators"]
    assert resp["customs_harmonization_indicators"]
    # Clean route: no sanctions-exposed segment matched, so the optional field is absent.
    assert "route_sanctions_matched_segments" not in resp


def test_middle_corridor_flags_sanctions_exposed_route_segment():
    """A route naming an Iran-transit leg is presence-flagged, not adjudicated (ADR 0015)."""
    from agenda_intelligence import services

    result = services.middle_corridor_deal_risk(_base_request("Bandar Abbas -> Rasht-Astara -> Baku -> Poti"))
    assert result["valid"] is True
    resp = result["response"]
    matched = resp["route_sanctions_matched_segments"]
    assert any("Iran" in segment for segment in matched)
    assert "limitations" in resp
    joined = " ".join(resp["limitations"])
    assert "route-screening escalation flag for human review" in joined
    # Boundary: must NOT phrase it as a determination.
    assert "not a sanctions determination" in joined
