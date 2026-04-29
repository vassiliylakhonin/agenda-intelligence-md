# Agenda-Intelligence.md

<p align="left">
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/stargazers"><img src="https://img.shields.io/github/stars/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Stars"></a>
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/network/members"><img src="https://img.shields.io/github/forks/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Forks"></a>
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/issues"><img src="https://img.shields.io/github/issues/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Issues"></a>
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/commits/main"><img src="https://img.shields.io/github/last-commit/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Last Commit"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License"></a>
</p>

**A markdown protocol for AI agents that need to analyze the public agenda instead of summarizing it badly.**

Most agent-written news analysis has the same problem: it tells you what happened, then adds a few polished paragraphs that do not change any decision.

Agenda-Intelligence.md is a small set of markdown files that gives agents a stricter workflow:

```text
Fact → Assessment → Assumption → Unknown → Scenario → Indicator to watch
```

Use it when an agent needs to reason about policy, geopolitics, regulation, sanctions, trade, energy, elections, conflicts, or market-moving public agenda.

---

## What this does

It pushes an agent to answer better questions:

- Is this noise, weak signal, signal, structural shift, or trigger event?
- What actually changed?
- Who gains or loses leverage?
- Which incentives shifted?
- What is still unknown?
- What would confirm or falsify this view?
- What should be watched next?

The goal is not longer analysis. The goal is less filler and more decision value.

---

## How to use it

Copy or reference the markdown files in your agent setup:

```text
skills/agenda-intelligence/references/analysis-protocol.md
skills/agenda-intelligence/references/agenda-triage.md
skills/agenda-intelligence/references/evidence-discipline.md
skills/agenda-intelligence/references/output-patterns.md
```

For repo-level agent instructions, link the base protocol from your `AGENTS.md`, system prompt, retrieval layer, or tool-specific skill wrapper.

Example instruction:

```text
Before analyzing public agenda, use Agenda-Intelligence.md.
Do not summarize by default. Classify the signal, identify what changed, separate fact from assessment, name the main uncertainty, and end with watch-next indicators.
```

The repository also includes an OpenClaw-compatible skill wrapper, but the useful part is plain markdown and portable.



---

## 10-second demo

Without Agenda-Intelligence.md:

```text
Companies should monitor developments and prepare for possible regulatory changes.
```

With Agenda-Intelligence.md:

```text
Watch for regulator guidance, first enforcement action, compliance deadline, and company product redesigns. Treat this as a signal until those indicators appear.
```

The difference is not style. It is decision value.

---

## Copy-paste setup

Fastest path: copy [`Agenda-Intelligence.md`](Agenda-Intelligence.md) into your repo next to `AGENTS.md`.

Then add this to your agent instructions:

```md
## Agenda analysis

When analyzing public agenda, news, policy, regulation, sanctions, geopolitics, trade, elections, conflicts, markets, or strategic risk, follow `Agenda-Intelligence.md`.

Do not summarize by default. Classify the signal, identify what changed, separate fact from assessment, name uncertainty, and end with watch-next indicators.

Load it conditionally. Do not add it to every task.
```

For deeper setups, also copy the relevant reference files from `skills/agenda-intelligence/references/`.

---

## Default output shape

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


---

## Before / after examples

The repo includes concrete examples showing the failure mode this file is meant to fix.

Without the protocol:

```text
recap → generic implications → “monitor developments”
```

With Agenda-Intelligence.md:

```text
signal classification → what changed → affected actors → uncertainty → scenarios → watch-next indicators
```

Examples:

- [EU AI Act implementation signal](examples/before-after/eu-ai-act.md)
- [Red Sea shipping disruption](examples/before-after/red-sea-shipping.md)
- [Sanctions routing through Central Asia](examples/before-after/sanctions-routing.md)
- [Evaluation rubric](examples/before-after/evaluation-rubric.md)

---

## What it is good for

- research and news agents;
- policy and geopolitical agenda tracking;
- sanctions and compliance monitoring;
- trade and regulatory risk briefs;
- founder/investor operating-context notes;
- NGO/donor context monitoring;
- election and diplomatic signal analysis;
- red-team checks on confident narratives.

---

## What it is not

- not legal advice;
- not investment advice;
- not an intelligence-certainty machine;
- not a news summarizer;
- not a replacement for source verification.

If live verification was not performed, the agent should say so.


---

## How it relates to AGENTS.md

`AGENTS.md` tells an agent how to operate.
`Agenda-Intelligence.md` tells an agent how to reason about public agenda.

