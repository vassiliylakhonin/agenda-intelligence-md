"""Tests for enhanced quote matching (ellipsis support, normalized punctuation, unicode quotes)."""

from __future__ import annotations

from agenda_intelligence.services import _quote_matches_source, check_evidence_packet


def test_quote_matches_verbatim():
    source = "The board approved a credit facility of $50M on June 15, 2026."
    quote = "The board approved a credit facility of $50M"
    assert _quote_matches_source(quote, source) is True


def test_quote_matches_typographical_quotes_and_dashes():
    source = 'The committee said "approved" on 2026-05-01.'
    quote = "The committee said «approved» on 2026-05-01."
    assert _quote_matches_source(quote, source) is True

    source_dash = "Phase 1 – Phase 2 implementation."
    quote_dash = "Phase 1 - Phase 2 implementation."
    assert _quote_matches_source(quote_dash, source_dash) is True


def test_quote_matches_with_ellipsis():
    source = (
        "The board approved the new risk framework yesterday afternoon following "
        "a three-hour debate, and the policy will become effective on July 1."
    )
    quote = "The board approved the new risk framework ... effective on July 1."
    assert _quote_matches_source(quote, source) is True

    quote_unicode_ellipsis = "The board approved the new risk framework … effective on July 1."
    assert _quote_matches_source(quote_unicode_ellipsis, source) is True


def test_quote_ellipsis_fails_if_order_is_wrong():
    source = "First came event A, and much later came event B."
    quote_wrong_order = "event B ... event A"
    assert _quote_matches_source(quote_wrong_order, source) is False


def test_quote_ellipsis_fails_if_segment_missing():
    source = "First came event A, and then came event B."
    quote_missing = "event A ... event C"
    assert _quote_matches_source(quote_missing, source) is False


def test_evidence_packet_with_ellipsis_quote():
    packet = {
        "claims": [
            {
                "claim_id": "c1",
                "text": "The committee approved the capital expenditure effective Q3.",
                "source_ids": ["s1"],
                "quotes": [
                    {
                        "source_id": "s1",
                        "text": "The committee approved the capital expenditure ... effective Q3.",
                    }
                ],
            }
        ],
        "sources": [
            {
                "source_id": "s1",
                "text": "The committee approved the capital expenditure after extensive review, effective Q3.",
            }
        ],
    }
    result = check_evidence_packet(packet)
    assert result["valid"] is True
    response = result["response"]
    assert response["packet_status"] == "packet_complete"
    assert response["claims"][0]["quote_checks"][0]["status"] == "present"
