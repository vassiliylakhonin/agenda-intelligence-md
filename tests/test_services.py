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


def test_services_agentic_interaction_trust_builds_contract_response():
    request = {
        "actor": {
            "declared_type": "ai_agent",
            "declared_name": "Example Shopping Agent",
            "operator": "Example Consumer",
            "declared_user_agent": "ExampleShoppingAgent/1.0",
            "authentication_context": "session_cookie",
        },
        "target_surface": "checkout",
        "requested_action": "complete purchase of two restricted-delivery items",
        "asset_or_resource": "order-123",
        "decision_stage": "pre_execution",
        "dated_sources": [
            {
                "id": "ait-checkout-1",
                "source_type": "agent_identity_claim",
                "title": "Declared agent identity header",
                "date": "2026-05-28",
            },
            {
                "id": "ait-checkout-2",
                "source_type": "session_authentication_evidence",
                "title": "Authenticated checkout session",
                "date": "2026-05-28",
            },
            {
                "id": "ait-checkout-3",
                "source_type": "transaction_or_target_action_evidence",
                "title": "Order and delivery restriction summary",
                "date": "2026-05-28",
            },
        ],
        "risk_question": "Is this agent-mediated checkout ready to allow, step up, or route to human review?",
    }

    result = services.agentic_interaction_trust(request)

    assert result["valid"] is True
    assert result["errors"] == []
    response = result["response"]
    assert response["triage_recommendation"] == "require_step_up"
    assert response["trust_signal"] == "medium"
    assert response["decision_readiness_score"] == 40
    assert response["decision_readiness_label"] == "not_decision_ready"
    assert response["minimum_sources_before_action"] == [
        "operator_or_principal_authorization",
        "agent_card_or_manifest",
        "tool_scope_or_permission_evidence",
        "action_intent_evidence",
    ]
    assert response["human_review_required"] is True
