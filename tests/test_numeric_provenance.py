"""Bounded formatting, arithmetic certificates and table intersection controls."""

import copy

import pytest

from agenda_intelligence.evidence_review import read_document_text
from agenda_intelligence.grounding import GroundingIndex, _numeric_fact_keys
from agenda_intelligence.services import check_evidence_packet


@pytest.mark.parametrize(
    "left,right",
    [
        ("$1.5M", "1 500 000 USD"),
        ("1,500,000.00 USD", "1.500.000,00 USD"),
        ("1\u202f500\u00a0000 USD", "$1500000"),
        ("50%", "0.5"),
        ("1 500 000,00 USD", "$1.5M"),
        ("1.500.000 USD", "$1.5M"),
        ("50 percent", "0,5"),
        ("Q3 2026", "third quarter 2026"),
        ("2026-Q3", "третий квартал 2026 года"),
        ("3rd quarter 2026", "3 квартал 2026"),
    ],
)
def test_normalized_equivalents(left, right):
    assert _numeric_fact_keys(left) == _numeric_fact_keys(right)


@pytest.mark.parametrize(
    "left,right",
    [
        ("50%", "50"),
        ("50%", "0.5 USD"),
        ("$1.5M", "1.5M EUR"),
        ("Q3 2026", "Q2 2026"),
        ("Q3 2026", "Q3 2025"),
        ("1.5 kg", "1.5 grams"),
    ],
)
def test_not_equivalent(left, right):
    assert _numeric_fact_keys(left) != _numeric_fact_keys(right)


def proof(operation, target, values=("100", "120"), unit="USD", result_unit=None):
    request = {
        "derived_numbers": True,
        "claims": [
            {
                "claim_id": "c",
                "text": f"Revenue result {target} {unit}.",
                "source_ids": ["s"],
                "derivations": [
                    {
                        "operation": operation,
                        "value": target,
                        "operands": [
                            {"source_id": "s", "quote": f"Revenue {value} {unit}", "value": value, "unit": unit}
                            for value in values
                        ],
                    }
                ],
            }
        ],
        "sources": [{"source_id": "s", "text": ". ".join(f"Revenue {value} {unit}" for value in values)}],
    }
    if operation in ("percent", "percent_change"):
        request["claims"][0]["text"] = f"Revenue result {target}%."
    if result_unit:
        request["claims"][0]["derivations"][0]["result_unit"] = result_unit
        request["claims"][0]["text"] = f"Revenue result {target} {result_unit}."
    return request


def checked(request):
    result = check_evidence_packet(request)
    assert result["valid"], result["errors"]
    return result["response"]["claims"][0]


@pytest.mark.parametrize(
    "operation,target,values,result_unit",
    [
        ("sum", "220", ("100", "120"), None),
        ("difference", "20", ("120", "100"), None),
        ("product", "12000", ("100", "120"), "USD*USD"),
        ("quotient", "0.5", ("50", "100"), "ratio"),
        ("percent", "20", ("20", "100"), None),
        ("percent_change", "20", ("100", "120"), None),
    ],
)
def test_exact_proofs_have_marker_and_formula(operation, target, values, result_unit):
    request = proof(operation, target, values, result_unit=result_unit)
    original = copy.deepcopy(request)
    check = checked(request)["derivation_checks"][0]
    assert check["derived_verified"] is True
    assert check["formula"].endswith(" = " + target)
    assert request == original
    assert check_evidence_packet(request)["response"]["factuality_status"] == "not_assessed"


@pytest.mark.parametrize(
    "operation,target,values,result_unit",
    [
        ("sum", "221", ("100", "120"), None),
        ("quotient", "2", ("100", "0"), "ratio"),
        ("quotient", "0.3333", ("1", "3"), "ratio"),
        ("percent_change", "20", ("0", "120"), None),
        ("product", "12000", ("100", "120"), "USD"),
    ],
)
def test_invalid_never_has_verified_marker_or_formula(operation, target, values, result_unit):
    item = checked(proof(operation, target, values, result_unit=result_unit))
    check = item["derivation_checks"][0]
    assert check["status"] == "invalid"
    assert "derived_verified" not in check
    assert "formula" not in check
    assert item["lexical_support"]["unmatched_numbers"]


def test_formatted_operand_and_result_are_normalized_but_quotes_remain_exact():
    request = proof("sum", "2000000", ("1500000", "500000"))
    request["sources"][0]["text"] = "Revenue $1.5M. Revenue $0.5M."
    for operand, quote in zip(request["claims"][0]["derivations"][0]["operands"], ("Revenue $1.5M", "Revenue $0.5M")):
        operand["quote"] = quote
    request["claims"][0]["text"] = "Revenue result $2M."
    item = checked(request)
    assert item["derivation_checks"][0]["derived_verified"]
    assert item["lexical_support"]["unmatched_numbers"] == []
    request["claims"][0]["derivations"][0]["operands"][0]["quote"] = "Revenue $9M"
    assert "derived_verified" not in checked(request)["derivation_checks"][0]


