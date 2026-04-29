# ADOPTION.md

How to use Agenda-Intelligence.md in agent projects.

## Fastest setup

Copy the top-level file into your repo:

```text
Agenda-Intelligence.md
```

Then add this to your agent instructions, `AGENTS.md`, system prompt, or equivalent:

```md
## Agenda analysis

When analyzing public agenda, news, policy, regulation, sanctions, geopolitics, trade, elections, conflicts, markets, or strategic risk, follow `Agenda-Intelligence.md`.

Do not summarize by default. Classify the signal, identify what changed, separate fact from assessment, name uncertainty, and end with watch-next indicators.

Load it conditionally. Do not add it to every task.
```

## Recommended file layout

```text
AGENTS.md
Agenda-Intelligence.md
```

Optional deeper setup:

```text
agenda-intelligence/
  analysis-protocol.md
  agenda-triage.md
  evidence-discipline.md
  output-patterns.md
  regional/
  sector/
```

## Use with AGENTS.md

`AGENTS.md` tells the agent how to operate globally.
`Agenda-Intelligence.md` tells the agent how to reason about public agenda only when relevant.

Keep it conditional:

```text
ordinary coding task → do not load
ordinary writing task → do not load
news / sanctions / policy / regulation / geopolitics / strategic risk → load
```

## Use with Claude Code / Codex-style repo instructions

Add a short hook to repo instructions:

```md
For public-agenda analysis, load `Agenda-Intelligence.md` and any relevant lens file. Prefer signal classification, uncertainty, and watch-next indicators over generic summaries.
```

## Use with retrieval / RAG

Index the files as retrieval documents. Trigger retrieval on terms such as:

```text
news, policy, regulation, sanctions, geopolitics, trade, election, conflict, market access, compliance, enforcement, strategic risk
```

Recommended retrieval order:

1. `Agenda-Intelligence.md`
2. `analysis-protocol.md`
3. `agenda-triage.md`
4. `evidence-discipline.md` if source quality matters
5. one regional or sector lens if relevant

## Use with OpenClaw-style skills

Use `skills/agenda-intelligence/SKILL.md` as the trigger/router and keep deeper files in `references/`.

The wrapper should load only the smallest relevant subset:

- base protocol for ordinary agenda analysis;
- evidence discipline for source-sensitive tasks;
- regional lens for region-specific agenda;
- sector lens for sanctions, energy, AI regulation, trade, etc.

## Minimal test

Ask your agent the same question before and after adding the file:

```text
The EU published implementation guidance for a major regulation. What does this mean?
```

Weak output usually says:

```text
Companies should monitor developments and prepare for possible regulatory changes.
```

Better output says:

```text
Treat this as a compliance-relevant signal until enforcement guidance, deadlines, or first regulator actions appear. Watch for delegated acts, agency guidance, compliance deadlines, and product redesigns.
```

## Evaluation

Use `examples/before-after/evaluation-rubric.md`.

A useful output should score well on:

- signal classification;
- what changed;
- actor specificity;
- mechanism;
- uncertainty;
- falsifiability;
- watch-next indicators;
- decision value.
