# CHANGELOG

All notable changes to **Agenda‑Intelligence.md** are documented here.

## Unreleased

Multi-surface presentation + deployment automation. No behavior change to MCP, HTTP API, A2A adapter, or schemas; the v1.0 contract surface is unchanged.

- **Cloudflare Worker: HTML landing on `GET /` + new `GET /status` JSON endpoint** ([#66](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/66)). Browser visitors (Accept: text/html) now see a clean inline-styled landing page with agent name, live/version/A2A/profile badges, "what this is" with explicit non-advice + no-live-retrieval + no-factuality disclaimers, a profile-specific curl example, an endpoints list, and links to source / PyPI / Agenstry. API clients still get the JSON health payload. `GET /health` stays JSON-only regardless of Accept, so existing scripts and uptime checkers are unaffected. New `GET /status` returns a compact JSON status doc suitable for uptime monitors and presales discovery: name, version, profile, A2A protocol version, agent-card / message-send URLs, repository / package links, and the four boundary flags (`not_advice`, `live_retrieval`, `factual_verification`, `human_review_required`). Profile-aware: general worker surfaces strategic-risk triage framing; the kazakhstan worker surfaces Deal Risk Gate framing and escalation language.
- **AGENTS.md rewritten for multi-surface architecture** ([#63](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/63)). Project identity reframed from "MCP server + validation infrastructure" to "Product runtime + four surfaces". New **Vertical workers inside this repo** section legalizes the Middle Corridor Deal Risk Gate as a first-class artifact with a `< 3` spin-off rule for the next worker. The blanket "no new schemas / MCP tools / CLI subcommands without explicit approval" clause is replaced with a proportionate **Change discipline** rule: additive changes are allowed without prior approval if they ship behind a v1 schema, have a contract test, get a CHANGELOG entry, and respect the dual-copy invariant. Breaking changes to v1 schemas / public HTTP endpoints / A2A profiles still require an ADR and a version bump.
- **README aligned with multi-surface framing** ([#64](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/64), [#68](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/68)). Hero, fit-in-stack table, "What this is" list, and Status table now reflect MCP + HTTP + A2A + Cloudflare Worker as four delivery surfaces over one core service layer. New **Self-host via HTTP API** section for shops whose stack does not run MCP: six endpoints listed, one curl probe against the Middle Corridor `pre_signature_escalate.request.json` contract fixture, container build commands, and an honest "not a hardened internet-facing server" boundary. The Status row honestly states `no paying customers yet — illustrative usage only` per the new AGENTS.md honesty rules.
- **Hardened the README token guard in `scripts/validate.py`** ([#65](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/65)). The guard previously asserted the literal pre-multi-surface hero string and failed on `main` the moment #64 landed. The token now asserts the durable substring `"evidence-discipline layer for strategic intelligence agents"` so future hero polish does not break CI.
- **Automated MCP registry publish on tag push** ([#67](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/67)). New `.github/workflows/publish-mcp-registry.yml` triggers on `v*` tag push, syncs `server.json` version to the tag via `jq` (defensive against stale release commits), authenticates via GitHub OIDC (no PAT), and runs `mcp-publisher publish`. `workflow_dispatch` with a `version` input is available for manual catch-up runs. The v1.0.1 registry entry was published manually via local `mcp-publisher` on 2026-05-26 (during a GitHub Actions outage) to close the v0.8.2 → v1.0.1 drift before the automation went live.

Operational changes outside the package itself (recorded here for audit, not for PyPI release notes):

- Branch protection on `main` across all four portfolio repos now enforces required CI checks before merge; `allow_auto_merge` is enabled at the repo level so `gh pr merge --auto --squash --delete-branch` waits for CI rather than fast-pathing.
- Agenstry agent cards verified live across all three Cloudflare Workers (general + kazakhstan + middle-corridor-deal-risk-gate) using `deploy/cloudflare-worker/scripts/verify-agent-card.js` after the landing-page deploy.

## [1.0.1] – 2026-05-23

Metadata-only patch release for MCP directories and agent registries.

- Expanded the 16 stdio MCP tool descriptions with clearer "when to use", input, output, and boundary guidance so directories such as Glama can present the server more accurately.
- Added non-validation `description` annotations to MCP `inputSchema` properties and mirrored them in both agent-manifest copies.
- No runtime behavior, schema validation semantics, CLI behavior, or tool names changed.

## [1.0.0] – 2026-05-23

First v1.0 release. Locks the contract surface defined by ADRs 0011–0013 per ADR 0003: future breaking changes to schemas, MCP tools, or the manifest contract fields (`name`, `version`, `schemas`, `mcp`, `cli`) require a v2.0 bump.

No new product behavior versus 1.0.0rc1; the RC was verified end-to-end via the post-release smoke workflow against the published PyPI wheel.

### Also included
- CI smoke regex relaxed to accept PEP 440 pre/post/dev versions ([#59](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/59)).

## [1.0.0rc1] – 2026-05-23

First release candidate for the v1.0 contract-freeze line. No new product behavior; this RC packaged the contract surface defined by ADRs 0011–0013 and the three follow-up fixes (#54, #55, #56) for end-to-end verification before the final v1.0.0.

The contract surface is: `name`, `version`, `schemas` (map of `{path, schema_version}` per ADR 0011), `mcp` (`{spec, tools[*]}` per ADR 0012), `cli`. See the manifest's `_contract_fields` and `_informational_fields` arrays for the authoritative split.

Pre-release publication: `pip install agenda-intelligence-md==1.0.0rc1` (default `pip install agenda-intelligence-md` still resolved to the latest stable, 0.9.3, at the time of release).

### Pre-v1.0 contract-freeze follow-ups

Three small fixes closing gaps left after PRs #50–#53 (ADR 0011–0013 contract freeze). No behavior change for callers; all changes are to the manifest contract surface or its CI guards.

- **fix(manifest): correct stale `cli` entrypoint string ([#54](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/54))** — ADR 0013 flagged the manifest `cli` field as still pointing at the backward-compat shim `scripts/agenda_intelligence.py`; the correction was scheduled for the ADR 0013 impl PR (#53) but missed. Both dual-copy manifests now point at the real entrypoint (`python3 -m agenda_intelligence.cli`). Informational string correction per ADR 0013, not a contract change.
- **fix(schemas): restore dual-copy parity for `agent-manifest.schema.json` ([#55](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/55))** — PR #52 added the schema only under `src/agenda_intelligence/data/schemas/v1/` without the paired top-level copy required by the dual-copy invariant in `CLAUDE.md`. Top-level copy restored and `test_packaged_schemas_match_top_level_schemas` is now bidirectional via set equality on filenames, so asymmetric adds fail CI in either direction.
- **feat(schemas): align `agent-manifest.schema.json` with ADR 0013 contract ([#56](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/56))** — The manifest schema predated ADR 0013 and still required the legacy shape (`entrypoint, protocols, lenses`); `validate-manifest` passed by accident. Rewritten to require the ADR 0013 contract surface (`name, version, schemas`, `mcp`, `cli`) plus `_contract_fields` / `_informational_fields` arrays. Adds `$id` per ADR 0011 and `x-schema-version` per repo convention. New tests pin the canonical contract-field set and lift `validate-manifest` into pytest so a stale schema fails CI directly.

## [0.9.3] – 2026-05-22

### Docs — v0.9 release gate closed (all 9/9 acceptance criteria ✅)

Two final v0.9 acceptance items shipped in this release.

#### Phase 4b — evidence-mode discipline extended to 5+5 with full docs ([#43](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/43))
- `tests/fixtures/evidence_mode/` now ships 5 golden and 5 failure fixtures (was 3+3). Two new golden cases cover vessel SDN attribution with caller-supplied source and EU CBAM regulatory `[verify]`-marker; two new failure cases cover sanctions designations and EU AI Act effective-date claims stated as bare facts. Fixtures are generated deterministically by `tests/fixtures/evidence_mode/build.py` from one baseline memo. Test count: 131 → 142.
- `docs/evidence-modes.md` — canonical reference for the three schema `evidence_mode` values (`reasoning_only`, `user_provided`, `mixed`), the post-hoc `check_evidence_mode_discipline` rule, and the full 5+5 fixture table. Clarifies relationship to the four-mode documentation labels in `docs/glossary.md`.
- `docs/rubric.md` — 10-dimension product-shell rubric (decision frame, routing, evidence mode, fact/assessment separation, mechanism specificity, actor incentives, watch-next indicators, source/audit integrity, no unsupported determinative claims, schema validity) plus 6-point human review checklist. Complements (does not replace) the deterministic heuristic scorer in `evals/rubric.md` and the reviewer checklist in `evals/human_checklist.md`. Not a CI gate in v0.9.

#### Phase 8 — 4-layer map deduplicated across the portfolio ([#44](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/44))
- The "Where this fits in the Agenda Intelligence stack" 4-row table is now canonical in this repo's `README.md` only. The three skill repos drop their local duplicates and link to the canonical anchor: [global-think-tank-analyst#10](https://github.com/vassiliylakhonin/global-think-tank-analyst/pull/10), [central-asia-caspian-hybrid-intelligence-skill#12](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill/pull/12), [gulf-middle-east-hybrid-intelligence-skill#11](https://github.com/vassiliylakhonin/gulf-middle-east-hybrid-intelligence-skill/pull/11).

#### ROADMAP
- All 9 v0.9 acceptance criteria now ✅. Sections marking criteria #4 (🟡 → ✅) and #8 (⬜ → ✅) updated with PR references.

No schema, CLI, or MCP tool changes. No new dependencies.

## [0.9.2] – 2026-05-21

### Docs — canon alignment with product-shell role
- `AGENTS.md` Project identity rewritten: this repo is the product entry point and evidence-discipline layer, not just an infrastructure layer. New section documents the four product MCP tools (`analyze`, `validate_memo`, `list_signals` / `get_signal`, `deep_dive` stub) and the geography routing term sets backing `analyze`. Vendored `skills/agenda-intelligence/**` now explicitly described as lighter derived copies; canonical reasoning and regional depth still live in the GTTA and vertical-specialist repos.
- `llms.txt` (and packaged copy under `src/agenda_intelligence/data/`) rewritten to match: drops the legacy "evidence and eval infrastructure layer" framing, lists the four product MCP tools, and documents the geography routing term sets verbatim.

### Added — AnalyzeRequest public example and routing-canon sync guard
- `examples/agenda-request.json` — minimal AnalyzeRequest for copy-paste integration; validated against `agenda-request.schema.json` by `scripts/validate_public_examples.py`, which gained a routing rule for `agenda-request.json` and `*.request.json` files.
- `tests/test_product_shell.py::test_routing_terms_documented_in_canon` — parametrised over `CA_CASPIAN_TERMS` / `GULF_ME_TERMS` / `EU_TERMS` / `SANCTIONS_TERMS`. Every term in the authoritative Python constants must appear verbatim in both `AGENTS.md` (Geography routing) and `llms.txt`. Test count: 121 → 125.

## [0.9.1] – 2026-05-21

### Added — `audience_detail` freeform field on agenda-request (ADR 0009)
- `schemas/agenda-request.schema.json` (and packaged copy) gains an optional `audience_detail` string (`minLength: 1`). The existing enum-bound `audience` field stays as the prompt-routable signal; `audience_detail` carries the caller's original framing (e.g. `"AI company leadership, product and compliance teams"`) so it is not silently coerced to the closest prototype.
- `_format_request_context` in `src/agenda_intelligence/product.py` renders `audience_detail` into the verified request-context block alongside `audience` when present.
- Additive change per ADR 0003: existing requests remain valid; no migration required.
- Closes the second observation from `evals/agent-eval/gtta-global-policy.md` about silent caller-intent loss at the `audience` boundary.
- 3 new unit tests in `tests/test_product_shell.py`. Test count: 118 -> 121.

### Added — EU geography and term routing in `route_modules`
- `src/agenda_intelligence/product.py` now routes geography `"EU"` / `"Europe"` (exact) and question text containing long-form EU terms (`european union`, `european commission`, `eu ai act`, `gdpr`, `cbam`, `cjeu`, `nis2`, `brussels`, `ecb`, `schrems`, etc.) to the `eu` regional specialist. The bare two-letter `"eu"` is matched only as an exact geography token to avoid false-positive substring hits inside words like `exposure` or `queue`.
- `MODULE_PATHS["eu"]` resolves to the existing `skills/agenda-intelligence/references/regional/eu.md` (already shipped in v0.9.0 and present in the packaged data mirror); this commit makes the lens reachable from `analyze` rather than only via the GTTA SKILL's load-list.
- `tests/test_product_shell.py` gains seven direct unit tests for `route_modules`, including a regression guard against substring false positives, an EU + sanctions composition case, and a module-content-loadable check. Test count: 111 -> 118.
- Closes the gap surfaced by `evals/agent-eval/gtta-global-policy.md` observation 3: the GTTA SKILL listed EU as a loadable lens but `route_modules` had no EU branch, so `meta.modules_used` never recorded EU even when the question was EU-centric.

## [0.9.0] – 2026-05-20

### Changed — v0.9 scope: agent-eval delta and product-shell narrative alignment
- ROADMAP `v0.9` rewritten from "verify-quotes network mode improvements" to "agent-eval delta and product-shell narrative alignment". Verify-quotes patches moved to a new `v0.9.x` deferred-patches section. v0.9 explicit non-goals: factual verification schema, source reputation scoring, live news gathering, crawler, `deep_dive` implementation, new MCP tools.
- README headline rewritten: drops "trusted geopolitical intelligence layer" framing for "MCP product shell and evidence-discipline layer for strategic intelligence agents". States no live retrieval and no factual verification as explicit non-goals before v1.0.
- ADOPTION MCP section now lists the product-shell tools (`analyze`, `validate_memo`, `list_signals`, `get_signal`, `deep_dive`) alongside the 11 validation tools, with a one-paragraph product-shell summary.
- `llms.txt` and packaged copy: `Source Acquisition Layer` renamed to `Source Planning Layer` to match CONTEXT canon. The `source_acquisition` manifest key is unchanged (compatibility wire name).

### Added — Agent-Eval Delta glossary and ADR 0008
- `CONTEXT.md` adds glossary entries for **Agent-Eval Delta** (per-case structural delta from the agent-integrator perspective; not factual, not aggregate, not a model-quality comparison) and **Practitioner Review** (optional, audience-gated). Two new rules in Flagged ambiguities make the boundary explicit.
- `docs/adr/0008-agent-eval-delta-is-structural-product-validation.md` records the validation-story decision for v0.9.
- `docs/agent-eval-methodology.md` tightened: live-source-backed examples map to `user_provided` or `mixed` for `analyze`; `live_source_backed` is intentionally absent from `agenda-request.schema.json` because live retrieval is upstream of Agenda Intelligence.
- `evals/agent-eval/` scaffolded with three case files (`gtta-global-policy.md` intended as the v0.9 full case; `ca-caspian-sanctions.md` and `gulf-me-hormuz-shipping.md` as stubs not to be cited until run).

### Added — Agent-eval case template
- README and evaluation docs now link the agent-eval methodology as the agent-first structural delta method.
- `evals/agent-eval/` now contains a README and reusable case template for skill-repo evals.

### Added — Request-context prompt guardrails
- `analyze` now injects a server-verified request context block into the system prompt, carrying question, decision context, audience, geography, time horizon, evidence mode, and depth.
- The prompt now explicitly tells the model not to invent citations when `evidence_mode` is `user_provided` or `mixed` but no source material is present in the request.

### Fixed — Product shell contract alignment
- README now describes the full 16-tool MCP surface in both the overview and MCP table.
- `analyze` now honors `output_format: markdown` by returning a server-rendered `rendered_memo` alongside the structured `memo`.
- `sanctions-sector` now uses the `sector_specialist` module role, and `agenda-memo.schema.json` accepts that role.

## [0.8.2] – 2026-05-20

### Added — Official MCP Registry ownership marker
- README footer adds `mcp-name: io.github.vassiliylakhonin/agenda-intelligence-md` so the official Model Context Protocol Registry (registry.modelcontextprotocol.io) accepts the published `server.json` against the PyPI package. No functional change.

## [0.8.1] – 2026-05-20

### Fixed — machine-verified audit replaces LLM self-grading
- `analyze` now overwrites `audit.validation_score` and `audit.validation_details` with values computed from six observable structural checks (schema valid, fact/assessment separation, unknowns acknowledged, modules match routing, watch_next present, evidence_mode within contract). The model can no longer self-assign a 0.99 audit score.
- The model's self-grade is preserved as `audit.self_assessed_score` for transparency, and `audit.machine_verified: true` flags the rewrite explicitly.
- `audit.provenance` (per-claim basis labels) is substantive content and is preserved as the model wrote it.

### Changed — system prompt enforces output format
- `assemble_system_prompt` appends a dedicated `===== OUTPUT FORMAT — STRICT =====` block that forbids markdown fences and surrounding prose, lists required keys, and provides a compact JSON skeleton. Improves first-pass parse rate for weaker host models.

### Added — schema fields for machine-verified audit
- `agenda-memo.schema.json`: optional `audit.machine_verified` (bool) and `audit.self_assessed_score` (number 0-1). Clarified that `validation_score` is structural only.

### Added — README quickstart explains `[llm]` extra
- Quickstart shows `pip install "agenda-intelligence-md[llm]"` + `ANTHROPIC_API_KEY` to enable direct API calls from `analyze`. Without it, `analyze` still returns the assembled `system_prompt` for the host model to complete.

### Tests
- `tests/test_product_shell.py::test_analyze_overrides_self_graded_audit_score` exercises the audit rewrite, the self-grade preservation, and the provenance pass-through.

## [0.8.0] – 2026-05-20

### Added — Agenda Intelligence product shell
- Five new MCP tools turning this repository into the product entry point: `analyze`, `validate_memo`, `list_signals`, `get_signal`, `deep_dive`. MCP tool count: 11 → 16.
- `analyze` validates the request against `agenda-request.schema.json`, routes geography to in-repo regional / sector references (Central Asia + Caspian, Gulf + Middle East, sanctions), assembles a system prompt from the bundled SKILL.md and reference files, and — when `ANTHROPIC_API_KEY` is set and the optional `anthropic` SDK is installed — calls the Anthropic API and validates the returned memo against `agenda-memo.schema.json`. Without an API key, returns a skeleton memo plus the assembled `system_prompt` so a host model can complete the analysis.
- `validate_memo` schema-checks memos against `agenda-memo.schema.json`.
- `list_signals` / `get_signal` expose a vendored snapshot of the Global Think Tank Analyst signal archive under `data/signals/`.
- `deep_dive` is a v2 stub returning a planned-status message.

### Added — Product request and memo schemas
- `schemas/agenda-request.schema.json` defines the input contract (question, decision_context, audience, geography, time_horizon, evidence_mode, depth, output_format).
- `schemas/agenda-memo.schema.json` defines the output contract (meta with modules_used and gtta_version, risk_summary, decision_frame, analysis with fact/assessment/assumption/unknown separation, scenarios with probability ranges, options, recommended_actions, failure_modes, watch_next, audit with validation_score and provenance).
- Both schemas are draft 2020-12, strict (`additionalProperties: false`), and include validated examples.
- `agent-manifest.json` gains a `product` block surfacing the request/response schemas, the five MCP tools, the signal source, and the explicit `live_source_retrieval: false` flag.

### Added — Optional LLM dependency
- `pip install agenda-intelligence-md[llm]` installs `anthropic>=0.40` so `analyze` can call the Anthropic API directly via `ANTHROPIC_API_KEY`. No new hard dependency.

### Added — Vendored signal archive
- `scripts/sync_signals.py` mirrors the GTTA `signals/` directory into `src/agenda_intelligence/data/signals/`, following the same dual-copy pattern as `schemas/` ↔ `data/schemas/`.
- `tests/test_signal_sync.py` enforces parity when a local GTTA checkout is present.

### Added — Product-shell integration tests
- `tests/test_product_shell.py` covers geography routing (Kazakhstan → CA-Caspian, global → GTTA only), validate_memo happy and negative paths, the LLM-invocation branch with mocked Anthropic responses, and signals / deep_dive coverage. Tests do not require network or credentials.

### Changed — Repository positioning
- README now leads with the product framing (Agenda Intelligence — trusted geopolitical intelligence layer for agentic workflows). The "What this is" list opens with the MCP product shell. Companion READMEs (Global Think Tank Analyst, Central Asia + Caspian, Gulf + Middle East) name Agenda Intelligence and document automatic activation rules.
- `MCP.md` documents the five new product-layer tools and updates the tool-count header (11 → 16).

### Added — Agenda brief data integrity notes
- Optional `data_integrity_notes` field added to `agenda-brief.schema.json` for prompt-injection, source-anomaly, stale/conflicting-source, retrieval-limit, or other integrity concerns surfaced by an analyst or agent.
- `data_integrity_notes` is a recording surface only: validators check field shape, but do not detect integrity risks or verify factual truth.

### CI & release
- GitHub Actions workflow dependencies moved to Node 24-compatible `actions/checkout@v6` and `actions/setup-python@v6`.
- PyPI publish steps now explicitly disable attestations while token-based publishing remains active, matching the documented Trusted Publishing migration path.

### Docs
- Use-case and integration docs now frame source plans as evidence expectations, not live retrieval or factual verification.
- MCP and adoption docs now list the full 16-tool surface, including the product-shell layer.

## [0.7.5] – 2026-05-20

### Added — Source-plan coverage diagnostics
- `source-coverage` CLI command and MCP `source_coverage` tool report covered and missing category-specific `must_check` source types.
- `source-categories` CLI command and MCP `list_source_categories` tool expose packaged source requirement categories for agents and CI.
- `source_coverage.required_source_details` explains which evidence source entries matched each required source type and which terms or aliases matched.
- Optional `source_category` field added to evidence packs so coverage diagnostics can select the packaged source plan without a separate category argument.
- `bench` now includes source-plan coverage diagnostics in Markdown and JSON output when evidence packs include `source_category`.

### Changed — Benchmark baseline
- Bundled source-backed baseline remains 20 cases, with 100% schema-valid, 100% evidence packs, and 100% claim-level audit.
- Baseline now also reports 100% source-category coverage, mean source-plan coverage of 14.8%, and 20 cases with diagnostic source-plan gaps.

### Boundary
- Source-plan coverage remains diagnostic before v1.0. It does not discover sources, score reputation, verify factual truth, replace analyst judgment, or redefine `validate-evidence` as category completeness.
- `source-coverage --strict` is opt-in and separate from base schema validation.

## [0.7.4] – 2026-05-17

### Added — Source Ingest skill
- New source-ingest skill: normalizes user-supplied documents (PDF, DOCX, XLSX, URL, article, transcript) into a structured source record with metadata, Axis A/B provenance tags, key-claims table, excerpts, and limitations.
- Live retrieval failure handling: fallback path when a URL fetch fails.
- Source-ingest routing references vertical source guides (Central Asia + Caspian, Gulf + Middle East) instead of duplicating regional source tier content.

### Added — Threat model
- `docs/threat-model.md` — explicit statement of what the validator catches and what it does not.
- Adversarial fixtures + pytest suite codifying the documented threat-model gaps.

### Added — Bench
- EU-CBAM case added to bundled bench; baseline now covers 5 source-backed cases (was 3).

### Docs
- Stack positioning synced across `pyproject.toml`, `llms.txt`, `agent-manifest.json`, and `ADOPTION.md`.
- `CLAUDE.md` scope tightened to evidence/eval infrastructure framing.
- `README.md`: stack-role tag, audience-first first screen, stack-context block, MCP framed as distribution surface.
- Bench baseline counts in docs aligned with committed benchmark output.

### Chore
- `.claudeignore` added with build, OS, and historical release-notes exclusions.

## [0.7.3] – 2026-05-14

### Added — Signal lifecycle
- Signal lifecycle tracker: schema, reference, and workflow for tracking
  observability signals across runs (`docs/signal-lifecycle.md`,
  `schemas/signal-tracker.schema.json`).

### Added — Provenance tags
- Per-claim inline provenance tags rendered in Markdown output, surfacing
  Axis-A source type and Axis-B action flags directly in generated reports.

### Added — Cases & lenses
- BIS AI Diffusion Rule flagship case study (`cases/bis-ai-diffusion`)
  with primary-source evidence.
- Gulf + Middle East added as the second vertical specialist in the
  Regional lenses set, alongside Central Asia + Caspian.

### Added — Evals
- Trust-layer evaluation parameters added to the human review checklist.

### Added — Docs & policy
- `AGENTS.md` and Claude Code working rules formalised.
- Release-artifact process documented.

### CI & packaging
- CI smoke-tests built package artifacts post-build.
- CI guard prevents tracked generated artifacts from re-entering the tree.
- `audit_claims` added to MCP smoke run (full 8-tool wire-protocol coverage).
- Packaged data assets kept in sync with top-level sources via test gate.

### Fixed
- README status block: stale MCP wording corrected.
- `cli.py`: flake8 E501 lint violation.

### Removed / cleaned
- Stale `experimental` labels removed from README docs table.
- Generated package artifacts no longer tracked in the repo.

## [0.7.2] – 2026-05-12

### Repositioned
- Project repositioned as **evidence & eval layer for strategic intelligence agents**.
  README rewritten: "What this is / What this is not", 60-second quickstart,
  status table, limitations, Mermaid architecture diagram.
- `docs/evaluation.md` rewritten around four explicit eval layers;
  factual truthfulness marked **not implemented**.

### Added — CLI
- `agenda-intelligence check` / `audit` / `report` / `eval` aliases for common workflows.
- `agenda-intelligence audit-claims <audit.json> [--strict] [--format json]` —
  validates claim-level evidence-audit JSON; `--strict` exits non-zero on orphan refs.
- `agenda-intelligence bench <dir> [--strict] [--min-score N] [--format json]` —
  discovers `*.brief.json` with sibling `.evidence.json`/`.audit.json`, runs
  validate + audit + score across all cases, emits Markdown or JSON report.
- `agenda-intelligence verify-quotes <pack.json> [--strict] [--texts-dir DIR]` —
  experimental local-text quote verification.
- `agenda-intelligence score` gains `--format json` and `--min-score N` flags.

### Added — Schemas & Examples
- Experimental `schemas/evidence-audit.schema.json` for claim-level evidence audit
  (`claim_id`, `claim_type`, `evidence_ids`, `support_level`, `uncertainty`, `risk_if_wrong`).
- Three flagship source-backed example sets with brief + evidence + claim-level audit:
  `eu-ai-act`, `red-sea-shipping`, `sanctions-routing`.

### Added — MCP
- `audit_claims` MCP tool (8th tool): validates claim-level audit JSON via wire protocol.
- `scripts/smoke_mcp.py` now exercises all 8 tools including `audit_claims` via full
  JSON-RPC cycle (initialize → tools/list → 3× tools/call).
- MCP wire-protocol verification added to `make ci`.

### Added — Evals & CI
- `agenda_intelligence.bench` module: `discover_cases`, `run_case`, `summarize`,
  `render_markdown`, `to_json` — deterministic, LLM-free structural harness.
- `evals/run_benchmark.py` script and committed baselines:
  `evals/baselines/source-backed.{md,json}`.
- `.github/workflows/bench.yml` — CI bench gate (`--strict --min-score 80`)
  with baseline drift check.
- 13 new pytest tests covering all new commands and MCP tool.
- `make ci` extended: MCP smoke + bench; `make ci-fast` for inner loop.
- `scripts/install-hooks.sh` pre-push hook (runs `make ci-fast` before every push).

### Added — Doctor & Config (from 0.7.2 base)
- `agenda-intelligence doctor` for local package and MCP self-diagnosis.
- `agenda-intelligence doctor --json` for machine-readable diagnostics.

### Bundled baseline
- 5 cases (eu-ai-act, eu-cbam, red-sea-shipping, sanctions-routing, bis-ai-diffusion), mean 87.0/100, 100% schema-valid, 100% with evidence, 100% with audit, 0 orphan refs.

## [0.7.1] – 2026-05-06
### Added
- `agenda-intelligence mcp-config --client` for generic, Claude Desktop, Cursor, and Codex local MCP config output.
- Client-specific MCP setup blocks in the integration docs.

## [0.7.0] – 2026-05-06
### Added
- MCP `score_output` tool for before/after protocol-marker quality scoring.
- Shared MCP smoke coverage now verifies `score_output` in addition to source-plan lookup.

### Changed
- The before/after evaluation script now uses the package scorer as its single source of rubric logic.

## [0.6.1] – 2026-05-06
### Added
- `agenda-intelligence mcp-config` for copy-pasteable MCP stdio client configuration.
- Post-release smoke coverage for `agenda-intelligence-mcp`.

## [0.6.0] – 2026-05-06
### Added
- `agenda-intelligence-mcp` console command for a minimal stdio MCP server.
- MCP JSON-RPC handlers for `initialize`, `ping`, `tools/list`, and `tools/call`.
- MCP tool exposure for `validate_brief`, `validate_evidence`, `get_protocol`, `list_lenses`, `get_lens`, and `source_plan`.

## [0.5.5] – 2026-05-06
### Added
- `agenda-intelligence --version` for direct CLI version checks.

### Fixed
- Release and manual publish workflows now clean `dist/` and `build/` before building, preventing old tracked artifacts from being rechecked or reuploaded.

## [0.5.4] – 2026-05-06
### Fixed
- Package version drift: `agenda_intelligence.__version__`, package metadata, and both manifests now report the same release version.
- README GitHub Release install snippet now tracks the current release artifact.

### Added
- Regression coverage for package/manifest/README version consistency.

## [0.5.3] – 2026-05-05
### Added
- Evaluation toolkit: rubric, LLM judge prompt, human checklist, sample cases.
- Heuristic 0-100 JSON brief scoring via `agenda-intelligence score brief.json`.
- Evidence-linked scoring via `agenda-intelligence score brief.json --evidence evidence-pack.json`.
- Source‑backed examples (EU AI Act, sanctions routing, Red Sea shipping).
- Use‑case docs for policy monitoring, sanctions compliance, market risk, founder operating context.
- Tutorial for end‑to‑end quickstart (5‑10 min “aha” moment).
- Demo output section in README.
- `start` command now the primary onboarding CLI entry‑point.

### Changed
- Version drift eliminated: `pyproject.toml` (0.5.3), `agent‑manifest.json` (0.5.3), packaged manifest data (0.5.3), removed `setup.cfg`.
- Top-level and packaged agenda brief schemas are now kept in sync.
- MCP read tools now return packaged protocol, lens, and source-plan data instead of stubs.
- README cleaned: removed old release notes, consolidated into a single coherent document.
- MCP transport/server marked as planned while read-only Python tool functions are documented as implemented.

## [0.5.1] – 2026‑05‑05
### Fixed
- Version sync across files.
- `setup.cfg` removed to avoid trust smells.
- Agent‑manifest version updated to 0.5.1.
- README wheel link updated to v0.5.1.

## [0.5.0] – 2026‑05‑04
### Added
- Source Acquisition Layer: `source‑plan`, `source‑types`, `list‑source‑packs` commands.
- `start` command for guided analysis.
- `memory‑search` for AnalysisBank.
- Expanded `source‑requirements/` with more categories.
- CI workflow updates.

## [0.4.0] – 2026‑04‑28
### Added
- Source Acquisition Layer (initial) – tells agents which source types to check before making claims.
- `source‑plan` command (stub).
- `technology‑ai`, `sanctions`, `regulation`, `elections`, `conflict‑security`, `energy`, `trade`, `financial‑market`, `regional‑risk` source requirement files.
- AnalysisBank memory cards (failures & successes).
- Regional lenses: Central Asia & Caspian, Middle East, EU.
- Sector lenses: sanctions, export controls.
- Revised `Agenda‑Intelligence.md` protocol (v0.4.0) with stronger evidence discipline.

## [0.3.0] – 2026‑04‑20
### Added
- Agent‑first package contracts: `agent‑manifest.json`, JSON schemas for briefs, evidence packs, memory cards.
- CLI validation commands: `validate‑brief`, `validate‑evidence`, `validate‑manifest`.
- `list‑lenses`, `get‑lens`, `get‑protocol` commands.
- `score` command (stub) for before/after evaluation.

## [0.2.0] – 2026‑04‑12
### Added
- AnalysisBank reasoning memory layer: stores reusable patterns from good/bad outputs.
- `analysis‑bank/` directory with failures and successes.
- `eval_before_after.py` script for before/after scoring.
- Sample `before‑after/` examples.

## [0.1.0] – 2026‑04‑05
### Added
- Initial release of `Agenda‑Intelligence.md` protocol.
- Core reasoning workflow: signal classification, what changed, why it matters, who is affected, main uncertainty, watch‑next indicators.
- Basic CLI skeleton (`agenda‑intelligence`).
- `examples/` folder with sample briefs.
- `schemas/` folder with JSON schemas.
- `skills/agenda‑intelligence/` OpenClaw skill wrapper.
