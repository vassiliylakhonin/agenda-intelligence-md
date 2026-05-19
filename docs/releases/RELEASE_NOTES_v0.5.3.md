# v0.5.3 — Trust, DX, and Brief Scoring

v0.5.3 turns the project from a protocol plus validation toolkit into a more
measurable agent workflow.

## Added

- JSON brief scoring:
  - `agenda-intelligence score brief.json`
  - returns a heuristic 0-100 protocol score
  - reports relevance, evidence support, completeness, actionability, and clarity
- Evidence-linked scoring:
  - `agenda-intelligence score brief.json --evidence evidence-pack.json`
  - accounts for supported, partially supported, and unsupported claims
  - accounts for missing and contradicting sources
  - checks evidence-mode alignment and `retrieved_at` hygiene for live-backed packs
- MCP read tools:
  - `get_protocol`
  - `list_lenses`
  - `get_lens`
  - `source_plan`
- Regression tests for package-data consistency, MCP read tools, JSON scoring, and
  evidence-linked scoring.

## Changed

- Synchronized package version, top-level manifest, and packaged manifest to
  `0.5.3`.
- Synchronized top-level and packaged agenda brief schemas.
- Updated README, quickstart, evaluation docs, MCP docs, roadmap, and skill docs
  to match implemented behavior.
- Kept before/after markdown scoring working while adding JSON brief scoring.

## What this does not do

- It does not verify factual truthfulness.
- It does not fetch live sources from a brief.
- It does not replace human or LLM judge review for high-stakes analysis.

The scoring layer is a practical quality loop for structure and evidence
discipline, not a truth engine.
