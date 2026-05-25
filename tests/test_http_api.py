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


def test_http_api_rejects_bad_request_shape():
    status, body = handle_post("/v1/score", {"before_text": "x"})

    assert status == 400
    assert body == {"ok": False, "error": "before_text and after_text must be strings"}
