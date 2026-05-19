# v0.7.3 — Signal lifecycle, provenance tags, domain expansion

v0.7.3 adds signal-lifecycle tracking, surfaces per-claim provenance in generated Markdown output, expands the bundled case set, and tightens CI / packaging hygiene.

## Added — Signal lifecycle

- `docs/signal-lifecycle.md` reference and workflow.
- `schemas/signal-tracker.schema.json` for tracking observability signals across runs.

## Added — Provenance tags in output

- Per-claim inline provenance tags now appear in generated Markdown reports.
- Renders Axis-A source type (`[primary]`, `[secondary]`, `[user-provided]`, `[inference]`, `[analyst-judgment]`) and optional Axis-B action flags (`[verify]`, `[stale-risk: YYYY-MM]`) directly at the claim level.

## Added — Cases & lenses

- BIS AI Diffusion Rule flagship case study (`cases/bis-ai-diffusion`) with primary-source evidence.
- Gulf + Middle East added as the second vertical specialist in the Regional lenses set, alongside Central Asia + Caspian.

## Added — Evals

- Trust-layer evaluation parameters added to the human review checklist.

## Added — Docs & policy

- `AGENTS.md` and Claude Code working rules formalised in-repo.
- Release-artifact process documented.

## CI & packaging

- CI smoke-tests built package artifacts post-build.
- CI guard prevents tracked generated artifacts from re-entering the tree.
- `audit_claims` added to the MCP smoke run (full 8-tool wire-protocol coverage).
- Packaged data assets kept in sync with top-level sources via a test gate.

## Fixed

- README status block: stale MCP wording corrected.
- `cli.py`: flake8 E501 lint violation.

## Removed / cleaned

- Stale `experimental` labels removed from the README docs table.
- Generated package artifacts no longer tracked in the repo.
