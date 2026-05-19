# v0.1.0 — Agenda-Intelligence.md

First stable release of Agenda-Intelligence.md as a drop-in cognition layer for agents that analyze public agenda.

## What is included

- Top-level `Agenda-Intelligence.md` file designed to sit next to `AGENTS.md`.
- `ADOPTION.md` with setup patterns for repo instructions, AGENTS.md, retrieval/RAG, and OpenClaw-style skills.
- Base agenda-analysis protocol:
  - signal classification;
  - fact / assessment / assumption / unknown / scenario / indicator separation;
  - evidence discipline;
  - output patterns.
- Before/after demos showing the difference between generic summary and decision-useful agenda analysis.
- Evaluation rubric for scoring agent outputs.
- Regional lens packs:
  - Central Asia + Caspian;
  - Middle East;
  - European Union.
- Sector lens pack:
  - Sanctions.
- Optional OpenClaw-compatible skill wrapper.
- CI validation for required files.

## Recommended use

Copy `Agenda-Intelligence.md` into an agent repo and add a conditional hook to `AGENTS.md` or equivalent instructions:

```md
When analyzing public agenda, news, policy, regulation, sanctions, geopolitics, trade, elections, conflicts, markets, or strategic risk, follow `Agenda-Intelligence.md`.

Do not summarize by default. Classify the signal, identify what changed, separate fact from assessment, name uncertainty, and end with watch-next indicators.
```

## Why it exists

Generic agents often produce:

```text
recap → generic implications → “monitor developments”
```

This release pushes agents toward:

```text
signal classification → what changed → affected actors → uncertainty → scenarios → watch-next indicators
```