TABLES = [
    "| Company | 2024 | 2025 |\n| --- | --- | --- |\n| Company A | 100 | 500 |\n| Company B | 500 | 900 |",
    "Company,2024,2025\nCompany A,100,500\nCompany B,500,900\n",
]


@pytest.mark.parametrize("source", TABLES)
@pytest.mark.parametrize(
    "claim,bad",
    [
        ("Company A revenue in 2025 was 500.", False),
        ("Company A revenue in 2024 was 500.", True),
        ("Company B revenue in 2025 was 500.", True),
    ],
)
def test_named_intersection_not_neighbor(source, claim, bad):
    result = check_evidence_packet(
        {
            "claims": [{"claim_id": "c", "text": claim, "source_ids": ["s"]}],
            "sources": [{"source_id": "s", "text": source}],
        }
    )
    assert result["valid"]
    item = result["response"]["claims"][0]
    check = item["lexical_support"]["table_checks"][0]
    assert check["source_id"] == "s"
    assert check["status"] == ("mismatch" if bad else "cell_consistent")
    assert bool(item["lexical_support"]["unmatched_numbers"]) == bad


@pytest.mark.parametrize("raw", [False, True])
def test_empty_cells_not_shifted_and_quoted_csv_label(tmp_path, raw):
    source = 'Company,2024,2025\n"Company A, Ltd",,500\nCompany B,500,900\n'
    if not raw:
        path = tmp_path / "source.csv"
        path.write_text(source)
        source = read_document_text(path)
    wrong = GroundingIndex({"s": source}).match("Company A, Ltd revenue in 2024 was 500.")
    assert "500" in wrong.unmatched_numbers
    assert wrong.table_checks[0]["cell"] == ""
    right = GroundingIndex({"s": source}).match("Company A, Ltd revenue in 2025 was 500.")
    assert right.unmatched_numbers == ()


def test_no_provenance_claim_for_unlabelled_or_ragged_table():
    assert not GroundingIndex({"s": TABLES[1]}).match("Revenue was 500.").table_checks
    assert (
        not GroundingIndex({"s": "Company,2024,2025\nCompany A,100\n"})
        .match("Company A revenue in 2025 was 100.")
        .table_checks
    )


def test_arithmetic_cannot_clear_wrong_table_intersection():
    request = proof("sum", "500", ("100", "400"))
    request["sources"][0]["text"] += "\n" + TABLES[0]
    request["claims"][0]["text"] = "Company A revenue in 2024 was 500 USD."
    item = checked(request)
    assert item["lexical_support"]["unmatched_numbers"]


def test_year_row_label_and_named_metric_column():
    source = "Year,Revenue,Growth\n2025,$100M,15%\n2026,$150M,50%"
    match = GroundingIndex({"s": source}).match("Revenue in 2025 was $100M.")
    assert match.unmatched_numbers == ()
    assert match.table_checks[0]["cell"] == "$100M"
    wrong = GroundingIndex({"s": source}).match("Revenue in 2025 was $150M.")
    assert wrong.unmatched_numbers


def test_conflicting_cells_and_sources_remain_review_findings():
    index = GroundingIndex({"s1": TABLES[1], "s2": TABLES[1].replace("Company A,100,500", "Company A,100,600")})
    match = index.match("Company A revenue in 2025 was 500.")
    assert match.unmatched_numbers
    assert {check["status"] for check in match.table_checks} == {"cell_consistent", "mismatch"}


def test_large_operands_do_not_match_after_decimal_rounding():
    a = "1234567890123456789012345678901234567890"
    request = proof("sum", str(int(a) + 1), (a, "1"))
    assert checked(request)["derivation_checks"][0]["derived_verified"]
    operand = request["claims"][0]["derivations"][0]["operands"][0]
    operand["quote"] = "Revenue " + str(int(a) + 1) + " USD"
    request["sources"][0]["text"] = operand["quote"] + ". Revenue 1 USD"
    assert "derived_verified" not in checked(request)["derivation_checks"][0]


def test_quarter_key_not_exposed_as_literal_discovery_word():
    from agenda_intelligence.discovery import claim_patterns

    assert all(not pattern["literal"].startswith("numquarter-") for pattern in claim_patterns("Revenue Q3 2026"))
