# CHANGELOG

All notable changes to **Agenda‑Intelligence.md** are documented here.

## Unreleased

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
