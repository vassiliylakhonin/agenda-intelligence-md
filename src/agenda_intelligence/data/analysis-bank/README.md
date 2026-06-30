# AnalysisBank

AnalysisBank is the ReasoningBank-inspired layer for Agenda-Intelligence.md.

It stores compact reasoning memories from good and bad agenda-analysis outputs so agents can improve across tasks.

## What to store

Store lessons like:

- a failure pattern that caused a weak analysis;
- a success pattern that made an output decision-useful;
- a boundary condition that prevents overconfident signal classification;
- a concrete watch-next indicator set that generalizes.

Do not store:

- raw private conversations;
- stale facts;
- source dumps;
- full chain-of-thought;
- legal conclusions.

## Retrieval rule

Before a high-stakes or ambiguous agenda-analysis task:

1. Identify domain and region.
2. Search AnalysisBank by trigger terms.
3. Load at most 3 relevant memory cards.
4. Check lifecycle metadata.
5. Apply only if the lesson is `active`, not past `stale_after_days`, and the boundary conditions match.
6. Prefer memories that prevent known failure modes.

Stale, superseded, or rejected lessons can be used as historical context, but
not as support for a recommendation unless they are revalidated first.

The packaged CLI enforces this by default:

```bash
agenda-intelligence memory-search sanctions
```

Use `--include-inactive` only when auditing old lessons, not when selecting
support for a recommendation.

## Update rule

After a useful or failed analysis:

1. Decide whether the lesson is generalizable.
2. Add one memory card if it will improve future outputs.
3. Put failures in `failures/` and successes in `successes/`.
4. Set lifecycle fields: `lesson_id`, `version`, `status`, `created_at`,
   `last_validated_at`, `stale_after_days`, `supersedes`, `confidence`, and
   `evidence_basis`.
5. Keep the card short and retrieval-friendly.

Before committing AnalysisBank edits, run:

```bash
agenda-intelligence memory-lint
```

The lint checks required sections, lifecycle freshness, schema validity,
duplicate `lesson_id` values, and `memory_index.json` sync.

## Retrieval quality bench

AnalysisBank retrieval is deterministic keyword ranking, not semantic search or
factual verification. The fixture bench checks whether representative queries
route to the right reusable reasoning memory:

```bash
agenda-intelligence memory-search-bench tests/fixtures/analysis_bank_retrieval/manifest.json
```

Each case declares the expected top lesson, any lessons that must appear within
top-N, and lessons that must not appear within top-N. Use it when adding or
rewriting memory cards so retrieval quality does not drift.

## Applicability guard

Retrieval alone is not enough: a lesson can be found and still be wrong for the
task. The applicability bench checks representative positive and negative
contexts against each card's `Apply when` and `Do not apply when` sections:

```bash
agenda-intelligence memory-applicability-bench tests/fixtures/analysis_bank_applicability/manifest.json
```

This is a deterministic guard against obvious over-application. It does not
replace human judgment; it only catches cases where a card's own boundary
conditions would be ignored.

## Hardening checkpoint

The current release/ops checkpoint is
`docs/product/analysisbank-hardening-checkpoint.md`.
Use it before adding new memory mechanics or editing broad lessons. It records
the before/after state, runtime path, operator checklist, quality gates, and
stop rule for AnalysisBank changes.

## Current memory cards

Failures:

- `failures/vague-monitoring.md`
- `failures/overconfident-sanctions-upgrade.md`
- `failures/eu-rhetoric-treated-as-law.md`

Successes:

- `successes/sanctions-routing-signal-classification.md`
