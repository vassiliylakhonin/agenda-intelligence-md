"""Reproduce the full-analyze-trace artifacts in this directory.

Run from the repo root:

    python examples/product-shell/full-analyze-trace/run.py

The script calls ``agenda_intelligence.product.analyze`` against
``01-request.json`` and writes the deterministic product-shell outputs
to this directory. ``ANTHROPIC_API_KEY`` is deliberately unset so the
trace captures the skeleton-memo path: routing, system-prompt
assembly, and schema validation run identically; the LLM-completion
step is the host's responsibility and is documented in README.md.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from agenda_intelligence.product import analyze, render_memo_markdown

HERE = Path(__file__).resolve().parent


def main() -> None:
    os.environ.pop("ANTHROPIC_API_KEY", None)

    request = json.loads((HERE / "01-request.json").read_text())
    result = analyze(request)

    (HERE / "02-routing.json").write_text(
        json.dumps(
            {
                "valid_request": result["valid_request"],
                "modules_used": result["modules_used"],
                "system_prompt_chars": len(result["system_prompt"]),
            },
            indent=2,
        )
        + "\n"
    )

    memo = result["memo"]
    (HERE / "03-memo.json").write_text(json.dumps(memo, indent=2) + "\n")
    (HERE / "03-memo.md").write_text(render_memo_markdown(memo))

    (HERE / "04-validation.json").write_text(
        json.dumps(
            {
                "memo_valid": result["memo_valid"],
                "memo_errors": result["memo_errors"],
                "schema": "schemas/agenda-memo.schema.json",
            },
            indent=2,
        )
        + "\n"
    )

    (HERE / "05-audit.json").write_text(
        json.dumps(
            {
                "evidence_mode": memo["meta"]["evidence_mode"],
                "memo_audit_block": memo["audit"],
                "note": (
                    "For evidence_mode=reasoning_only there is no caller-supplied "
                    "evidence pack; claim-level audit (audit-claims CLI) applies to "
                    "source_backed and mixed modes. The memo schema's own audit field "
                    "is reproduced above as part of the trace."
                ),
            },
            indent=2,
        )
        + "\n"
    )

    (HERE / "06-score.json").write_text(
        json.dumps(
            {
                "applicable": False,
                "reason": (
                    "score CLI evaluates briefs against evidence packs. The analyze "
                    "skeleton memo is not a brief and carries no evidence pack. "
                    "Scoring of analyze memos against the rubric is a v0.9.x item "
                    "(see ROADMAP). For a runnable score example today see "
                    "examples/source-backed/eu-ai-act.brief.json."
                ),
            },
            indent=2,
        )
        + "\n"
    )

    print(f"Wrote artifacts to {HERE}")


if __name__ == "__main__":
    main()
