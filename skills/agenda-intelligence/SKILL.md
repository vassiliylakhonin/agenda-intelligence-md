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

For normal agenda questions, read `analysis-protocol.md` and `agenda-triage.md`.
For source-sensitive or current-event tasks, also read `evidence-discipline.md`.
For a requested format, read `output-patterns.md`.

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

A good answer is shorter than a news recap and more useful than a generic think-tank paragraph.

Cut:

- prestige language;
- decorative historical background;
- vague “complex landscape” phrasing;
- unsupported forecasts;
- moral commentary unless it affects risk, legitimacy, compliance, reputation, or operations.
