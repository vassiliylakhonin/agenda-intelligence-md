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
