# v0.7.5 — Source-plan coverage diagnostics

Draft release notes for the next patch after v0.7.4. This release line adds source-plan coverage diagnostics while keeping factual verification outside the v1 contract.

## Added — Source category discovery

- `agenda-intelligence source-categories`
- MCP `list_source_categories`
- Machine-readable category IDs and per-pack counts for `must_check`, supporting sources, and watch indicators.

## Added — Source-plan coverage

- `agenda-intelligence source-coverage <evidence.json> [--category <category>]`
- MCP `source_coverage`
- Reports:
  - `covered_required_sources`
  - `missing_required_sources`
  - `required_source_details`
  - `coverage_pct`
  - `strict_gate_passed`

## Added — Evidence-pack source category

- Optional `source_category` field added to `evidence-pack.schema.json`.
- `source-coverage` can use `evidence_json.source_category` when `--category` is omitted.
- Source-backed benchmark examples now carry `source_category`, making batch coverage diagnostics deterministic.

## Added — Bench coverage diagnostics

- `agenda-intelligence bench` now includes source-plan coverage diagnostics in Markdown and JSON output.
- Committed source-backed baseline now reports:
  - 20 cases
  - 100% schema-valid
  - 100% with evidence packs
  - 100% with claim-level audit
  - 100% with source category
  - 14.8% mean source-plan coverage
  - 20 cases with diagnostic source-plan gaps
  - 0 audit orphan refs

## Boundary

- This release does not add factual verification.
- It does not crawl the web, discover missing sources, score source reputation, or decide whether a claim is true in the world.
- Missing `must_check` coverage is a diagnostic gap before v1.0.
- `source-coverage --strict` is opt-in and separate from `validate-evidence`.

