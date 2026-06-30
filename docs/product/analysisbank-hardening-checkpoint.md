# AnalysisBank hardening checkpoint

Date: 2026-06-30

AnalysisBank is now a guarded reasoning-memory layer, not a loose notes folder.
It stores reusable lessons from strong and weak analysis outputs so the runtime
can avoid known reasoning failures without treating memory as evidence.

## Scope boundary

AnalysisBank memories are reasoning guardrails. They are not source support,
factual verification, legal advice, compliance advice, sanctions screening, or
autonomous decision logic. A selected memory can change how the agent frames,
checks, or routes a file; it must not substitute for cited evidence.

## Before / after

| Area | Before | After |
|---|---|---|
| Storage | Markdown lessons existed, but lifecycle discipline depended mostly on human review. | Every card carries lifecycle metadata and is checked by `memory-lint`. |
| Packaging | Top-level cards could drift from the packaged runtime copy. | AnalysisBank files are mirrored under `src/agenda_intelligence/data/` and covered by package consistency tests. |
| Retrieval | Matching was mostly exact trigger discovery. | `memory-search` ranks active, unexpired lessons deterministically and retrieval fixtures pin expected top matches. |
| Over-application | A found lesson could be applied to the wrong task if the operator was careless. | `memory-applicability-bench` tests positive and negative task contexts against each card's `Apply when` / `Do not apply when` boundary. |
| Analyze runtime | The main `analyze` path did not use AnalysisBank. | `analyze` adds at most 3 lifecycle-filtered, retrieval-ranked, applicability-gated lessons to a bounded `REASONING MEMORY` prompt section. |
| Review trace | A memo reviewer could not see which memory cards shaped the output once the response envelope was gone. | Selected lessons are recorded in `audit.reasoning_memory` as reasoning guardrails, not evidence. |

## Runtime path

1. Build the task context from query, brief, region, sector, and detected claims.
2. Filter memories to active and unexpired cards by default.
3. Rank candidate cards by deterministic trigger coverage.
4. Run the applicability gate against each card's stated positive and negative
   boundaries.
5. Select at most 3 cards.
6. Add a compact `REASONING MEMORY` section to the `analyze` system prompt.
7. Record the same compact selection in `audit.reasoning_memory` for review.

## Operator checklist

Run this checklist whenever adding or materially editing an AnalysisBank card:

```bash
agenda-intelligence memory-lint
agenda-intelligence memory-search-bench tests/fixtures/analysis_bank_retrieval/manifest.json
agenda-intelligence memory-applicability-bench tests/fixtures/analysis_bank_applicability/manifest.json
python3 -m pytest tests/test_analysis_bank_lifecycle.py tests/test_product_shell.py -q
make ci PYTHON=python3
```

For every new card:

- add or update `analysis-bank/memory_index.json`;
- mirror the packaged copy under `src/agenda_intelligence/data/analysis-bank/`;
- include at least one retrieval fixture if the card introduces a new trigger
  family;
- include at least one negative applicability fixture if the card adds a broad
  or tempting lesson;
- set `stale_after_days`, `last_validated_at`, `confidence`, and
  `evidence_basis` deliberately;
- mark superseded or rejected cards inactive instead of silently deleting them
  when historical behavior matters.

## Quality gate

| Gate | What it prevents |
|---|---|
| `memory-lint` | stale cards, missing lifecycle metadata, malformed cards, duplicate IDs, index drift |
| retrieval bench | relevant lessons disappearing from top results or forbidden lessons ranking too high |
| applicability bench | broad lessons leaking into contexts where the card itself says not to apply |
| `test_product_shell` | regressions in `analyze` prompt composition and audit trace behavior |
| package consistency | top-level AnalysisBank docs diverging from the installed package copy |

## Stop rule

Do not add more AnalysisBank mechanics unless there is an observed failure:
retrieval miss, wrong-card application, stale-card leak, audit-trace gap, or a
reviewer unable to understand why a memo was framed the way it was. Otherwise
the next useful work is more golden examples and better negative fixtures, not
new runtime complexity.
