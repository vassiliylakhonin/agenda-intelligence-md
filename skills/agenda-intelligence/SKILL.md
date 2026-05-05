---
name: agenda-intelligence
description: Turn public agenda, news, policy moves, geopolitical developments, sanctions, trade disputes, regulation, elections, diplomatic signals, and strategic-risk events into decision-ready briefs. Use when the user asks an agent to analyze what changed, why it matters, who is affected, what is uncertain, scenarios, watch-next indicators, or risk implications instead of producing a simple news summary.
---

# Agenda Intelligence

Use this skill to convert messy public agenda into decision-useful analysis.

Do not summarize the news by default. Identify the delta: what changed, who gained or lost leverage, what incentives shifted, what remains uncertain, and what the user should watch or decide.

## Load references

Read only the smallest needed subset:

- `references/analysis-protocol.md` — default reasoning protocol for agenda analysis.
- `references/agenda-triage.md` — classify developments as noise, weak signal, signal, structural shift, or trigger event.
- `references/evidence-discipline.md` — source handling, uncertainty labels, and live-verification limits.
- `references/output-patterns.md` — compact brief, decision memo, red-team, and watchlist formats.
- `references/regional/central-asia-caspian.md` — regional lens for Central Asia and Caspian agenda analysis.
- `references/regional/middle-east.md` — regional lens for Middle East agenda analysis.
- `references/regional/eu.md` — regional lens for European Union agenda analysis.
- `references/sector/sanctions.md` — sector lens for sanctions and export-control agenda analysis.

For normal agenda questions, read `analysis-protocol.md` and `agenda-triage.md`.
For source-sensitive or current-event tasks, also read `evidence-discipline.md`.
For a requested format, read `output-patterns.md`.
For Central Asia, Caspian, sanctions-routing, corridor, banking, energy, minerals, or regional political-economy questions, also read `references/regional/central-asia-caspian.md`.
For Middle East, Gulf, Iran, Israel/Palestine, Red Sea, energy, maritime chokepoint, sovereign capital, sanctions, or escalation questions, also read `references/regional/middle-east.md`.
For European Union, EU regulation, sanctions, trade defense, digital regulation, climate policy, enlargement, competition, market access, or enforcement questions, also read `references/regional/eu.md`.
For sanctions, export controls, designations, delistings, enforcement, beneficial ownership, routing, financial restrictions, licenses, or compliance exposure, also read `references/sector/sanctions.md`.

## Core rule

Separate:

- Fact
- Assessment
- Assumption
- Unknown
- Scenario
- Indicator to watch

Never make speculation sound like fact. Never imply live verification if none was performed.

## Default output

Use this compact shape unless the user requests otherwise:

```markdown
**Bottom line:** ...
**Signal classification:** noise / weak signal / signal / structural shift / trigger event
**What changed:** ...
**Why it matters:** ...
**Who is affected:** ...
**Main uncertainty:** ...
**Scenarios:** ...
**Watch next:** ...
```

## Quality bar

A good answer is shorter than a news recap and more useful than a generic think‑tank paragraph.

Cut:

- prestige language;
- decorative historical background;
- vague “complex landscape” phrasing;
- unsupported forecasts;
- moral commentary unless it affects risk, legitimacy, compliance, reputation, or operations.

## How to use with OpenClaw

Add the skill to your workspace (e.g. `clawhub install agenda-intelligence`). Then invoke it from a prompt:

```
[skill:agenda-intelligence]

Analyze the latest EU regulation on AI‑risk assessments. Identify what changed, who gains leverage, remaining uncertainties, and watch‑next indicators.
```

OpenClaw-style agents can load the referenced markdown files and use the CLI
for validation, source plans, and before/after scoring. The exact runtime
wrapper depends on the host agent environment.

You can also pass a brief directly:

```
[skill:agenda-intelligence]

Brief: "EU AI Act amendment 2026 – new high‑risk AI categories and tighter reporting thresholds."
```

Use this as an analysis request plus source-plan trigger. Automated source
fetching from a brief is not implemented yet; if live retrieval is unavailable,
mark the evidence mode as `reasoning_only`, `user_provided`, or `mixed`.
