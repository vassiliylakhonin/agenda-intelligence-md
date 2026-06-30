# v1.1.0 - AnalysisBank hardening

v1.1.0 hardens AnalysisBank from a useful reasoning-memory folder into a
guarded runtime path for `analyze`.

## What changed

- Added lifecycle linting for AnalysisBank cards: required metadata, schema
  conformance, duplicate `lesson_id` detection, freshness checks, and
  `memory_index.json` sync.
- Packaged AnalysisBank docs and cards with the installed runtime so CLI and MCP
  behavior can rely on the same memory bank that is reviewed in the repo.
- Added deterministic retrieval ranking plus a retrieval bench for expected top
  lessons and forbidden top-N mistakes.
- Added an applicability bench for positive and negative task contexts against
  each card's `Apply when` / `Do not apply when` boundaries.
- Wired the guarded memory path into `analyze`: at most 3 active, unexpired,
  retrieval-ranked, applicability-gated lessons are added to a bounded
  `REASONING MEMORY` prompt section.
- Added `audit.reasoning_memory` so selected memory cards remain visible to a
  memo reviewer after the response envelope is removed.

## What did not change

- AnalysisBank is not factual memory, source storage, live retrieval, legal
  advice, compliance advice, sanctions screening, or autonomous decision logic.
- Memo schema changes are additive.
- Existing evidence-readiness boundaries remain unchanged: memory can shape
  reasoning discipline, but it cannot support factual claims.

## Operator gate

Before editing or adding memory cards, use the checkpoint:
[`docs/product/analysisbank-hardening-checkpoint.md`](../product/analysisbank-hardening-checkpoint.md).

```bash
agenda-intelligence memory-lint
agenda-intelligence memory-search-bench tests/fixtures/analysis_bank_retrieval/manifest.json
agenda-intelligence memory-applicability-bench tests/fixtures/analysis_bank_applicability/manifest.json
make ci PYTHON=python3
```
