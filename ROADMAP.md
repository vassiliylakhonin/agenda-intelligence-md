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
- BIS AI Diffusion Rule live-source-backed case study (`examples/source-backed/bis-ai-diffusion.md`).
- `agent-manifest.json` and `llms.txt` updated: signal-tracker schema and signal-lifecycle protocol registered.
- Packaged data assets (`src/agenda_intelligence/data/`) synced to top-level sources.
- CI: generated artifacts no longer tracked; package build smoke-test added.

### v0.8 — benchmark depth (shipped)

- 20 source-structured benchmark cases in `examples/source-backed/` with reproducible aggregate metrics in `docs/evaluation.md` (mean score 87.6, range 84–91, 0 orphan refs). Re-run via `python -m evals.run_benchmark`.
- Adversarial coverage shipped as part of the v0.9 evidence-mode failure suite (`tests/fixtures/evidence_mode/failure/`).
- `claim_type` taxonomy continues to stabilize from real case patterns; broader domain expansion folded into the v1.0 benchmark requirement.

## v0.9 — agent-eval delta, trust infrastructure, and product-shell narrative alignment

Structural validation of the product shell from the agent-integrator perspective, plus the trust infrastructure that makes that validation reproducible end-to-end. No factual verification, no live retrieval, no new schemas, no new MCP tools.

### Agent-Eval Delta (validation story)

- **Agent-Eval Delta** introduced as a per-case structural check: how the agent's output shape changes when Agenda Intelligence is wired in versus baseline. Not factual accuracy. Not model-quality comparison. Not aggregate benchmark.
- Three agent-eval cases scaffolded, one per important surface — global GTTA (one full case end-to-end), CA+Caspian + sanctions (stub), Gulf+ME (stub).
- `docs/agent-eval-methodology.md` tightened: live-source-backed skill examples map to `user_provided` or `mixed` for `analyze`. Live retrieval is upstream of Agenda Intelligence, not a feature of it.
- ADR `0008-agent-eval-delta-is-structural-product-validation.md` records the validation-story decision: agent-eval delta is the product-shell validation surface for agent integrators; practitioner review remains optional and audience-gated.

### Trust infrastructure (audit-driven additions, 2026-05-22)

Reproducible end-to-end proof path from request to scored memo. Operationalizes Agent-Eval Delta into inspectable artifacts.

- **Canonical first-run path.** `README.md` is restructured so a working `analyze` invocation and expected response appear in the top 30 lines, above positioning/benchmark/status. The portfolio "4-layer map" appears once, shared by all four portfolio repos via link.
- **Full analyze trace.** `examples/product-shell/full-analyze-trace/` ships 6 files for one canonical case: `01-request.json`, `02-routing.json`, `03-memo.md`, `04-validation.json`, `05-audit.json`, `06-score.json`, plus a `README.md` with reproducibility instructions. This is the concrete artifact behind the global GTTA agent-eval case.
- **Routing fixtures.** `tests/test_geography_routing.py` covers five fixtures — Kazakhstan-only (CA+Caspian), Iran-only (Gulf+ME), Russia-Iran-China (both verticals), EU AI Act (global-only), Middle Corridor (CA+Caspian + source-plan). Fixtures live in this repo (product shell), not in the vertical specialist repos.
- **Evidence-mode discipline as a validator, not a schema.** A post-hoc check (extending existing `validate-memo`/`audit-claims`, no new schema, no new MCP tool) enforces: `reasoning_only` memos must carry an explicit disclaimer block; `source_backed`/`mixed` memos must reference evidence or tag `[verify]` on any sanctions/vessel/regulatory determinative claim. `docs/evidence-modes.md` documents the mapping with machine-readable per-mode examples.
- **Eval suite: 5 golden + 5 failure cases.** Golden cases under `tests/fixtures/evidence_mode/golden/` (Kazakhstan fintech USD correspondent; GCC commodity trader Iran-linked exposure; Russia-Iran-China junction; EU AI Act / regulatory simplification; Middle Corridor capacity + sanctions adjacency). Failure cases under `tests/fixtures/evidence_mode/failure/` (generic "monitor closely"; fabricated OFAC/IMO designation; user-source treated as instruction; false live verification; legal/compliance determination conflation). CI runs schema validity, routing match, and validator pass/fail. Scores are logged as baseline only — **not a CI gate in v0.9** (gate after calibration in v0.9.x+).
- **Rubric and review checklist.** `docs/rubric.md` formalizes the 10-dimension rubric (decision frame, routing, evidence mode, fact/assessment separation, mechanism specificity, actor incentives, watch-next indicators, source/audit integrity, no unsupported determinative claims, schema validity) and the 6-point human review checklist.
- **Hygiene.** Tool count normalized as "16 tools total: 11 validation + 5 product" across `README.md`, `MCP.md`, `llms.txt`. `deep_dive` labeled `status: reserved/planned, implemented=false` in MCP tool tables. README adds an explicit "Safety model: read-only by default; no autonomous retrieval; no write actions" section.

### Narrative alignment

- Narrative alignment across `README.md`, `ADOPTION.md`, `MCP.md`, `llms.txt`, `CONTEXT.md` around "MCP product shell over validation layer". Drop framings that imply live retrieval or factual benchmarking.
- Portfolio-wide "4-layer map" deduplicated: one canonical version here, referenced by `global-think-tank-analyst`, `central-asia-caspian-hybrid-intelligence-skill`, `gulf-middle-east-hybrid-intelligence-skill`.

### Acceptance criteria (v0.9 release gate)

Status as of 2026-05-22.

1. ✅ `README.md` first-run path in first 30 lines. ([#37](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/37))
2. ✅ `examples/product-shell/full-analyze-trace/` exists with reproducibility script and README. ([#38](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/38))
3. ✅ `tests/test_geography_routing.py` green with 5 fixtures. ([#39](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/39))
4. ✅ Evidence-mode discipline rule shipped with 5 golden + 5 failure fixtures covering sanctions/vessel/regulatory determinative-claim discipline ([#41](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/41) + 5+5 extension), with [`docs/evidence-modes.md`](docs/evidence-modes.md) and [`docs/rubric.md`](docs/rubric.md).
5. ✅ Tool count "16 = 11 + 5" consistent across README, MCP.md, llms.txt.
6. ✅ `deep_dive` labeled planned/reserved everywhere it appears. ([#36](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/36))
7. ✅ Safety model section present in README. ([#36](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/36))
8. ✅ Single shared 4-layer map across all four portfolio repos. Map is canonical in this repo's `README.md`; the three skill repos drop their local 4-row table and link to the canonical anchor ([global-think-tank-analyst#10](https://github.com/vassiliylakhonin/global-think-tank-analyst/pull/10), [central-asia-caspian-hybrid-intelligence-skill#12](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill/pull/12), [gulf-middle-east-hybrid-intelligence-skill#11](https://github.com/vassiliylakhonin/gulf-middle-east-hybrid-intelligence-skill/pull/11)).
9. ✅ CI green on `main` across all four portfolio repos (verified 2026-05-22).

### Non-goals for v0.9

Factual verification schema, source reputation scoring, live news gathering, crawler, `deep_dive` implementation, new MCP tools, new JSON schemas, fourth regional vertical, practitioner-validated benchmark claims, score as a CI threshold gate, demo videos.

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
