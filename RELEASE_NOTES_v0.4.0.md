# v0.4.0 — Source Acquisition Layer

v0.4.0 closes the biggest practical bottleneck: source discipline.

Agenda-Intelligence.md now helps agents decide which evidence they need before writing a brief.

## Added

- `SOURCE_POLICY.md` — general source discipline rules.
- `source-taxonomy.json` — source type taxonomy.
- Source requirement packs:
  - `sanctions.json`
  - `regulation.json`
  - `elections.json`
  - `conflict-security.json`
  - `energy.json`
  - `trade.json`
  - `financial-market.json`
  - `technology-ai.json`
  - `regional-risk.json`
- `schemas/evidence-pack.schema.json`.
- `examples/source/evidence-pack.json`.
- CLI commands:
  - `source-types`
  - `list-source-packs`
  - `source-plan <category>`
  - `validate-evidence <file>`

## Why this matters

The project now separates four layers:

```text
Agenda-Intelligence.md = how to reason
Lenses = what to check by region/sector
AnalysisBank = how to learn from past outputs
Source Acquisition Layer = what evidence is required before making claims
```

This moves the repository closer to agent research infrastructure, not just a prompt/protocol package.
