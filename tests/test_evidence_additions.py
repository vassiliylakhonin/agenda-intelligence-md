"""Additive coordinates and opt-in arithmetic regression contracts."""

from __future__ import annotations

import copy

import pytest

from agenda_intelligence import review_rag_answer
from agenda_intelligence.services import check_evidence_packet


def packet(operation="sum", value="30", operands=("10", "20"), unit="USD"):
    source = f"Revenue north {operands[0]} {unit}. Revenue south {operands[1]} {unit}."
    return {
        "derived_numbers": True,
        "claims": [
            {
                "claim_id": "c",
                "text": f"Revenue north and south total {value} {unit}.",
                "source_ids": ["s"],
                "derivations": [
                    {
                        "value": value,
                        "operation": operation,
                        "operands": [
                            {
                                "source_id": "s",
                                "quote": f"Revenue {region} {number} {unit}",
                                "value": number,
                                "unit": unit,
                            }
                            for region, number in zip(("north", "south"), operands)
                        ],
                    }
                ],
            }
        ],
        "sources": [{"source_id": "s", "text": source}],
    }


def checked(request):
    result = check_evidence_packet(request)
    assert result["valid"], result["errors"]
    return result["response"]["claims"][0]


@pytest.mark.parametrize(
    "operation,value,operands",
    [
        ("sum", "30", ("10", "20")),
        ("sum", "0.3", ("0.1", "0.2")),
        ("difference", "-10", ("10", "20")),
        ("percent_change", "50", ("20", "30")),
    ],
)
def test_explicit_arithmetic_exact_decimal(operation, value, operands):
    request = packet(operation, value, operands)
    if operation == "percent_change":
        request["claims"][0]["text"] = f"Revenue north and south changed by {value}%."
    original = copy.deepcopy(request)
    item = checked(request)
    assert item["derivation_checks"][0]["status"] == "arithmetic_consistent"
    assert item["lexical_support"]["unmatched_numbers"] == []
    assert request == original
    assert check_evidence_packet(request)["response"]["factuality_status"] == "not_assessed"


def test_disabled_is_default_and_does_not_clear_numeric_gap():
    request = packet()
    request.pop("derived_numbers")
    item = checked(request)
    assert item["derivation_checks"][0]["reason"] == "derived_numbers_disabled"
    assert item["lexical_support"]["unmatched_numbers"] == ["30"]
    assert item["packet_status"] != "packet_complete"


@pytest.mark.parametrize(
    "mutation,reason",
    [
        (lambda p: p["claims"][0]["derivations"][0].update(value="31"), "result_absent_from_claim"),
        (
            lambda p: p["claims"][0]["derivations"][0]["operands"][0].update(value="9"),
            "operand_value_or_unit_absent_from_quote",
        ),
        (lambda p: p["claims"][0]["derivations"][0]["operands"][0].update(unit="EUR"), "operand_units_differ"),
        (
            lambda p: p["claims"][0]["derivations"][0]["operands"][0].update(source_id="missing"),
            "operand_source_not_declared",
        ),
        (
            lambda p: p["claims"][0]["derivations"][0]["operands"][0].update(quote="fabricated 10 USD"),
            "operand_quote_not_verbatim",
        ),
    ],
)
def test_invalid_proof_never_discharges_number(mutation, reason):
    request = packet()
    mutation(request)
    item = checked(request)
    assert item["derivation_checks"][0]["status"] == "invalid"
    assert item["derivation_checks"][0]["reason"] == reason
    assert "invalid_derivation" in item["issues"]
    assert item["packet_status"] != "packet_complete"


def test_arithmetic_mismatch_and_zero_baseline():
    item = checked(packet(value="31"))
    assert item["derivation_checks"][0]["reason"] == "arithmetic_mismatch"
    request = packet("percent_change", "50", ("0", "20"))
    request["claims"][0]["text"] = "Revenue changed by 50%."
    assert checked(request)["derivation_checks"][0]["reason"] == "zero_percent_baseline"


def test_repeating_percent_is_not_rounded_implicitly():
    request = packet("percent_change", "33.33", ("3", "4"))
    request["claims"][0]["text"] = "Revenue changed by 33.33%."
    assert checked(request)["derivation_checks"][0]["reason"] == "arithmetic_mismatch"


def test_existing_packet_unchanged_without_proofs():
    request = packet()
    request["claims"][0].pop("derivations")
    first = checked(request)
    request.pop("derived_numbers")
    assert checked(request) == first
    assert first["lexical_support"]["unmatched_numbers"] == ["30"]


def test_polarity_is_not_bypassed_by_arithmetic():
    request = packet()
    request["sources"][0]["text"] += " Revenue north and south total was not confirmed."
    item = checked(request)
    assert item["packet_status"] != "packet_complete"


def test_unicode_quote_coordinates_slice_original_source():
    source = "😀 Заголовок\r\nСовет одобрил проект.\nСовет одобрил проект."
    quote = "Совет одобрил проект."
    request = {
        "claims": [
            {"claim_id": "c", "text": quote, "source_ids": ["s"], "quotes": [{"source_id": "s", "text": quote}]}
        ],
        "sources": [{"source_id": "s", "text": source}],
    }
    item = checked(request)
    q = item["quote_checks"][0]
    assert source[q["start_char"] : q["end_char"]] == quote
    assert q["start_char"] == source.index(quote)  # first exact occurrence
    lexical = item["lexical_support"]
    assert source[lexical["start_char"] : lexical["end_char"]] in source


def test_normalized_quote_does_not_invent_raw_coordinates():
    request = {
        "claims": [
            {
                "claim_id": "c",
                "text": "The board approved it.",
                "source_ids": ["s"],
                "quotes": [{"source_id": "s", "text": "THE BOARD APPROVED IT."}],
            }
        ],
        "sources": [{"source_id": "s", "text": "The board approved it."}],
    }
    q = checked(request)["quote_checks"][0]
    assert q["status"] == "present"
    assert "start_char" not in q and "end_char" not in q


def test_answer_offsets_preserve_codepoints_and_old_aliases():
    answer = "😀 Ответ [s]\r\n\r\n  Вывод [s]  \n"
    result = review_rag_answer(answer, [{"source_id": "s", "text": "Ответ. Вывод."}])
    for unit in result["answer_units"]:
        assert answer[unit["start_char"] : unit["end_char"]] == unit["text"]
        assert (unit["start"], unit["end"]) == (unit["start_char"], unit["end_char"])


def test_same_result_display_with_different_currency_stays_unmatched():
    request = packet()
    request["claims"][0]["text"] = "Revenue north and south total 30 USD and 30 EUR."
    item = checked(request)
    assert "30" in item["lexical_support"]["unmatched_numbers"]


def test_operand_cannot_borrow_value_from_different_currency_in_quote():
    request = packet()
    source = "Revenue north 10 EUR, 20 USD. Revenue south 20 USD."
    request["sources"][0]["text"] = source
    request["claims"][0]["derivations"][0]["operands"][0]["quote"] = "Revenue north 10 EUR, 20 USD"
    item = checked(request)
    assert item["derivation_checks"][0]["status"] == "invalid"


def test_operand_number_can_end_quote_without_trailing_unit():
    request = packet()
    request["sources"][0]["text"] = "USD revenue north 10. USD revenue south 20."
    for operand, region, value in zip(
        request["claims"][0]["derivations"][0]["operands"], ("north", "south"), ("10", "20")
    ):
        operand["quote"] = f"USD revenue {region} {value}"
    # A leading unit is conservative, not inferred by the existing numeric parser.
    assert checked(request)["derivation_checks"][0]["status"] == "invalid"
