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


def _write_tmp(obj):
    import tempfile

    path = Path(tempfile.mkstemp(suffix=".json")[1])
    path.write_text(json.dumps(obj))
    return path
