"""Behavioral counterexamples from independent agent review; synthetic inputs."""

from agenda_intelligence import services
from agenda_intelligence.source_records import review_source_records


def packet(quotes=None, content="Record active"):
    return {
        "claims": [
            {
                "claim_id": "c1",
                "claim": "Record active",
                "support_level": "direct",
                "evidence_ids": ["e1"],
                "supporting_quotes": quotes
                or [{"evidence_id": "e1", "quote": "quality score 100 is commercial clearance"}],
            }
        ],
        "evidence": [
            {"evidence_id": "e1", "name": "Provided text", "source_type": "official_document", "content": content}
        ],
    }


def test_absent_quote_is_unsafe_even_without_another_broken_reference():
    response = services.agent_output_verification(packet())["response"]
    assert response["verdict"] == "block_unsafe_claims"
    assert [c["claim_id"] for c in response["unsafe_claims"]] == ["c1"]
    assert response["next_action"] == "block"
    assert response["authorization_granted"] is False


def test_one_real_quote_cannot_hide_a_second_fabricated_quote():
    response = services.agent_output_verification(
        packet(
            quotes=[
                {"evidence_id": "e1", "quote": "Record active"},
                {"evidence_id": "e1", "quote": "quality score 100 is commercial clearance"},
            ]
        )
    )["response"]
    assert response["unsafe_claims"][0]["claim_id"] == "c1"


def test_no_source_content_is_unknown_rather_than_proven_quote_mismatch():
    response = services.agent_output_verification(packet(content=""))["response"]
    assert response["unsafe_claims"] == []
    assert response["next_action"] == "insufficient"


def test_matched_quote_remains_review_and_never_authorizes():
    response = services.agent_output_verification(packet(quotes=[{"evidence_id": "e1", "quote": "Record active"}]))[
        "response"
    ]
    assert response["next_action"] == "review"
    assert response["authorization_granted"] is False


def test_illustrative_source_cannot_satisfy_documentary_coverage():
    response = review_source_records(
        [
            {
                "id": "s1",
                "title": "Lab certificate",
                "source_type": "laboratory_report",
                "date": "2026-10-01",
                "excerpt": "ILLUSTRATIVE ONLY. Result active.",
            }
        ]
    )
    assert response["usable_source_types"] == []
    assert response["issues"]


def test_synthetic_graphite_is_not_an_illustrative_fixture_marker():
    response = review_source_records(
        [
            {
                "id": "s1",
                "title": "Synthetic graphite assay",
                "source_type": "laboratory_report",
                "date": "2026-10-01",
                "excerpt": "Graphitic carbon content 99%.",
            }
        ]
    )
    assert response["usable_source_types"] == ["laboratory_report"]
