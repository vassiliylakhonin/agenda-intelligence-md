# Agenda-Intelligence.md

<p align="left">
  <a href="https://github.com/vassiliylakhonin/Agenda-Intelligence-md/stargazers"><img src="https://img.shields.io/github/stars/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Stars"></a>
  <a href="https://github.com/vassiliylakhonin/Agenda-Intelligence-md/network/members"><img src="https://img.shields.io/github/forks/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Forks"></a>
  <a href="https://github.com/vassiliylakhonin/Agenda-Intelligence-md/issues"><img src="https://img.shields.io/github/issues/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Issues"></a>
  <a href="https://github.com/vassiliylakhonin/Agenda-Intelligence-md/commits/main"><img src="https://img.shields.io/github/last-commit/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Last Commit"></a>
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

## Regional lens packs

Agenda-Intelligence.md can be extended with lightweight regional thinking layers. These are not full specialist skills; they are portable checklists that help any agent reason better about a specific region.

Available lens packs:

- [Central Asia + Caspian](skills/agenda-intelligence/references/regional/central-asia-caspian.md) — sanctions routing, corridor politics, Caspian chokepoints, banking/payment exposure, state leverage, energy, minerals, and regional political economy.
- [Middle East](skills/agenda-intelligence/references/regional/middle-east.md) — escalation risk, energy flows, maritime chokepoints, sovereign capital, sanctions exposure, normalization, and regional power competition.

Use the base protocol first, then add the regional lens when the agenda item has a clear regional connection.

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
examples/
  compact-brief.md
  red-team-brief.md
  central-asia-caspian-brief.md
  middle-east-brief.md
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
- `regional/middle-east.md` — regional lens for Middle East agenda analysis.

---

## License

MIT
