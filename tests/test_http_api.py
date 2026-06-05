from agenda_intelligence.http_api import handle_get, handle_post


def test_http_api_health_and_ready_contracts():
    health_status, health = handle_get("/healthz")
    ready_status, ready = handle_get("/readyz")

    assert health_status == 200
    assert health["ok"] is True
    assert health["service"] == "agenda-intelligence-http"
    assert ready_status == 200
    assert ready["ready"] is True
    assert "source_coverage" in ready["service_layer"]
    assert "agentic_interaction_trust" in ready["service_layer"]
    assert "No autonomous live source retrieval" in ready["boundary"]


def test_http_api_audit_claims_contract():
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

    status, body = handle_post("/v1/audit-claims", {"audit_json": audit})

    assert status == 200
    assert body["valid"] is True
    assert body["summary"]["orphan_evidence_refs"] == [{"claim_id": "c1", "missing_evidence_ids": ["missing"]}]


def test_http_api_source_coverage_contract():
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

    status, body = handle_post("/v1/source-coverage", {"evidence_json": evidence, "category": "sanctions"})

    assert status == 200
    assert body["valid_category"] is True
    assert "sanctions_list" in body["covered_required_sources"]
    assert body["strict_gate_passed"] is False


def test_http_api_score_contract():
    status, body = handle_post(
        "/v1/score",
        {
            "before_text": "Generic update. Monitor developments.",
            "after_text": (
                "Signal classification: compliance-relevant development. "
                "What changed: guidance moved toward implementation. "
                "Main uncertainty: whether enforcement follows. "
                "Watch next: regulator guidance and compliance deadline."
            ),
        },
    )

    assert status == 200
    assert body["error"] is None
    assert body["after_score"] > body["before_score"]


def test_http_api_middle_corridor_deal_risk_contract():
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

    status, body = handle_post("/v1/middle-corridor/deal-risk", request)

    assert status == 200
    assert body["triage_recommendation"] == "escalate_before_signature"
    assert body["risk_signal"] == "medium_high"
    assert body["decision_readiness_score"] == 42
    assert body["decision_readiness_label"] == "not_decision_ready"


def test_http_api_agentic_interaction_trust_contract():
    request = {
        "actor": {
            "declared_type": "ai_agent",
            "declared_name": "Example Shopping Agent",
            "operator": "Example Consumer",
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

    status, body = handle_post("/v1/agentic-interaction/trust", request)

    assert status == 200
    assert body["triage_recommendation"] == "require_step_up"
    assert body["trust_signal"] == "medium"
    assert body["decision_readiness_score"] == 40
    assert body["decision_readiness_label"] == "not_decision_ready"


def test_http_api_rejects_bad_request_shape():
    status, body = handle_post("/v1/score", {"before_text": "x"})

    assert status == 400
    assert body == {"ok": False, "error": "before_text and after_text must be strings"}


def test_http_api_rejects_invalid_middle_corridor_request():
    status, body = handle_post("/v1/middle-corridor/deal-risk", {"route": "Altynkol"})

    assert status == 400
    assert body["ok"] is False
    assert body["error"] == "Invalid Middle Corridor deal-risk request"
    assert body["errors"]


def test_http_api_rejects_invalid_agentic_interaction_trust_request():
    status, body = handle_post("/v1/agentic-interaction/trust", {"actor": {}})

    assert status == 400
    assert body["ok"] is False
    assert body["error"] == "Invalid agentic interaction trust request"
    assert body["errors"]


def test_http_api_vertical_worker_validation_unavailable_maps_to_500(monkeypatch):
    """If schema validation is unavailable (server fault), HTTP returns 500, not 400."""
    from agenda_intelligence import services

    monkeypatch.setattr(
        services,
        "middle_corridor_deal_risk",
        lambda payload: {
            "implemented": False,
            "valid": None,
            "errors": ["jsonschema is not installed – cannot validate"],
            "response": None,
        },
    )

    status, body = handle_post("/v1/middle-corridor/deal-risk", {"any": "payload"})

    assert status == 500
    assert body["ok"] is False
    assert "validation unavailable" in body["error"]
    assert body["errors"]


def test_http_api_vertical_worker_schema_invalid_still_maps_to_400():
    """A genuinely invalid request (validation ran) stays a 400 client error."""
    status, body = handle_post("/v1/middle-corridor/deal-risk", {"missing": "required fields"})

    assert status == 400
    assert body["ok"] is False
    assert body["errors"]