Use `AGENTS.md` globally. Use `Agenda-Intelligence.md` conditionally when the task involves news, policy, regulation, sanctions, geopolitics, trade, elections, conflicts, markets, or strategic risk.

In practice, it can sit next to the usual agent files:

```text
AGENTS.md      = operating rules
SOUL.md        = voice and stance
TOOLS.md       = tool discipline
IDENTITY.md    = agent identity
USER.md        = user preferences
HEARTBEAT.md   = proactive behavior
MEMORY.md      = durable context
Agenda-Intelligence.md = public-agenda reasoning protocol
```

Minimal `AGENTS.md` hook:

```md
## Agenda analysis

When analyzing public agenda, policy, regulation, sanctions, geopolitics, trade, elections, conflicts, markets, or strategic risk, follow `Agenda-Intelligence.md`.

Do not summarize by default. Classify the signal, identify what changed, separate fact from assessment, name uncertainty, and end with watch-next indicators.
```

The important part is conditional loading. Do not spend context on agenda analysis rules when the task is ordinary coding, writing, or personal assistance.

---

## Regional lens packs

Agenda-Intelligence.md can be extended with lightweight regional thinking layers. These are not full specialist skills; they are portable checklists that help any agent reason better about a specific region.

Available lens packs:

- [Central Asia + Caspian](skills/agenda-intelligence/references/regional/central-asia-caspian.md) — sanctions routing, corridor politics, Caspian chokepoints, banking/payment exposure, state leverage, energy, minerals, and regional political economy.
- [Middle East](skills/agenda-intelligence/references/regional/middle-east.md) — escalation risk, energy flows, maritime chokepoints, sovereign capital, sanctions exposure, normalization, and regional power competition.
- [European Union](skills/agenda-intelligence/references/regional/eu.md) — regulation, sanctions, trade defense, digital rules, climate policy, market access, coalition politics, and enforcement risk.

Use the base protocol first, then add the regional lens when the agenda item has a clear regional connection.


---

## Sector lens packs

Sector lenses add domain-specific checks for high-risk agenda areas. They are not legal, financial, or technical advice; they are reasoning checklists for agents.

Available sector packs:

- [Sanctions](skills/agenda-intelligence/references/sector/sanctions.md) — designations, enforcement, export controls, routing, ownership/control, financial channels, licenses, and compliance exposure.

Use the base protocol first, then add the sector lens when the agenda item has a clear domain connection.

---

## Relationship to global-think-tank-analyst

Agenda-Intelligence.md is the lightweight, portable agenda-analysis protocol.
It is for any AI agent that needs to stop summarizing news and start identifying signal, uncertainty, scenarios, and watch-next indicators.

For full policy-risk memos, use [global-think-tank-analyst](https://github.com/vassiliylakhonin/global-think-tank-analyst).
That repository is the deeper OpenClaw/Codex analyst for geopolitical, sanctions, trade, regulatory, and strategic-risk memos.

Use them together like this:

```text
Agenda-Intelligence.md = small universal protocol for agenda triage
global-think-tank-analyst = full memo skill for decision-ready policy risk analysis
```

---

## Repository structure

```text
Agenda-Intelligence.md
skills/agenda-intelligence/
  SKILL.md
  references/
    analysis-protocol.md
    agenda-triage.md
    evidence-discipline.md
    output-patterns.md
    regional/
      central-asia-caspian.md
      middle-east.md
      eu.md
    sector/
      sanctions.md
examples/
  compact-brief.md
  red-team-brief.md
  central-asia-caspian-brief.md
  middle-east-brief.md
  eu-brief.md
  sector/
    sanctions-brief.md
  before-after/
    eu-ai-act.md
    red-sea-shipping.md
    sanctions-routing.md
llms.txt
```

---

## Design principle

Keep the loaded context small.

`SKILL.md` is only a wrapper. The deeper markdown files are pulled or copied only when needed:

- `analysis-protocol.md` — how the agent should think;
- `agenda-triage.md` — how to classify developments;
- `evidence-discipline.md` — how to handle uncertainty and sources;
- `output-patterns.md` — ready-to-use brief formats;
- `regional/central-asia-caspian.md` — regional lens for Central Asia + Caspian agenda analysis;
- `regional/middle-east.md` — regional lens for Middle East agenda analysis;
- `regional/eu.md` — regional lens for European Union agenda analysis;
- `sector/sanctions.md` — sector lens for sanctions and export-control agenda analysis.

---

## License

MIT
