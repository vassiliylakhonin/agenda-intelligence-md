# Roadmap

Concrete milestones, grounded in what is actually shipped. Status is verified against the codebase, not the original plan.

## Shipped

### v0.5.x
Schemas, validation CLI, source planning layer, lenses, AnalysisBank.

### v0.6.x
stdio MCP server (`agenda-intelligence-mcp`), MCP client configs.

### v0.7.x
Brief scoring (heuristic 0–100), evidence-linked scoring, `doctor` command,
MCP `score_output` tool, post-release smoke.

### v0.7.2 — evidence & eval layer
- Project repositioned as evidence and eval layer for strategic intelligence agents.
- `audit-claims` CLI: validates claim-level evidence-audit JSON; `--strict` exits non-zero on orphan refs.
- `bench` CLI: runs validate + audit + score across a directory of cases, emits Markdown or JSON report. No LLM dependency.
- `verify-quotes` CLI: local-text mode — verifies presence of cited fragments in source text files.
- `score --format json` and `score --min-score N`.
- `evidence-audit.schema.json`: claim-level evidence audit (`claim_id`, `claim_type`, `evidence_ids`, `support_level`, `uncertainty`, `risk_if_wrong`).
- `audit_claims` MCP tool (9th tool): validates claim-level audit JSON via wire protocol.
- `evals/run_benchmark.py` + committed baseline (`evals/baselines/source-backed.{md,json}`).
- `.github/workflows/bench.yml` CI bench gate (`--strict --min-score 80`) with baseline drift check.
- Three flagship source-backed example sets: `eu-ai-act`, `red-sea-shipping`, `sanctions-routing`.

### v0.7.2 patch — verify-quotes stable + schema versioning
- `verify-quotes --fetch`: sources without a local text file are fetched over HTTP (stdlib only, 1 MB cap, 10 s timeout, HTML stripped). `--strict` now also exits non-zero on `fetch_error`.
- `verify-quotes` also checks `quote_or_excerpt` field as fallback for `quote`.
- `verify_quotes` MCP tool (10th tool): caller-supplied `texts` dict, no outbound requests from MCP layer.
- `x-schema-version: "1"` added to all six schemas (stable contract marker).
- `evidence-audit.schema.json`: removed "EXPERIMENTAL" label; schema is now stable.
- `agent-manifest.json` schemas section now includes `evidence_audit`.
- All "experimental" labels removed from CLI help, MCP descriptions, and server module.

### v0.7.3 — signal lifecycle, provenance tags, domain expansion
- `signal-tracker.schema.json` (7th schema): signal lifecycle tracker — status, evidence mode, actor, trigger, confidence, expiry, cross-references.
- `skills/agenda-intelligence/references/signal-lifecycle.md`: signal lifecycle reference for agents.
- Per-claim inline provenance tags in markdown output: `[primary]`, `[secondary]`, `[user-provided]`, `[inference]`, `[analyst-judgment]` + `[verify]` / `[stale-risk: YYYY-MM]` action flags.
- Trust-layer eval parameters added to human review checklist.
- `AGENTS.md`: project-level agent instructions and working rules.
- Gulf + Middle East added as second vertical specialist in Regional lenses (alongside Central Asia + Caspian).
- BIS AI Diffusion Rule live-source-backed case study (`examples/bis-ai-diffusion-rule/`).
- `agent-manifest.json` and `llms.txt` updated: signal-tracker schema and signal-lifecycle protocol registered.
- Packaged data assets (`src/agenda_intelligence/data/`) synced to top-level sources.
- CI: generated artifacts no longer tracked; package build smoke-test added.

## v0.8 — benchmark depth

- Expand benchmark beyond the current 20 source-structured cases with more domains and adversarial cases.
- Keep public benchmark numbers in `docs/evaluation.md` aligned with committed baselines.
- Continue stabilizing `claim_type` taxonomy from real case patterns.

## v0.9 — agent-eval delta and product-shell narrative alignment

Structural validation of the product shell from the agent-integrator perspective. No factual verification, no live retrieval, no new schemas.

- **Agent-Eval Delta** introduced as a per-case structural check: how the agent's output shape changes when Agenda Intelligence is wired in versus baseline. Not factual accuracy. Not model-quality comparison. Not aggregate benchmark.
- Three agent-eval cases scaffolded, one per important surface — global GTTA (one full case end-to-end), CA+Caspian + sanctions (stub), Gulf+ME (stub).
- `docs/agent-eval-methodology.md` tightened: live-source-backed skill examples map to `user_provided` or `mixed` for `analyze`. Live retrieval is upstream of Agenda Intelligence, not a feature of it.
- Narrative alignment across `README.md`, `ADOPTION.md`, `MCP.md`, `llms.txt`, `CONTEXT.md` around "MCP product shell over validation layer". Drop framings that imply live retrieval or factual benchmarking.
- ADR `0008-agent-eval-delta-is-structural-product-validation.md` records the validation-story decision: agent-eval delta is the product-shell validation surface for agent integrators; practitioner review remains optional and audience-gated.

Non-goals for v0.9: factual verification schema, source reputation scoring, live news gathering, crawler, `deep_dive` implementation, new MCP tools.

## v0.9.x — deferred verify-quotes patches

Previously planned as v0.9. Deferred because v0.9 narrative is product-shell validation, not retrieval. These remain optional patches on top of the existing `verify-quotes --fetch` network mode and do not change the v1.0 contract.

- Smarter HTML-to-text extraction (currently basic `html.parser` strip).
- Respect `robots.txt` / add configurable rate limiting for multi-source packs.
- `verify-quotes` result caching: skip re-fetch when text file already present.

## v1.0 — stable contract

- Bump schema `$id` URLs to include version path (`/v1/agenda-brief.schema.json`).
- Freeze MCP tool names and signatures; add deprecation notice policy.
- `agent-manifest.json` documented as single source of truth for protocol, lenses, schemas, and source requirements.
- Benchmark suite with reproducible numbers across at least 20 cases.
- Keep factual verification outside v1.0; document it as a future layer rather than changing current evidence/eval semantics.
- Keep source-plan coverage diagnostic before v1.0; `source-coverage --strict` is an opt-in gate and does not redefine `validate-evidence` as category completeness.

## Post-v1 — factual verification layer

- Define a separate Claim Verdict contract for real-world claim assessment.
- Preserve existing `support_status`, `support_level`, `score`, `bench`, `verify-quotes`, and `evidence_mode` semantics.
- Treat sanctions, legal, market, geopolitical, and company fact checks as authoritative-source workflows, not schema validation.

## Explicit non-goals (today and likely v1.0)

- Live source crawling or news aggregation.
- Open-domain factuality verification.
- A monolithic agent framework. The package stays a small contract layer.
- Replacing analyst judgment.
