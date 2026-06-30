# Agenda-Intelligence.md

A portable cognition layer for AI agents that analyze public agenda.

Use this file conditionally when the task involves news, policy, regulation, sanctions, geopolitics, trade, energy, elections, conflicts, markets, or strategic risk.

Do not use it for ordinary chat, coding, personal assistance, or generic writing tasks.

## Role among agent files

```text
AGENTS.md      = how the agent should operate
SOUL.md        = how the agent should sound and hold stance
TOOLS.md       = how the agent should use tools
IDENTITY.md    = who the agent is and why it exists
USER.md        = who the agent adapts to
HEARTBEAT.md   = what the agent does proactively
MEMORY.md      = what the agent remembers
Agenda-Intelligence.md = how the agent should reason about public agenda
```

## Core rule

Do not summarize public agenda by default.

Instead, identify:

1. what changed;
2. whether it is noise, weak signal, signal, structural shift, or trigger event;
3. who gains or loses leverage;
4. which incentives shifted;
5. what is fact, assessment, assumption, unknown, scenario, or indicator;
6. what would confirm or falsify the view;
7. what to watch next.

## Required separation

Always separate:

- **Fact** — established, reported, cited, or user-provided information.
- **Assessment** — reasoned analytical judgment.
- **Assumption** — working premise used because context is missing.
- **Unknown** — material unresolved question.
- **Scenario** — contingent pathway, not prediction.
- **Indicator** — observable evidence that would confirm, weaken, or falsify an assessment.

Never make speculation sound like fact.
Never imply live verification if no live verification was performed.

Tag factual claims inline: `[primary]` `[secondary]` `[user-provided]` `[inference]` `[analyst-judgment]` — plus optional `[verify]` or `[stale-risk: YYYY-MM]`. See `references/evidence-discipline.md` for full system.

## Default output

```markdown
**Bottom line:** ...
**Signal classification:** noise / weak signal / signal / structural shift / trigger event
**Signal markers:** compliance-relevant development / enforcement marker / escalation marker / none
**What changed:** ...
**Why it matters:** ...
**Who is affected:** ...
**Main uncertainty:** ...
**Scenarios:** ...
**Watch next:** ...
```

## Signal lifecycle

For signals classified as `signal`, `structural_shift`, or `trigger_event` that require monitoring across sessions, open a tracker using `skills/agenda-intelligence/references/signal-lifecycle.md`.

Stages: `detected → developing → escalated → stable → resolved → archived`.

Store tracker files as `signal-trackers/{signal_id}.json` validated against `schemas/v1/signal-tracker.schema.json`. When a signal resolves, distill a reasoning memory card into `analysis-bank/`.

## Use with deeper references

For more detailed behavior, load only the smallest needed subset:

- `skills/agenda-intelligence/references/analysis-protocol.md`
- `skills/agenda-intelligence/references/agenda-triage.md`
- `skills/agenda-intelligence/references/evidence-discipline.md`
- `skills/agenda-intelligence/references/output-patterns.md`

For regional agenda analysis, add the relevant lens:

- `skills/agenda-intelligence/references/regional/central-asia-caspian.md`
- `skills/agenda-intelligence/references/regional/middle-east.md`
- `skills/agenda-intelligence/references/regional/eu.md`

For sector-specific agenda analysis, add the relevant lens:

- `skills/agenda-intelligence/references/sector/sanctions.md`

## AGENTS.md integration snippet

```md
## Agenda analysis

When analyzing public agenda, news, policy, regulation, sanctions, geopolitics, trade, elections, conflicts, markets, or strategic risk, follow `Agenda-Intelligence.md`.

Do not summarize by default. Classify the signal, identify what changed, separate fact from assessment, name uncertainty, and end with watch-next indicators.

Load it conditionally. Do not add it to every task.
```


## AnalysisBank memory layer

For agents that should improve across tasks, use `analysis-bank/` to store short reasoning memories from successful and failed outputs.

Before high-stakes or ambiguous analysis:

1. Identify region and sector.
2. Retrieve at most 3 relevant memory cards from `analysis-bank/`.
3. Apply only if boundary conditions match.
4. Prefer memories that prevent known failure modes.

The packaged `analyze` pipeline performs this as a bounded Reasoning Memory
selection step: lifecycle filter, retrieval rank, applicability gate, then at
most three memory cards in the prompt. These memories are reasoning guardrails,
not factual evidence or source support.

When selected, the server records the same compact trace in
`audit.reasoning_memory` so a memo can be reviewed separately from the response
envelope without losing which reasoning guardrails were applied.

Do not store raw private transcripts, stale facts, secrets, or full chain-of-thought.
