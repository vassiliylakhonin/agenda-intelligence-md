# v0.8.0 — Agenda Intelligence product shell

v0.8.0 turns this repository into the entry point for the Agenda Intelligence product. Five new MCP tools wrap the existing validation surface with geography routing, system-prompt assembly from bundled reasoning method and regional references, optional direct LLM invocation, and a vendored snapshot of the Global Think Tank Analyst signal archive. The validation layer remains unchanged.

## Added — Product-shell MCP tools

- `analyze` — full pipeline: validates the request against `agenda-request.schema.json`, routes geography to the relevant in-repo regional / sector references (Central Asia + Caspian, Gulf + Middle East, sanctions), assembles a system prompt from the bundled SKILL.md and reference files, and — when `ANTHROPIC_API_KEY` is set and the optional `anthropic` SDK is installed — calls the Anthropic API and validates the returned memo against `agenda-memo.schema.json`. Without an API key, returns a skeleton memo plus the assembled `system_prompt` so a host model can complete the analysis.
- `validate_memo` — schema check against `agenda-memo.schema.json` for memos produced outside the analyze pipeline.
- `list_signals` / `get_signal` — read-only access to a vendored snapshot of the Global Think Tank Analyst signal archive under `data/signals/`.
- `deep_dive` — reserved for v2; returns a planned-status message directing callers to `analyze` with `depth: scenario` or `red_team`.

MCP tool count: 11 → 16.

## Added — Product request and memo schemas

- `schemas/agenda-request.schema.json` — input contract: `question`, `decision_context`, `audience`, `geography`, `time_horizon`, `evidence_mode`, `depth`, `output_format`. Draft 2020-12, strict.
- `schemas/agenda-memo.schema.json` — output contract: `meta` (incl. `modules_used`, `gtta_version`, timestamp), `risk_summary` (short / detailed), `decision_frame`, `analysis` (facts / assessments / assumptions / unknowns), `scenarios` with probability ranges, `options`, `recommended_actions`, `failure_modes`, `watch_next`, `audit` (validation_score, provenance). Both schemas include validated examples.
- Schemas are exposed in `agent-manifest.json` under `schemas` (as `agenda_request` and `agenda_memo`) and via a new `product` block declaring the request/response contract, the five MCP tools, and the explicit `live_source_retrieval: false` flag.

## Added — Vendored signal archive

- `scripts/sync_signals.py` copies the Global Think Tank Analyst `signals/` directory into `src/agenda_intelligence/data/signals/`, mirror of the `schemas/` ↔ `data/schemas/` dual-copy pattern.
- `tests/test_signal_sync.py` enforces parity when a local GTTA checkout is present and is skipped on CI without it.
- Initial snapshot: 10 individual signals plus `index.json`, `feed.json`, `latest.md`, `TEMPLATE.md`, `README.md`.

## Added — Optional LLM dependency

- `pip install agenda-intelligence-md[llm]` installs `anthropic>=0.40` so `analyze` can call the Anthropic API directly via `ANTHROPIC_API_KEY`. No new hard dependency.

## Added — Product-shell tests

- `tests/test_product_shell.py` — 10 integration tests covering geography routing (Kazakhstan → CA-Caspian, global → GTTA only, mixed Iran/UAE → Gulf+ME), `validate_memo` happy and negative paths, the LLM-invocation branch with mocked Anthropic responses (JSON and non-JSON), and signals + deep_dive coverage. Tests run without network or credentials.

## Changed — Repository positioning

- `README.md` leads with the product framing: Agenda Intelligence is a trusted geopolitical intelligence layer for agentic workflows. Auditable, structured, decision-grade risk memos with evidence discipline that generic LLMs lack. One MCP server. Structured input/output. Built-in validation. The "What this is" section now opens with the MCP product shell. The validator's hardcoded README tagline token has been updated to match.
- `MCP.md` documents the five new tools with request/response examples and tool-count update (11 → 16).

## Unchanged

- Live source retrieval is **not implemented**. `evidence_mode` is restricted to `reasoning_only`, `user_provided`, and `mixed`.
- The existing 11 validation tools (`validate_brief`, `validate_evidence`, `audit_claims`, `get_protocol`, `list_lenses`, `get_lens`, `source_plan`, `list_source_categories`, `source_coverage`, `score_output`, `verify_quotes`) keep their contracts.
- No legal, compliance, financial, or security advice. No autonomous decision-making. No production-grade guarantees.

## Companion repositories

- [Global Think Tank Analyst](https://github.com/vassiliylakhonin/global-think-tank-analyst) — reasoning method loaded by `analyze`.
- [Central Asia + Caspian Hybrid Intelligence Skill](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill) — regional specialist activated when geography matches.
- [Gulf + Middle East Hybrid Intelligence Skill](https://github.com/vassiliylakhonin/gulf-middle-east-hybrid-intelligence-skill) — regional specialist activated when geography matches.

Each companion README now names Agenda Intelligence and documents whether the skill activates automatically (regional specialists) or sits behind the `analyze` tool as the reasoning method (GTTA).

## Upgrade notes

Existing CLI users see no behavioral changes. Existing MCP clients see five additional tools in `tools/list`. The wheel installs the new product layer without requiring the Anthropic SDK; install the `[llm]` extra and export `ANTHROPIC_API_KEY` to enable direct API calls from `analyze`.
