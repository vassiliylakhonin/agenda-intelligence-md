"""Bounded direction/spelling diagnostics, including hard negative controls."""

from __future__ import annotations

import pytest

from agenda_intelligence.services import build_repair_prompt, check_evidence_packet
from agenda_intelligence.text_consistency import consistency_issues

BOUND = "lexical_support_bound_direction_mismatch"
GLYPH = "lexical_support_confusable_identifier"


@pytest.mark.parametrize(
    "claim,source",
    [
        ("The budget was at least 50 USD.", "The budget was at most 50 USD."),
        ("The budget was no less than 50 USD.", "The budget was no more than 50 USD."),
        ("Бюджет проекта не менее 50 USD.", "Бюджет проекта не более 50 USD."),
        ("Срок доставки не меньше 20 дней.", "Срок доставки не больше 20 дней."),
        ("The budget was at most -50 USD.", "The budget was at least -50 USD."),
        ("The budget was AT MOST 50 USD.", "The budget was at least 50 USD."),
    ],
)
def test_direction_swap_requires_review(claim, source):
    assert BOUND in consistency_issues(claim, [source])


@pytest.mark.parametrize(
    "claim,sources",
    [
        ("The budget was at most 50 USD.", ["The budget was at most 50 USD."]),
        ("The budget was no more than 50 USD.", ["The budget was at most 50 USD."]),
        ("Бюджет проекта не более 50 USD.", ["Бюджет проекта не больше 50 USD."]),
        ("The budget was at least 50 USD.", ["The budget was at least 50 USD.", "The budget was at most 50 USD."]),
        ("The budget was at most 50 USD.", ["The budget was at least 50 EUR."]),
        ("The budget was at most 50 USD.", ["The budget was at least 60 USD."]),
        ("The budget was at most 50 USD.", ["The office had at least 50 USD."]),
        ("The Coral branch budget was at most 50 USD.", ["The Amber branch budget was at least 50 USD."]),
        ("The budget was 50 USD.", ["The budget was at most 50 USD."]),
        ("Revenue increased by 50 USD.", ["Costs decreased by 50 USD."]),
    ],
)
def test_bound_equivalence_and_unrelated_contexts_do_not_add_direction_flag(claim, sources):
    assert BOUND not in consistency_issues(claim, sources)


def test_two_bound_clauses_cannot_hide_one_swapped_constraint():
    claim = "The budget was at most 50 USD; the shipment weighed at least 30 kg."
    source = "The budget was at most 50 USD; the shipment weighed at most 30 kg."
    assert BOUND in consistency_issues(claim, [source])


@pytest.mark.parametrize(
    "claim,source",
    [
        ("The Аtlas branch employs 50 staff.", "The Atlas branch employs 50 staff."),
        ("The Atlas branch employs 50 staff.", "The Аtlas branch employs 50 staff."),
        ("Отдел Альфa обработал 90 заявок.", "Отдел Альфа обработал 90 заявок."),
    ],
)
def test_distinct_confusable_identifier_requires_review_not_normalization(claim, source):
    assert GLYPH in consistency_issues(claim, [source])
    packet = {
        "claims": [{"claim_id": "c", "text": claim, "source_ids": ["s"]}],
        "sources": [{"source_id": "s", "text": source}],
    }
    result = check_evidence_packet(packet)
    assert result["valid"]
    assert result["response"]["packet_status"] == "source_review_required"
    assert GLYPH in result["response"]["claims"][0]["issues"]
    assert "Confusable Spelling" in build_repair_prompt(packet, result["response"])


@pytest.mark.parametrize(
    "text",
    [
        "The Аtlas branch employs 50 staff.",
        "Компания использует MCP и API в работе.",
        "The Moscow office uses RUB and USD.",
        "Отдел Альфа обработал 90 заявок.",
        "The company uses café data.",
    ],
)
def test_unchanged_and_separate_bilingual_words_are_not_homoglyph_conflicts(text):
    assert GLYPH not in consistency_issues(text, [text])


def test_nonconfusable_name_is_not_a_homoglyph_conflict():
    assert GLYPH not in consistency_issues("The Atlas branch.", ["The Coral branch."])


def test_new_diagnostics_propagate_through_rag_adapter():
    from agenda_intelligence import review_rag_answer

    result = review_rag_answer(
        "The budget was at least 50 USD. [s]", [{"source_id": "s", "text": "The budget was at most 50 USD."}]
    )
    assert result["route"] == "revise"
    assert BOUND in result["verification"]["claims"][0]["issues"]


def test_frozen_before_after_cases_and_counts_are_comparable():
    import hashlib
    import importlib.util
    import json
    from pathlib import Path

    root = Path(__file__).resolve().parents[1] / "evals" / "claim_checks"
    for name, before, after in [
        ("mutation_cases.json", "mutation_results.json", "mutation_results_after.json"),
        ("cases.json", "results.json", "results_after.json"),
    ]:
        digest = hashlib.sha256((root / name).read_bytes()).hexdigest()
        assert json.loads((root / before).read_text())["suite_sha256"] == digest
        assert json.loads((root / after).read_text())["suite_sha256"] == digest
    spec = importlib.util.spec_from_file_location("after_bench", root / "run.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    mutation = module.run(root / "mutation_cases.json", repeats=1)
    assert mutation["counts"] == {"caught": 16, "missed": 0, "false_positive": 0, "clear": 16}
    public = module.run(root / "cases.json", repeats=1)
    assert public["counts"] == {"caught": 6, "missed": 2, "false_positive": 2, "clear": 4}
