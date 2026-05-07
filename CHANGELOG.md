# CHANGELOG

All notable changes to **Agenda‑Intelligence.md** are documented here.

## [Unreleased]

## [0.7.2] – 2026-05-07
### Added
- `agenda-intelligence doctor` for local package and MCP self-diagnosis.
- `agenda-intelligence doctor --json` for machine-readable diagnostics.
- CI and post-release smoke coverage for the doctor command.

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
