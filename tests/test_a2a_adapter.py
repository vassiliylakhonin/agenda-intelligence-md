from agenda_intelligence import a2a_adapter


def middle_corridor_request():
    return {
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


def test_agent_card_exposes_middle_corridor_skill():
    card = a2a_adapter.agent_card("https://example.com")

    assert card["url"] == "https://example.com"
    assert card["x_agenda_intelligence"]["product_profile"] == "middle_corridor_deal_risk"
    assert card["x_agenda_intelligence"]["canonical_http_endpoint"] == "/v1/middle-corridor/deal-risk"
    assert card["skills"][0]["id"] == "middle-corridor-deal-risk-gate"
    assert card["x_agenda_intelligence"]["supported_capabilities"] == [
        "middle_corridor_deal_risk",
        "audit_claims",
        "source_coverage",
        "score_output",
    ]


def test_jsonrpc_agent_card_method():
    response = a2a_adapter.handle_jsonrpc(
        {"jsonrpc": "2.0", "id": "card-1", "method": "agent/card"},
        "https://example.com",
    )

    assert response["id"] == "card-1"
    assert response["result"]["url"] == "https://example.com"


def test_jsonrpc_message_send_routes_structured_request_from_params_request():
    response = a2a_adapter.handle_jsonrpc(
        {
            "jsonrpc": "2.0",
            "id": "msg-1",
            "method": "message/send",
            "params": {"request": middle_corridor_request()},
        }
    )

    result = response["result"]
    contract = result["metadata"]["response"]
    assert result["status"]["state"] == "completed"
    assert contract["triage_recommendation"] == "escalate_before_signature"
    assert contract["risk_signal"] == "medium_high"
    assert contract["decision_readiness_score"] == 42
    assert result["metadata"]["human_review_required"] is True
    assert "Decision readiness: 42/100" in result["artifacts"][0]["parts"][0]["text"]


def test_jsonrpc_message_send_routes_structured_request_from_data_part():
    response = a2a_adapter.handle_jsonrpc(
        {
            "jsonrpc": "2.0",
            "id": "msg-2",
            "method": "message/send",
            "params": {
                "message": {
                    "parts": [
                        {
                            "kind": "data",
                            "data": middle_corridor_request(),
                        }
                    ]
                }
            },
        }
    )

    assert response["result"]["metadata"]["response"]["decision_readiness_label"] == "not_decision_ready"


def test_jsonrpc_message_send_rejects_free_text_without_structured_request():
    response = a2a_adapter.handle_jsonrpc(
        {
            "jsonrpc": "2.0",
            "id": "msg-3",
            "method": "message/send",
            "params": {"message": {"parts": [{"kind": "text", "text": "Check this route."}]}},
        }
    )

    assert response["error"]["code"] == -32602
    assert "required_shape" in response["error"]["data"]


def test_jsonrpc_message_send_routes_audit_claims_capability():
    response = a2a_adapter.handle_jsonrpc(
        {
            "jsonrpc": "2.0",
            "id": "audit-1",
            "method": "message/send",
            "params": {
                "capability": "audit_claims",
                "audit_json": {
                    "topic": "shipment memo",
                    "claims": [
                        {
                            "claim_id": "c1",
                            "claim": "The supplied port notice is dated.",
                            "evidence_ids": ["e1"],
                            "support_level": "direct",
                        }
                    ],
                    "evidence": [
                        {
                            "evidence_id": "e1",
                            "name": "Port notice",
                            "source_type": "port_operator_notice",
                        }
                    ],
                },
            },
        }
    )

    result = response["result"]
    assert result["status"]["state"] == "completed"
    assert result["metadata"]["product_profile"] == "audit_claims"
    assert result["metadata"]["canonical_http_endpoint"] == "/v1/audit-claims"
    assert result["metadata"]["response"]["summary"]["claim_count"] == 1


def test_jsonrpc_message_send_routes_source_coverage_capability():
    response = a2a_adapter.handle_jsonrpc(
        {
            "jsonrpc": "2.0",
            "id": "coverage-1",
            "method": "message/send",
            "params": {
                "capability": "source_coverage",
                "category": "sanctions",
                "evidence_json": {
                    "topic": "sanctions memo",
                    "claims": [
                        {
                            "claim": "A sanctions source was supplied.",
                            "sources": [
                                {
                                    "evidence_id": "e1",
                                    "name": "OFAC SDN list extract",
                                    "source_type": "sanctions_list",
                                }
                            ],
                        }
                    ],
                },
            },
        }
    )

    result = response["result"]
    assert result["status"]["state"] == "completed"
    assert result["metadata"]["product_profile"] == "source_coverage"
    assert result["metadata"]["canonical_http_endpoint"] == "/v1/source-coverage"
    assert result["metadata"]["response"]["category"] == "sanctions"


def test_jsonrpc_message_send_routes_score_output_capability():
    response = a2a_adapter.handle_jsonrpc(
        {
            "jsonrpc": "2.0",
            "id": "score-1",
            "method": "message/send",
            "params": {
                "capability": "score_output",
                "input": {
                    "before_text": "Generic update. Monitor developments.",
                    "after_text": (
                        "Signal classification: compliance-relevant development. "
                        "What changed: guidance moved toward implementation. "
                        "Main uncertainty: whether enforcement follows. "
                        "Watch next: regulator guidance and compliance deadline."
                    ),
                },
            },
        }
    )

    result = response["result"]
    assert result["status"]["state"] == "completed"
    assert result["metadata"]["product_profile"] == "score_output"
    assert result["metadata"]["canonical_http_endpoint"] == "/v1/score"
    assert result["metadata"]["response"]["score"] > 0


def test_jsonrpc_message_send_rejects_unknown_capability():
    response = a2a_adapter.handle_jsonrpc(
        {
            "jsonrpc": "2.0",
            "id": "unknown-capability",
            "method": "message/send",
            "params": {
                "capability": "live_retrieval",
                "request": {},
            },
        }
    )

    assert response["error"]["code"] == -32602
    assert response["error"]["message"] == "Unsupported capability"
    assert response["error"]["data"]["supported_capabilities"] == [
        "middle_corridor_deal_risk",
        "audit_claims",
        "source_coverage",
        "score_output",
    ]


def test_jsonrpc_message_send_rejects_missing_audit_claims_payload():
    response = a2a_adapter.handle_jsonrpc(
        {
            "jsonrpc": "2.0",
            "id": "audit-missing",
            "method": "message/send",
            "params": {"capability": "audit_claims", "message": {"parts": [{"kind": "text", "text": "audit it"}]}},
        }
    )

    assert response["error"]["code"] == -32602
    assert response["error"]["message"] == "Missing structured audit_claims request"


def test_jsonrpc_unknown_method_returns_method_not_found():
    response = a2a_adapter.handle_jsonrpc({"jsonrpc": "2.0", "id": "x", "method": "unknown"})

    assert response["error"]["code"] == -32601


def test_stdin_jsonrpc_shell_handles_message_send():
    response = a2a_adapter.handle_stdin_jsonrpc("""
        {
          "jsonrpc": "2.0",
          "id": "stdin-1",
          "method": "message/send",
          "params": {
            "request": {
              "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
              "cargo": "industrial equipment",
              "counterparties": [
                {
                  "role": "forwarder",
                  "name": "Kazakhstan forwarder",
                  "jurisdiction": "Kazakhstan"
                }
              ],
              "dated_sources": [
                {
                  "id": "e1",
                  "source_type": "port_operator_notice",
                  "title": "Port operator notice",
                  "date": "2026-05-20",
                  "url": "https://example.com/port-notice"
                },
                {
                  "id": "e2",
                  "source_type": "sanctions_list_extract",
                  "title": "Sanctions list extract",
                  "date": "2026-05-21",
                  "url": "https://example.com/sanctions"
                },
                {
                  "id": "e3",
                  "source_type": "carrier_note",
                  "title": "Carrier note",
                  "date": "2026-05-22",
                  "url": "https://example.com/carrier"
                }
              ],
              "risk_question": "Should this be escalated before contract signature?",
              "decision_stage": "pre_signature"
            }
          }
        }
        """)

    assert response["id"] == "stdin-1"
    assert response["result"]["metadata"]["response"]["decision_readiness_score"] == 42


def test_stdin_jsonrpc_shell_handles_invalid_json():
    response = a2a_adapter.handle_stdin_jsonrpc("{")

    assert response["error"]["code"] == -32700
    assert response["error"]["message"] == "Parse error"


def test_stdin_jsonrpc_shell_handles_empty_input():
    response = a2a_adapter.handle_stdin_jsonrpc("")

    assert response["error"]["code"] == -32700
    assert response["error"]["data"]["detail"] == "stdin is empty"
