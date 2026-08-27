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

## v0.9 — agent-eval delta, trust infrastructure, and product-shell narrative alignment (shipped 2026-05-22 as v0.9.3)

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

## v1.0 — stable contract (shipped 2026-05-23 as v1.0.0 / v1.0.1)

Contract surface locked per ADR 0003 + ADRs 0011–0013. v1.0.1 was a metadata-only patch for MCP directory descriptions; no behavior change. See `CHANGELOG.md` for the per-release detail.

- Bump schema `$id` URLs to include version path (`/v1/agenda-brief.schema.json`).
- Freeze MCP tool names and signatures; add deprecation notice policy.
- `agent-manifest.json` documented as single source of truth for protocol, lenses, schemas, and source requirements.
- Benchmark suite with reproducible numbers across at least 20 cases.
- Keep factual verification outside v1.0; document it as a future layer rather than changing current evidence/eval semantics.
- Keep source-plan coverage diagnostic before v1.0; `source-coverage --strict` is an opt-in gate and does not redefine `validate-evidence` as category completeness.

## Post v1.0.1 — multi-surface presentation + deployment automation (shipped 2026-05-26)

No behavior change to MCP, HTTP API, A2A adapter, or schemas. Improves presentation, observability, and release automation around the existing v1.0 contract.

