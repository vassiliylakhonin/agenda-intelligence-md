# v1.1.1 - AnalysisBank and confidential workflow hardening

v1.1.1 is a quality-gate patch release for the evidence-readiness runtime. It
does not add a new worker, buyer-facing surface, factual verification, legal or
compliance advice, sanctions screening, or autonomous decision logic.

## What changed

- Hardened AnalysisBank from loose reasoning-memory notes into a guarded
  runtime path:
  - lifecycle metadata linting via `memory-lint`;
  - packaged memory parity under `src/agenda_intelligence/data/`;
  - deterministic `memory-search` ranking;
  - retrieval regression fixtures via `memory-search-bench`;
  - applicability regression fixtures via `memory-applicability-bench`;
  - bounded `REASONING MEMORY` selection in `analyze`;
  - `audit.reasoning_memory` trace in memos.
- Added memo-quality regression coverage:
  - fixture manifest schema;
  - 5 golden memo fixtures and 8 schema-valid failure fixtures;
  - confidential project-room alias-leak guard;
  - CI smoke for `memo-quality-bench`.
- Added confidential weekly/status regression coverage:
  - new `weekly-delta-bench` CLI;
  - weekly-delta fixture manifest schema;
  - one alias-only committee-escalation golden fixture;
  - one named-project leak failure fixture;
  - CI smoke for `weekly-delta-bench`.
- Documented the AnalysisBank hardening checkpoint:
  - before/after state;
  - runtime path;
  - operator checklist;
  - quality gates;
  - stop rule for further memory mechanics.

## What did not change

- The project remains an evidence-readiness and trust-routing layer.
- No factual truth verification was added.
- No legal, compliance, sanctions, financial, investment, procurement, tax, or
  customs advice was added.
- No Cloudflare Worker deployment is part of this release.
- No commercial traction claim is made.

## Operator gate

Before editing AnalysisBank cards:

```bash
agenda-intelligence memory-lint
agenda-intelligence memory-search-bench tests/fixtures/analysis_bank_retrieval/manifest.json
agenda-intelligence memory-applicability-bench tests/fixtures/analysis_bank_applicability/manifest.json
```

Before accepting memo or confidential workflow changes:

```bash
agenda-intelligence memo-quality-bench tests/fixtures/memo_quality --format json
agenda-intelligence weekly-delta-bench tests/fixtures/weekly_delta --format json
make ci PYTHON=python3
```

## Release decision

The repository is ready for a `v1.1.1` tag only if PyPI publication is intended
or the tag-triggered release workflow is changed first. The current
`.github/workflows/release.yml` publishes to PyPI on any `v*` tag push.
