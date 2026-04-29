# Agenda-Intelligence.md

<p align="left">
  <a href="https://github.com/vassiliylakhonin/Agenda-Intelligence-md/stargazers"><img src="https://img.shields.io/github/stars/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Stars"></a>
  <a href="https://github.com/vassiliylakhonin/Agenda-Intelligence-md/network/members"><img src="https://img.shields.io/github/forks/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Forks"></a>
  <a href="https://github.com/vassiliylakhonin/Agenda-Intelligence-md/issues"><img src="https://img.shields.io/github/issues/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Issues"></a>
  <a href="https://github.com/vassiliylakhonin/Agenda-Intelligence-md/commits/main"><img src="https://img.shields.io/github/last-commit/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Last Commit"></a>
  <a href="https://clawhub.ai/vassiliylakhonin/agenda-intelligence"><img src="https://img.shields.io/badge/ClawHub-install-blue?style=for-the-badge" alt="Install on ClawHub"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License"></a>
</p>

**Stop your AI agent from summarizing the news. Make it identify what changed, why it matters, what is uncertain, and what to watch next.**

Agenda-Intelligence.md is a compact markdown analysis layer for AI agents. It turns messy public agenda — policy moves, elections, sanctions, conflicts, regulation, trade disputes, institutional signals, diplomatic statements — into decision-ready briefs.

---

## Why this exists

Most AI news analysis is weak in the same ways:

- it recaps events instead of explaining what changed;
- it sounds confident while hiding uncertainty;
- it treats all actors as equally important;
- it produces polished paragraphs with no decision value;
- it forecasts without indicators or falsification tests.

This skill gives agents a stricter protocol:

```text
Fact → Assessment → Assumption → Unknown → Scenario → Indicator to watch
```

The result is shorter, cleaner, and more useful analysis.

---

## Install

```bash
clawhub install agenda-intelligence
```

Install pinned version:

```bash
clawhub install agenda-intelligence --version 0.1.0
```

---

## Typical use

```text
Use $agenda-intelligence to analyze today’s EU sanctions discussion. I need what changed, who is affected, main uncertainty, scenarios, and watch-next indicators.
```

```text
Use $agenda-intelligence on this policy announcement. Do not summarize it; tell me whether it is signal, noise, weak signal, structural shift, or trigger event.
```

```text
Use $agenda-intelligence to brief a founder on how this AI regulation news changes risk, timing, and optionality.
```

---

## Output highlights

Default compact brief:

1. **Bottom line** — one direct judgment.
2. **Signal classification** — noise / weak signal / signal / structural shift / trigger event.
3. **What changed** — the delta, not the recap.
4. **Who gains or loses leverage** — actors and incentives.
5. **Decision implications** — risk, timing, optionality.
6. **Competing interpretations** — where ambiguity matters.
7. **Unknowns** — what could change the assessment.
8. **Watch next** — concrete indicators.

---

## What it is good for

- policy and geopolitical agenda tracking;
- sanctions and compliance monitoring;
- trade and regulatory risk briefs;
- founder/investor risk notes;
- NGO/donor operating-context briefs;
- election and diplomatic signal analysis;
- red-team checks on confident narratives.

---

## What it is not

- not legal advice;
- not investment advice;
- not an intelligence-certainty machine;
- not a news summarizer;
- not a replacement for source verification.

If live verification was not performed, the agent must say so.

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
examples/
  compact-brief.md
  red-team-brief.md
llms.txt
```

---

## Design principle

Keep the loaded context small.

`SKILL.md` is the router. The deeper markdown files are pulled only when needed:

- `analysis-protocol.md` — how the agent should think;
- `agenda-triage.md` — how to classify developments;
- `evidence-discipline.md` — how to handle uncertainty and sources;
- `output-patterns.md` — ready-to-use brief formats.

---

## License

MIT
