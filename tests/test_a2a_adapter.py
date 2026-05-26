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


def test_jsonrpc_unknown_method_returns_method_not_found():
    response = a2a_adapter.handle_jsonrpc({"jsonrpc": "2.0", "id": "x", "method": "unknown"})

    assert response["error"]["code"] == -32601
