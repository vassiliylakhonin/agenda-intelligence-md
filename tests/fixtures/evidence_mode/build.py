"""Regenerate evidence-mode discipline fixtures.

Run from the repo root:

    python tests/fixtures/evidence_mode/build.py

Produces six schema-valid agenda-memo fixtures under ``golden/`` and
``failure/``. Each varies only ``meta.evidence_mode`` and
``audit.provenance``; everything else is held constant so the
discipline check is the only thing under test. The fixtures stay in
sync with ``agenda-memo.schema.json`` because they are derived from
one canonical baseline rather than authored by hand.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

BASELINE = {
    "meta": {
        "evidence_mode": "reasoning_only",
        "confidence": "medium",
        "geography": "Kazakhstan",
        "depth": "decision_pack",
        "modules_used": [
            {"module": "global-think-tank-analyst", "role": "reasoning_method"},
            {"module": "central-asia-caspian", "role": "regional_specialist"},
        ],
        "timestamp": "2026-05-22T00:00:00Z",
        "gtta_version": "0.9.x",
    },
    "risk_summary": {
        "short": "Illustrative fixture memo for evidence-mode discipline tests.",
        "detailed": (
            "Illustrative content. This memo exists only to exercise the "
            "evidence-mode discipline check; no factual claim is asserted "
            "by the fixture set itself."
        ),
    },
    "analysis": {
        "facts": ["Illustrative fact entry."],
        "assessments": ["Illustrative assessment entry."],
        "assumptions": ["Illustrative assumption entry."],
        "unknowns": ["Illustrative unknown entry."],
    },
    "watch_next": [{"indicator": "Illustrative indicator."}],
    "audit": {
        "validation_score": 0.5,
        "provenance": [],
    },
}


def _memo(mode: str, provenance: list[dict]) -> dict:
    memo = copy.deepcopy(BASELINE)
    memo["meta"]["evidence_mode"] = mode
    memo["audit"]["provenance"] = provenance
    return memo


def _write(path: Path, memo: dict) -> None:
    path.write_text(json.dumps(memo, indent=2) + "\n")


def main() -> None:
    golden = HERE / "golden"
    failure = HERE / "failure"
    golden.mkdir(exist_ok=True)
    failure.mkdir(exist_ok=True)

    _write(
        golden / "reasoning-only-clean.json",
        _memo(
            "reasoning_only",
            [
                {"claim": "Local-bank de-risking is likely to continue.", "basis": "assessment"},
                {"claim": "OFAC priorities for FY2026 are unclear.", "basis": "unknown"},
            ],
        ),
    )

    _write(
        golden / "user-provided-fact-with-source.json",
        _memo(
            "user_provided",
            [
                {
                    "claim": "OFAC issued a Central Asia secondary-sanctions advisory in 2024.",
                    "basis": "fact",
                    "source": "OFAC advisory 2024-03 (caller-supplied)",
                },
                {"claim": "Local-bank de-risking is likely to continue.", "basis": "assessment"},
            ],
        ),
    )

    _write(
        golden / "mixed-fact-with-verify-marker.json",
        _memo(
            "mixed",
            [
                {
                    "claim": "OFAC issued a Central Asia secondary-sanctions advisory in 2024.",
                    "basis": "fact",
                    "source": "OFAC advisory 2024-03 (caller-supplied)",
                },
                {
                    "claim": "A second-tier Kazakh bank lost its USD correspondent in 2025 [verify]",
                    "basis": "fact",
                },
                {"claim": "Local-bank de-risking is likely to continue.", "basis": "assessment"},
            ],
        ),
    )

    _write(
        failure / "reasoning-only-with-source.json",
        _memo(
            "reasoning_only",
            [
                {
                    "claim": "OFAC issued a Central Asia secondary-sanctions advisory in 2024.",
                    "basis": "fact",
                    "source": "OFAC advisory 2024-03",
                },
            ],
        ),
    )

    _write(
        failure / "user-provided-fact-no-source.json",
        _memo(
            "user_provided",
            [
                {
                    "claim": "A second-tier Kazakh bank lost its USD correspondent in 2025.",
                    "basis": "fact",
                },
            ],
        ),
    )

    _write(
        failure / "mixed-fact-bare.json",
        _memo(
            "mixed",
            [
                {
                    "claim": "Iran-linked vessel SHAHRAZAD was added to OFAC SDN list in 2025.",
                    "basis": "fact",
                },
            ],
        ),
    )

    # Extension to 5+5 — sanctions / vessel / regulatory determinative-claim
    # discipline. Same post-hoc rule (basis=fact must carry source or
    # [verify] in user_provided/mixed); these fixtures exercise the rule
    # across the three domains explicitly named in ROADMAP v0.9 §4.
    _write(
        golden / "mixed-vessel-with-source.json",
        _memo(
            "mixed",
            [
                {
                    "claim": "IMO 9123456 ASTRA STAR was added to OFAC SDN list in 2025.",
                    "basis": "fact",
                    "source": "OFAC SDN list update 2025-04-12 (caller-supplied)",
                },
                {"claim": "Dark-fleet activity around Hormuz remains elevated.", "basis": "assessment"},
            ],
        ),
    )

    _write(
        golden / "user-provided-regulatory-with-verify.json",
        _memo(
            "user_provided",
            [
                {
                    "claim": "EU CBAM definitive period transitional reporting deadline is 2026-01-31 [verify]",
                    "basis": "fact",
                },
                {"claim": "Affected importers will face higher compliance load.", "basis": "assessment"},
            ],
        ),
    )

    _write(
        failure / "user-provided-sanctions-bare.json",
        _memo(
            "user_provided",
            [
                {
                    "claim": "OFAC added BANK ALPHA to the SDN list under Executive Order 14024 in March 2025.",
                    "basis": "fact",
                },
            ],
        ),
    )

    _write(
        failure / "mixed-regulatory-bare.json",
        _memo(
            "mixed",
            [
                {
                    "claim": "EU AI Act high-risk obligations enter into force on 2026-08-02.",
                    "basis": "fact",
                },
            ],
        ),
    )

    print(f"Wrote fixtures under {HERE}")


if __name__ == "__main__":
    main()
