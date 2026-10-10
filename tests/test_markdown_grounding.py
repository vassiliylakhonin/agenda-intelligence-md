"""Source formatting regressions and adversarial context controls."""

import pytest

from agenda_intelligence import review_rag_answer
from agenda_intelligence.services import check_evidence_packet

TABLE = """| Cloudflare Plan | Maximum request body size |
| --- | --- |
| Free | 100 MB |
| Pro | 100 MB |
| Business | 200 MB |
| Enterprise | Up to 5 GB (self-serve) |
"""
WRAPPED = """The client **SHOULD NOT** send requests other than
pings before the server has responded to the
initialize request.
"""


def check(claim, text):
    return check_evidence_packet(
        {
            "claims": [{"claim_id": "c", "text": claim, "source_ids": ["s"]}],
            "sources": [{"source_id": "s", "text": text}],
        }
    )["response"]


def test_table_header_context_supports_each_named_plan_without_mutating_source():
    claim = (
        "Request body limits depend on the Cloudflare account plan: Free and Pro allow 100 MB, "
        "Business 200 MB and Enterprise up to 5 GB self-serve."
    )
    report = review_rag_answer(claim + " [s]", [{"source_id": "s", "text": TABLE}])
    assert report["route"] == "human_review"
    assert report["packet"]["sources"][0]["text"] == TABLE
    assert report["verification"]["factuality_status"] == "not_assessed"


@pytest.mark.parametrize(
    "claim",
    ["Free request body size is 200 MB.", "Business request body size is 100 MB.", "Free request body size is 900 MB."],
)
def test_numeric_value_from_other_table_row_cannot_launder_an_error(claim):
    report = check(claim, TABLE)
    assert report["packet_status"] == "source_review_required"
    assert report["claims"][0]["lexical_support"]["unmatched_numbers"]


def test_wrapped_normative_sentence_keeps_negation_with_its_context():
    claim = "The client should not send requests other than pings before the server responds to initialize."
    assert check(claim, WRAPPED)["packet_status"] == "packet_complete"
    wrong = "The client should send requests before the server responds to initialize."
    assert "lexical_support_polarity_mismatch" in check(wrong, WRAPPED)["claims"][0]["issues"]


def test_separate_positive_and_negative_clauses_match_their_own_source_sentences():
    source = "Each isolate can consume up to 128 MB of memory. This limit is per-isolate, not per-invocation."
    claim = "Each isolate can consume up to 128 MB of memory; this limit is per-isolate, not per-invocation."
    assert check(claim, source)["packet_status"] == "packet_complete"
    wrong = "Each isolate cannot consume up to 128 MB of memory; this limit is per-isolate, not per-invocation."
    assert "lexical_support_polarity_mismatch" in check(wrong, source)["claims"][0]["issues"]


def test_unrelated_number_on_a_separate_line_is_not_folded_into_the_claim_context():
    source = "Port project budget was 100 million USD\nAn unrelated aircraft purchase cost 900 million USD"
    report = check("Port project budget was 900 million USD.", source)
    assert report["claims"][0]["lexical_support"]["unmatched_numbers"] == ["900"]


def test_blank_paragraphs_and_bullets_do_not_share_numeric_context():
    source = "- Port project budget was 100 million USD\n- An unrelated aircraft purchase cost 900 million USD"
    assert check("Port project budget was 900 million USD.", source)["packet_status"] == "source_review_required"
