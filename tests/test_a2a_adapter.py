import json
from pathlib import Path

from agenda_intelligence import a2a_adapter

REPO_ROOT = Path(__file__).resolve().parents[1]
A2A_EXAMPLES = REPO_ROOT / "examples" / "a2a"


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


def agentic_interaction_trust_request():
    return {
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


def test_agent_card_exposes_middle_corridor_skill():
    card = a2a_adapter.agent_card("https://example.com")

    assert card["url"] == "https://example.com"
    assert card["protocolVersion"] == "1.0"
    assert card["supportedInterfaces"][0]["url"] == "https://example.com/message/send"
    assert card["supportedInterfaces"][0]["protocolBinding"] == "JSONRPC"
    assert card["supportedInterfaces"][0]["protocolVersion"] == "1.0"
    assert card["x_agenda_intelligence"]["product_profile"] == "middle_corridor_deal_risk"
    assert card["x_agenda_intelligence"]["canonical_http_endpoint"] == "/v1/middle-corridor/deal-risk"
    assert card["skills"][0]["id"] == "middle-corridor-deal-risk-gate"
    assert card["x_agenda_intelligence"]["supported_capabilities"] == [
        "middle_corridor_deal_risk",
        "agentic_interaction_trust",
        "cis_secondary_sanctions_exposure",
        "gulf_maritime_exposure",
        "kazakhstan_market_entry_readiness",
        "audit_claims",
        "source_coverage",
        "score_output",
        "agent_output_verification",
        "pre_action_check",
    ]
    assert any(skill["id"] == "agentic-interaction-trust-gate" for skill in card["skills"])


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
    assert result["status"]["state"] == "TASK_STATE_COMPLETED"
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


def test_jsonrpc_message_send_routes_agentic_interaction_trust_capability():
    response = a2a_adapter.handle_jsonrpc(
        {
            "jsonrpc": "2.0",
            "id": "agentic-1",
            "method": "message/send",
            "params": {
                "capability": "agentic_interaction_trust",
                "request": agentic_interaction_trust_request(),
            },
        }
    )

    result = response["result"]
    contract = result["metadata"]["response"]
    assert result["status"]["state"] == "TASK_STATE_COMPLETED"
    assert result["metadata"]["product_profile"] == "agentic_interaction_trust"
    assert result["metadata"]["canonical_http_endpoint"] == "/v1/agentic-interaction/trust"
    assert contract["triage_recommendation"] == "require_step_up"
    assert contract["trust_signal"] == "medium"
    assert contract["decision_readiness_score"] == 40
    assert "Agentic interaction trust gate response" in result["artifacts"][0]["parts"][0]["text"]


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
    assert result["status"]["state"] == "TASK_STATE_COMPLETED"
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
    assert result["status"]["state"] == "TASK_STATE_COMPLETED"
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
    assert result["status"]["state"] == "TASK_STATE_COMPLETED"
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
        "agentic_interaction_trust",
        "cis_secondary_sanctions_exposure",
        "gulf_maritime_exposure",
        "kazakhstan_market_entry_readiness",
        "audit_claims",
        "source_coverage",
        "score_output",
        "agent_output_verification",
        "pre_action_check",
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


def test_a2a_example_requests_are_valid_jsonrpc_objects():
    for path in A2A_EXAMPLES.glob("*.request.json"):
        payload = json.loads(path.read_text())

        assert payload["jsonrpc"] == "2.0", path
        assert isinstance(payload["id"], str), path
        assert payload["method"] in {"agent/card", "message/send"}, path


def test_a2a_example_requests_run_through_stdin_shell():
    expected_profiles = {
        "middle-corridor-deal-risk.request.json": "middle_corridor_deal_risk",
        "gulf-maritime-exposure.request.json": "gulf_maritime_exposure",
        "audit-claims.request.json": "audit_claims",
        "source-coverage.request.json": "source_coverage",
        "score-output.request.json": "score_output",
    }

    for filename, expected_profile in expected_profiles.items():
        response = a2a_adapter.handle_stdin_jsonrpc((A2A_EXAMPLES / filename).read_text())

        assert "error" not in response, filename
        result = response["result"]
        assert result["status"]["state"] == "TASK_STATE_COMPLETED", filename
        assert result["metadata"]["product_profile"] == expected_profile, filename


def test_a2a_agent_card_example_runs_through_stdin_shell():
    response = a2a_adapter.handle_stdin_jsonrpc((A2A_EXAMPLES / "agent-card.request.json").read_text())

    assert "error" not in response
    assert response["result"]["x_agenda_intelligence"]["supported_capabilities"] == [
        "middle_corridor_deal_risk",
        "agentic_interaction_trust",
        "cis_secondary_sanctions_exposure",
        "gulf_maritime_exposure",
        "kazakhstan_market_entry_readiness",
        "audit_claims",
        "source_coverage",
        "score_output",
        "agent_output_verification",
        "pre_action_check",
    ]
