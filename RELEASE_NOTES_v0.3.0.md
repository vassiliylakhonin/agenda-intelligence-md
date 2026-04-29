# v0.3.0 — Agent-first package contracts

v0.3.0 prepares Agenda-Intelligence.md for the “software for agents” direction: not only markdown instructions, but machine-readable contracts and a tiny CLI.

## Added

- `agent-manifest.json` — machine-readable package discovery for agents.
- JSON schemas:
  - `schemas/agenda-brief.schema.json`
  - `schemas/memory-card.schema.json`
  - `schemas/lens-manifest.schema.json`
  - `schemas/signal-classification.schema.json`
- `scripts/agenda_intelligence.py` — helper CLI:
  - `manifest`
  - `list-lenses`
  - `get-lens`
  - `get-protocol`
  - `validate-brief`
  - `score`
- `MCP.md` — sketch of future MCP tools.
- `examples/agenda-brief.json` — example structured brief validated against schema.

## Why this matters

Agents should be able to discover, load, validate, and use reasoning infrastructure programmatically. This release moves Agenda-Intelligence.md from a markdown protocol toward an agent-first package.
