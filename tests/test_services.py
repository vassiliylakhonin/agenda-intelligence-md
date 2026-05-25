from agenda_intelligence import mcp_server, services


def test_services_audit_claims_matches_mcp_wrapper():
    audit = {
        "topic": "x",
        "claims": [
            {
                "claim_id": "c1",
                "claim": "test",
                "evidence_ids": ["missing"],
                "support_level": "direct",
            }
        ],
        "evidence": [],
    }

    assert services.audit_claims(audit) == mcp_server.audit_claims(audit)


def test_services_source_coverage_matches_mcp_wrapper():
    evidence = {
        "topic": "sanctions claim",
        "evidence_mode": "live_source_backed",
        "claims": [
            {
                "claim": "Company X appears on the OFAC list.",
                "support_status": "supported",
                "sources": [
                    {
                        "evidence_id": "e1",
                        "name": "OFAC SDN list entry",
                        "source_type": "official",
                        "freshness": "current",
                        "supports": ["Official sanctions list designation."],
                    }
                ],
            }
        ],
        "unsupported_claims": [],
    }

    assert services.source_coverage(evidence, "sanctions") == mcp_server.source_coverage(evidence, "sanctions")


def test_services_score_output_matches_mcp_wrapper():
    before = "Generic update. Monitor developments."
    after = (
        "Signal classification: compliance-relevant development. "
        "What changed: guidance moved toward implementation. "
        "Main uncertainty: whether enforcement follows. "
        "Watch next: regulator guidance and compliance deadline."
    )

    assert services.score_output(before, after) == mcp_server.score_output(before, after)


def test_services_middle_corridor_deal_risk_builds_contract_response():
    request = {
        "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
        "cargo": "industrial equipment",
        "shipment_value": {
            "amount": 2400000,
            "currency": "USD",
        },
        "counterparties": [
            {
                "role": "forwarder",
                "name": "Kazakhstan forwarder",
                "jurisdiction": "Kazakhstan",
            }
        ],
        "dated_sources": [
            {
                "id": "e1",
                "source_type": "port_operator_notice",
                "title": "Port operator notice",
                "date": "2026-05-20",
                "url": "https://example.com/port-notice",
            },
            {
                "id": "e2",
                "source_type": "sanctions_list_extract",
                "title": "Sanctions list extract",
                "date": "2026-05-21",
                "url": "https://example.com/sanctions",
            },
            {
                "id": "e3",
                "source_type": "carrier_note",
                "title": "Carrier note",
                "date": "2026-05-22",
                "url": "https://example.com/carrier",
            },
        ],
        "risk_question": "Should this be escalated before contract signature?",
        "decision_stage": "pre_signature",
    }

    result = services.middle_corridor_deal_risk(request)

    assert result["valid"] is True
    assert result["errors"] == []
    response = result["response"]
    assert response["triage_recommendation"] == "escalate_before_signature"
    assert response["risk_signal"] == "medium_high"
    assert response["decision_readiness_score"] == 42
    assert response["decision_readiness_label"] == "not_decision_ready"
    assert response["minimum_sources_before_go"] == [
        "counterparty_registry_extract",
        "beneficial_ownership_source",
        "customs_or_regulatory_source",
        "insurance_clause_or_underwriter_note",
        "vessel_or_carrier_history",
    ]
