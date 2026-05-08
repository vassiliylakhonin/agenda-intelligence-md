# Roadmap

Concrete next milestones, grounded in what's already shipped at v0.7.2.

## Shipped

- v0.5.x: schemas, validation CLI, source acquisition layer, lenses, AnalysisBank.
- v0.6.x: stdio MCP server (`agenda-intelligence-mcp`), MCP client configs.
- v0.7.x: brief scoring (heuristic 0–100), evidence-linked scoring,
  `doctor` command, MCP `score_output` tool, post-release smoke.
- v0.7.2 + repositioning: README rewritten as evidence/eval layer,
  experimental `evidence-audit.schema.json`, claim-level `audit-claims`
  CLI, `score --format json`, `score --min-score`, schema-sync test.

## v0.7.3 — eval-layer ergonomics

- `bench` command: run validate + audit + score across a directory
  of briefs, emit a Markdown / JSON report. No LLM dependency.
- `audit-claims --strict` (orphan refs → exit 1).
- `evals/run_benchmark.py` harness producing a reproducible
  self-contained baseline on bundled examples.
- Document a CI snippet that fails the build on schema drift,
  audit-claims warnings, or `score < threshold`.

## v0.8 — claim-level audit graduates from experimental

- Wire `evidence-audit.schema.json` into `validate-evidence` (opt-in
  via `--audit-claims` first; default behavior in a later step).
- MCP tool `audit_claims(claims_json)` alongside `validate_*`.
- Stabilize `claim_type` taxonomy based on real cases.
- First public benchmark run on 5–10 cases (see `docs/evaluation.md`).
  Numbers, not promises.

## v0.9 — verify-quotes (honest factuality slice)

- `evidence-pack` learns optional `quote` per source.
- `verify-quotes` command: local-text mode first (read text from
  `evidence_text/<id>.txt`, normalize, substring / embedding match),
  network mode behind an explicit `--fetch` flag.
- Honest scope: answers *"is the cited quote present in the source?"* —
  not *"is the claim true?"*.
- MCP tool `verify_quotes(...)`.

## v1.0 — stable contract

- Frozen JSON-schema versions for brief, evidence pack, evidence audit.
- Stable MCP tool names and signatures.
- `agent-manifest.json` documented as single source of truth for
  protocol, lenses, schemas, and source requirements.
- Benchmark suite with reproducible numbers across at least 20 cases.

## Explicit non-goals (today and likely v1.0)

- Live source crawling / news aggregation.
- Open-domain factuality verification.
- A monolithic agent framework. The package stays a small contract layer.
- Replacing analyst judgment.