- **Cloudflare Worker HTML landing + `/status`** ([#66](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/66)). Browser visitors to `/` get a clean inline-styled landing page with badges, disclaimers, profile-specific curl examples, and source / PyPI / Agenstry links. API clients still get JSON. `GET /health` stays JSON-only (uptime probes unchanged). New public `GET /status` returns version, profile, A2A version, agent-card / message-send URLs, repository / package links, and the four boundary flags — designed for UptimeRobot / Better Stack and for presales discovery without burning KV reads. Profile-aware: general triage worker vs Middle Corridor Deal Risk Gate.
- **AGENTS.md rewrite for multi-surface architecture** ([#63](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/63)). Identity reframed from "MCP server + validation infrastructure" to "Product runtime + four surfaces". New **Vertical workers inside this repo** section legalizes the Middle Corridor Deal Risk Gate, sets a `< 3` rule for when the next vertical worker triggers a spin-off decision, and lists the artifacts every new worker must ship with (schema under `schemas/v1/`, source-requirements file, service function, HTTP route, A2A profile, contract tests, use-case doc). The blanket "no additions without approval" clause is replaced with a proportionate **Change discipline** rule: additive changes are allowed if they ship behind a v1 schema + contract test + CHANGELOG entry + dual-copy parity. Breaking changes to v1 still require an ADR + version bump.
- **README aligned with multi-surface framing** ([#64](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/64), [#68](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/68)). Hero, fit-in-stack table, "What this is" list, and Status table all reflect MCP + HTTP + A2A + Cloudflare Worker as four delivery surfaces over one core service layer. New **Self-host via HTTP API** section gives the no-MCP fallback: six endpoints listed, one curl probe against the Middle Corridor contract fixture, container build, and an honest "not a hardened internet-facing server" boundary statement.
- **MCP registry auto-publish on tag push** ([#67](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/67)). `.github/workflows/publish-mcp-registry.yml` triggers on `v*` tag push, syncs `server.json` version to the tag via `jq` (defensive), authenticates via GitHub OIDC (no PAT), and runs `mcp-publisher publish`. `workflow_dispatch` available for manual catch-up. The v1.0.1 entry was published manually via local `mcp-publisher` on 2026-05-26 to close the v0.8.2 → v1.0.1 drift before the automation went live.
- **README token hardening** ([#65](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/65)). `scripts/validate.py` no longer asserts the full pre-multi-surface hero string; it asserts the durable substring `evidence-discipline layer for strategic intelligence agents` so future hero polish does not break CI.

Out-of-repo operational changes shipped same session:

- Branch protection + `allow_auto_merge` enabled on `main` across all four portfolio repos. `gh pr merge --auto --squash --delete-branch` now waits for required CI rather than fast-pathing to immediate merge.
- Agenstry agent cards verified live across all three Cloudflare Workers via `deploy/cloudflare-worker/scripts/verify-agent-card.js`.
- Bi-weekly Agenstry "State of the Agent Economy" tracker added as a Claude Code routine (1st and 15th of each month, 09:00 Asia/Almaty). Not a CI workflow — runs in the Claude Code routine infrastructure, separate from this repo.

## Post v1.0.1 — second vertical worker + per-profile live retrieval (shipped 2026-05-26)

Additive change under the `docs/vertical-workers.md` "`< 3` vertical workers in this repo" rule. No change to the v1 request/memo contract surface; new schemas are additive per ADR 0003.

- **CIS secondary-sanctions exposure** vertical worker. Structured secondary-sanctions exposure evidence triage for CIS, Caucasus, and Central Asia counterparties (Kazakhstan, Uzbekistan, Kyrgyzstan, Tajikistan, Turkmenistan, Georgia, Armenia, Azerbaijan, Moldova). Targets enhanced due diligence in EU / UK / UAE / Singapore institutions. New schemas under `schemas/v1/cis-secondary-sanctions-{request,response}.schema.json`, source-requirements taxonomy, service function `cis_secondary_sanctions_exposure`, HTTP route `POST /v1/cis-secondary-sanctions/exposure`, A2A capability `cis_secondary_sanctions_exposure` with the `cis_secondary_sanctions` product profile, three contract fixtures, use-case doc, and 8 contract tests. Honest traction: zero paying customers, zero named pilots — shipped as a portfolio-grade vertical worker.
- **ADR 0014 — per-profile live retrieval** ([docs/adr/0014-per-profile-live-retrieval.md](docs/adr/0014-per-profile-live-retrieval.md)). Runtime default remains `live_retrieval: false`. The `cis_secondary_sanctions` profile opts in to live retrieval against the OpenSanctions consolidated dataset (CC-BY 4.0); matches are merged into the evidence pack as auto-fetched `dated_source` entries with attribution. Graceful degrade on any upstream failure or missing `OPENSANCTIONS_API_KEY`. New module `src/agenda_intelligence/upstream_opensanctions.py` (urllib client, in-process TTL cache). Agent cards now expose per-profile `live_retrieval` metadata via `x_agenda_intelligence.per_profile_live_retrieval`; the `agenda` and `kazakhstan` profile claims are unchanged. SOURCE_POLICY.md gains a "Per-profile live retrieval" section with the upstream whitelist and the success/degraded/disabled status taxonomy.
- **Cloudflare Worker JS-side OpenSanctions live retrieval** for the `cis_secondary_sanctions` profile. Mirrors the Python adapter for the Workers runtime. New JS module `deploy/cloudflare-worker/src/upstream_opensanctions.js`. Cache reuses the existing `AGENDA_USAGE` KV namespace with the `opensanctions:` prefix. New `env.cis-secondary-sanctions` stanza in `wrangler.toml` for the `cis-secondary-sanctions-a2a` subdomain. Worker JS detects the new profile from host/env, emits a per-profile agent card with the `live_retrieval` block, exposes `live_retrieval: true` in `/status` for this profile only, and dispatches structured `cis_secondary_sanctions_exposure` requests through the OpenSanctions live-retrieval path with graceful degrade. `handleJsonRpc` is now async. `agenda` and `kazakhstan` profile boundaries (`live_retrieval: false`) preserved. 6 new worker tests added.
- **ADR 0014 update 2026-05-27 — runtime activation deferred.** Discovered after shipping that the OpenSanctions hosted API is paid (€0.10/call). With zero confirmed buyers for the profile, per-call vendor fees are a sunk-cost trap. The architectural pattern (per-profile capability + env-derived activation + graceful degrade) stays in place; runtime activation flips to deferred. `LIVE_RETRIEVAL_PROFILES` now declares `capability_declared` with `activation_env_var` / `disable_env_var`. New `is_live_retrieval_active(profile)` helper (Python + JS) is env-derived and currently always returns `False`. Agent cards / `/status` now expose `{capability_declared, active, ...}` and include a `deferral_note` when inactive. `boundaries.live_retrieval` honestly reflects actual activation (currently `false`). Re-activation is one `wrangler secret put OPENSANCTIONS_API_KEY` away — no code change. Self-host of bulk OpenSanctions CC-BY data was considered and parked as an option: technically feasible but undermines positioning (compliance buyers distrust homebrew matching) and has sunk-cost risk without a confirmed buyer.

## v1.7.0 — agent self-correction, resilient quote matching, interactive HTML review & CI integrations (shipped on `main` 2026-08-27)

- `agenda-intelligence review` gains `--format html`, emitting an offline, self-contained HTML report with interactive claim-to-source highlighting and reviewer action item checkboxes.
- `evidence_review` natively ingests `.csv` and `.tsv` tables, strips tags from local `.html` files, and detects empty text layers on scanned PDFs.
- Resilient quote matching with ellipsis (`...`, `…`) support, non-contiguous chronological fragment matching, and typographical normalization for quotes, dashes, and whitespace across `check_evidence_packet`, `grounded_check`, and `verify_quotes`.
- Agent self-correction feedback loop via `build_repair_prompt`, CLI `repair-prompt`, and MCP `generate_repair_prompt`.
- Native MCP resources (`agenda://manifest`, `agenda://protocol/core`, `agenda://schemas/v1/...`) and prompt templates (`draft_evidence_memo`, `self_correct_packet`, `audit_evidence_claims`).
- Framework-agnostic `agenda_intelligence.integrations.EvidencePacketGuardrail` for LangChain, LlamaIndex, DSPy, and custom agent loops.
- Composite GitHub Action (`action.yml`) for repository CI evidence linting.

## v1.6.0 — multilingual local evidence review (shipped on `main` 2026-08-24)

- `agenda-intelligence review <manifest>` loads caller-selected UTF-8, Markdown, DOCX, and optional PDF files,
  hydrates the evidence-packet request, and writes reviewer-facing Markdown or JSON without repeating full source
  text in the result.
- The file boundary is explicit: paths must remain inside the manifest directory; individual source size,
  extracted text, and PDF page count are capped. The workflow makes no network or model call.
- Unicode tokenization retains Cyrillic and Arabic words, preserves percentages, and checks common English,
  Russian, and Arabic negation cues. It does not provide morphology, translation, semantic-role resolution,
  factuality, or source-authority assessment.
- The new request contract is additive (`schemas/v1/evidence-review-request.schema.json`). The frozen v1 request/memo
  family, MCP tool names, HTTP routes, and A2A profiles are unchanged.
- The workflow is a local Python-package/CLI capability. Cloudflare Workers cannot read caller-local files and do
  not expose a document-upload endpoint; redeploying them activates the accumulated Worker fixes and version
  alignment, not the local-file review command.
- Release and Worker versions are aligned at 1.6.0 and guarded by tests. Publishing and deployment demonstrate
  availability only; they are not evidence of buyer demand, adoption, or revenue.

## Post-v1 — factual verification layer

- Define a separate Claim Verdict contract for real-world claim assessment.
- Preserve existing `support_status`, `support_level`, `score`, `bench`, `verify-quotes`, and `evidence_mode` semantics.
- Treat sanctions, legal, market, geopolitical, and company fact checks as authoritative-source workflows, not schema validation.

## Explicit non-goals (today and likely v1.0)

- Live source crawling or news aggregation.
- Open-domain factuality verification.
- A monolithic agent framework. The package stays a small contract layer.
- Replacing analyst judgment.

## Commercial operating gate

Status: `portfolio-proof` and `build-to-learn`. The shipped runtime and public workers demonstrate implementation capability; they do not demonstrate a budget, buyer, pilot, or product-market fit.

The current commercial risk is the same one faced by technically useful verification products: people may value better evidence discipline without paying for a separate evidence layer. Therefore the next milestone is not another worker, protocol, hosted surface, or factual-verification subsystem.

Before further product expansion, test one complete paid job:

- **Economic buyer:** a named owner of a near-term high-stakes review.
- **Trigger:** a real source pack, vendor file, RFP, risk file, or model evidence packet due for human sign-off within 3–10 working days.
- **Current workaround:** analyst review, spreadsheets or GRC tickets, reviewer comments, and consultant memos.
- **Past-payment evidence:** none recorded for Agenda Intelligence MD.
- **Smallest test:** deliver one review-ready evidence packet using Agenda Intelligence invisibly behind the workflow; compare it with the buyer's ordinary process.

Measure material unsupported claims, missed evidence requirements, reviewer edit minutes, corrections, and whether the buyer pays for the next packet. Compliments, GitHub activity, demo traffic, endpoint calls, and self-scored evals are not purchase evidence.

Do not add a buyer-facing worker or surface unless a live case cannot be served by the existing core. Park expansion if there is no paid continuation after 10 qualified case offers, reviewer time falls by less than 40%, or a material fabricated figure survives the review pack. If no standalone budget emerges, keep Agenda Intelligence as portfolio infrastructure or an internal layer behind a paid deliverable.
