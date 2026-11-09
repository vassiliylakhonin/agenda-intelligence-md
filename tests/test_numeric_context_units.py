"""Bounded numeric context diagnostics, including positive conversion controls."""

import pytest

from agenda_intelligence import review_rag_answer
from agenda_intelligence.grounding import _numeric_fact_keys


def review(claim, source):
    return review_rag_answer(claim + " [source]", [{"source_id": "source", "text": source}])


@pytest.mark.parametrize(
    "claim,source",
    [
        ("The Hazel container weighs 1 kg.", "The Hazel container weighs 1000 grams."),
        ("The Orchid cable spans 2 km.", "The Orchid cable spans 2000 meters."),
        ("The Fern session lasts 2 hours.", "The Fern session lasts 120 minutes."),
        ("The Thorn dose is 3 grams.", "The Thorn dose is 3000 milligrams."),
        ("Груз Лилия весит 2 килограмма.", "Груз Лилия весит 2000 граммов."),
        ("The Ash balance is -62 dollars.", "The Ash balance is negative 62 dollars."),
    ],
)
def test_supported_dimensional_conversions_do_not_require_revision(claim, source):
    result = review(claim, source)
    assert result["route"] == "human_review"
    assert result["verification"]["factuality_status"] == "not_assessed"


@pytest.mark.parametrize(
    "claim,source",
    [
        ("The Lotus crate weighs 72 kilograms.", "The Lotus crate weighs 72 grams."),
        ("The Lotus crate weighs 72 meters.", "The Lotus crate weighs 72 grams."),
        ("The Ash balance is positive 62 dollars.", "The Ash balance is negative 62 dollars."),
        ("The Oak session lasts 6 hours.", "The Oak session lasts 6 minutes."),
        (
            "The Olive branch employs 96 staff.",
            "The Olive branch employs 48 staff. The Hawthorn branch employs 96 staff.",
        ),
        (
            "The Olive branch employs 96 staff.",
            "The Olive branch employs 48 staff and the Hawthorn branch employs 96 staff.",
        ),
        ("The Olive branch employs 96 staff.", "The Hawthorn branch employs 96 staff."),
        (
            "The Olive branch employs 96 staff.",
            "The Olive branch employs 48 staff and uses 96 desks.",
        ),
    ],
)
def test_wrong_unit_sign_entity_or_attribute_requires_review(claim, source):
    result = review(claim, source)
    assert result["route"] == "revise"
    assert result["verification"]["claims"][0]["lexical_support"]["unmatched_numbers"]


def test_explicit_multiple_claims_keep_their_own_numeric_context():
    result = review(
        "The Olive branch employs 48 staff and the Hawthorn branch employs 96 staff.",
        "The Olive branch employs 48 staff. The Hawthorn branch employs 96 staff.",
    )
    assert result["route"] == "human_review"


def test_measurement_parser_does_not_steal_currency_scales():
    assert _numeric_fact_keys("-$5M") == _numeric_fact_keys("-5000000 USD")
    assert _numeric_fact_keys("5m USD") == _numeric_fact_keys("5000000 USD")
    assert _numeric_fact_keys("5 m") == _numeric_fact_keys("500 cm")
