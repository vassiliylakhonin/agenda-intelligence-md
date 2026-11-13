#!/usr/bin/env python3
"""Generate frozen synthetic mutations and unchanged paired controls.

Every mutation has a predeclared target span. We never infer a ground-truth
label by checking whether the linter catches it, and we do not repair its rules.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent

# (id, type, source/clean claim, old span, replacement). These are fictional
# assertions. Inequality direction changes constraint meaning, not necessarily
# logical contradiction. Homoglyph strings are deliberately distinct identifiers.
SEEDS = [
    ("sign-usd", "sign_flip", "The project balance was -50 USD.", "-50", "+50"),
    ("sign-decimal", "sign_flip", "The temperature was -12.5 degrees.", "-12.5", "+12.5"),
    ("sign-ru", "sign_flip", "Баланс проекта составил -70 USD.", "-70", "+70"),
    ("sign-percent", "sign_flip", "Revenue growth was -15%.", "-15", "+15"),
    ("bound-en", "bound_direction", "The project budget was no more than 50 USD.", "no more", "no less"),
    ("bound-en-most", "bound_direction", "The shipment weighed at most 30 kg.", "at most", "at least"),
    ("bound-ru", "bound_direction", "Бюджет проекта не более 50 USD.", "не более", "не менее"),
    ("bound-ru-max", "bound_direction", "Срок доставки не больше 20 дней.", "не больше", "не меньше"),
    ("digits-year", "digit_transposition", "The factory opened in 1984.", "1984", "1948"),
    ("digits-budget", "digit_transposition", "The project budget was 1250 USD.", "1250", "1520"),
    ("digits-ru", "digit_transposition", "Завод открыт в 1976 году.", "1976", "1967"),
    ("digits-volume", "digit_transposition", "The shipment contained 243 tonnes.", "243", "234"),
    ("glyph-latin-a", "homoglyph", "The Atlas branch employs 50 staff.", "Atlas", "Аtlas"),
    ("glyph-latin-o", "homoglyph", "The Coral branch employs 20 staff.", "Coral", "Cоral"),
    ("glyph-cyrillic-o", "homoglyph", "Отдел Орион обработал 70 заявок.", "Орион", "Ориoн"),
    ("glyph-cyrillic-a", "homoglyph", "Отдел Альфа обработал 90 заявок.", "Альфа", "Альфa"),
]


def generate() -> dict:
    cases = []
    for seed_id, mutation_type, text, before, after in SEEDS:
        if text.count(before) != 1 or before == after:
            raise ValueError(f"Ambiguous mutation seed: {seed_id}")
        start = text.index(before)
        changed = text[:start] + after + text[start + len(before) :]
        for mutant in (False, True):
            claim = changed if mutant else text
            cases.append(
                {
                    "id": seed_id + ("-mutant" if mutant else "-control"),
                    "kind": "synthetic_mutation" if mutant else "synthetic_control",
                    "mutation_type": mutation_type,
                    "seed_id": seed_id,
                    "expect_flag": mutant,
                    "annotation": (
                        "Changed source assertion requires review."
                        if mutant
                        else "Unchanged assertion is supported by its identical supplied source."
                    ),
                    "mutation": (
                        {"start_char": start, "end_char": start + len(before), "before": before, "after": after}
                        if mutant
                        else None
                    ),
                    "packet": {
                        "claims": [{"claim_id": "c", "text": claim, "source_ids": ["s"]}],
                        "sources": [{"source_id": "s", "text": text}],
                    },
                }
            )
    return {
        "description": "Entirely synthetic, hand-labelled mutation probes with paired unchanged controls. Deterministic declared edits, no random generation or factuality claim.",
        "label_policy": "A mutation changes a sign, bound direction, digit order or exact Unicode identifier. It needs review against the unchanged source. These are not natural error frequencies. Bounds can overlap at equality; this tests altered constraints, not universal contradiction.",
        "cases": cases,
    }


def summarize(report: dict, suite: dict) -> dict:
    metadata = {case["id"]: case for case in suite["cases"]}
    groups = {}
    for result in report["results"]:
        mutation_type = metadata[result["id"]]["mutation_type"]
        counts = groups.setdefault(mutation_type, {"tp": 0, "fn": 0, "fp": 0, "tn": 0})
        key = {"caught": "tp", "missed": "fn", "false_positive": "fp", "clear": "tn"}[result["category"]]
        counts[key] += 1
    for counts in groups.values():
        counts["recall"] = counts["tp"] / (counts["tp"] + counts["fn"]) if counts["tp"] + counts["fn"] else None
        counts["precision"] = counts["tp"] / (counts["tp"] + counts["fp"]) if counts["tp"] + counts["fp"] else None
    report["per_mutation_type"] = groups
    report["metric_scope"] = (
        "Recall uses four altered claims per type. Precision uses flagged mutants and their four paired identical controls only; null means no positive predictions. Not production precision or general accuracy."
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if the checked-in generated cases drift.")
    parser.add_argument("--out", type=Path, help="Run full local diagnostics and write a timing/metrics report.")
    parser.add_argument("--repeats", type=int, default=25)
    args = parser.parse_args()
    suite = generate()
    text = json.dumps(suite, ensure_ascii=False, indent=2) + "\n"
    cases_path = HERE / "mutation_cases.json"
    if args.check:
        if not cases_path.exists() or cases_path.read_text() != text:
            raise SystemExit("Generated mutation cases are stale; run evals/claim_checks/mutations.py")
    else:
        cases_path.write_text(text)
    if args.out:
        spec = importlib.util.spec_from_file_location("claim_diagnostics", HERE / "run.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        report = summarize(module.run(cases_path, args.repeats), suite)
        args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(report["per_mutation_type"], indent=2))


if __name__ == "__main__":
    main()
