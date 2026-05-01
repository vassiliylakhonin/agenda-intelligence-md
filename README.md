# Agenda-Intelligence.md

<p align="left">
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/stargazers"><img src="https://img.shields.io/github/stars/vassiliylakhonin/agenda-intelligence-md?style=for-the-badge" alt="Stars"></a>
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/network/members"><img src="https://img.shields.io/github/forks/vassiliylakhonin/agenda-intelligence-md?style=for-the-badge" alt="Forks"></a>
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/issues"><img src="https://img.shields.io/github/issues/vassiliylakhonin/agenda-intelligence-md?style=for-the-badge" alt="Issues"></a>
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/commits/main"><img src="https://img.shields.io/github/last-commit/vassiliylakhonin/agenda-intelligence-md?style=for-the-badge" alt="Last Commit"></a>
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/releases/tag/v0.4.1"><img src="https://img.shields.io/badge/release-v0.4.1-blue?style=for-the-badge" alt="Release v0.4.1"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License"></a>
</p>

**A drop‑in markdown cognition layer for AI agents that need to analyse public agenda instead of summarising it poorly.**

## Quick install
```bash
pip install agenda-intelligence-md   # or `pip install -e .` for development
```

## CLI usage (new console script)
```bash
agenda-intelligence --help
# Validate a brief
agenda-intelligence validate-brief examples/agenda-brief.json
# Validate an evidence pack
agenda-intelligence validate-evidence examples/source/evidence-pack.json
# List source categories
agenda-intelligence source-types
# Show a source plan for a category
agenda-intelligence source-plan technology-ai
```

The CLI now uses **jsonschema** for deep validation and supports additional commands:
- `validate-manifest`
- `list-lenses` (optional `--type`)
- `get-lens <type> <id>`
- `get-protocol <name>`
- `score [example.md]`

## Documentation
Detailed docs live in the `docs/` folder:
- `docs/quickstart.md` – getting started guide.
- `docs/integrations/` – adapters for Claude Code, OpenAI Codex, Cursor, and MCP.
- `docs/evaluation.md` – how the heuristic scoring works.
- `ROADMAP.md` – future plans.

## Project structure (high‑level)
```
agenda-intelligence-md/
├─ src/agenda_intelligence/        # Python package
│   ├─ __init__.py
│   ├─ cli.py                     # console entry point
│   └─ mcp_server.py              # MCP skeleton (Phase 6)
├─ schemas/                        # JSON schemas
├─ examples/                       # sample JSON files
├─ docs/                           # documentation
├─ tests/                          # pytest suite
├─ pyproject.toml                  # packaging
└─ ...
```

## Backwards compatibility
The original `scripts/agenda_intelligence.py` is retained for legacy use, but the recommended entry point is the installed `agenda-intelligence` command.

---

*The repository still contains the original markdown protocol files (e.g., `Agenda-Intelligence.md`, `SOURCE_POLICY.md`, lens packs). They remain the source of truth for agents.*

<p align="left">
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/stargazers"><img src="https://img.shields.io/github/stars/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Stars"></a>
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/network/members"><img src="https://img.shields.io/github/forks/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Forks"></a>
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/issues"><img src="https://img.shields.io/github/issues/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Issues"></a>
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/commits/main"><img src="https://img.shields.io/github/last-commit/vassiliylakhonin/Agenda-Intelligence-md?style=for-the-badge" alt="Last Commit"></a>
  <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/releases/tag/v0.4.0"><img src="https://img.shields.io/badge/release-v0.4.0-blue?style=for-the-badge" alt="Release v0.4.0"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License"></a>
</p>

**A drop-in markdown cognition layer for AI agents that need to analyze public agenda instead of summarizing it badly.**

Most agent-written news analysis has the same problem: it tells you what happened, adds polished implications, and stops before the output changes any decision.

Agenda-Intelligence.md gives agents a stricter workflow and an optional reasoning-memory layer called **AnalysisBank**:

```text
Fact → Assessment → Assumption → Unknown → Scenario → Indicator to watch
```

Use it when an agent needs to reason about policy, geopolitics, regulation, sanctions, trade, energy, elections, conflicts, or market-moving public agenda.



---

## What's new in v0.4.0

v0.4.0 adds a general **Source Acquisition Layer**.

Reasoning is not enough. Agents need to know which source types are required before making claims about sanctions, regulation, elections, conflict, energy, trade, financial markets, AI/technology, or regional risk.

Added:

- `SOURCE_POLICY.md` — source discipline rules;
- `source-taxonomy.json` — machine-readable source types;
- `source-requirements/*.json` — source plans by agenda category;
- `schemas/evidence-pack.schema.json` — evidence pack contract;
- `examples/source/evidence-pack.json` — valid example;
- CLI commands: `source-types`, `list-source-packs`, `source-plan`, `validate-evidence`.

---

## What's new in v0.3.0

v0.3.0 turns Agenda-Intelligence.md into a more agent-first package.

Added:

- `agent-manifest.json` for machine-readable discovery;
- JSON schemas for agenda briefs, memory cards, lens manifests, and signal classifications;
- `scripts/agenda_intelligence.py` CLI for agents and humans;
- `MCP.md` sketch for future MCP tools;
- `examples/agenda-brief.json` for schema validation.

---

## What's new in v0.2.0

v0.2.0 adds **AnalysisBank**, a ReasoningBank-inspired memory layer for agenda-analysis agents.

Instead of only giving an agent a protocol, AnalysisBank lets the project store short reusable reasoning memories from successful and failed outputs:

```text
weak output → identify failure pattern → write memory card → retrieve next time
strong output → extract reusable reasoning pattern → write memory card → retrieve next time
```

It also adds a lightweight eval harness:

```bash
python3 scripts/eval_before_after.py
```

Current test results:

```text
eu-ai-act.md:          before 3/16  → after 14/16
red-sea-shipping.md:  before 1/16  → after 13/16
sanctions-routing.md: before 2/16  → after 14/16
```

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
analysis-bank/README.md
```

For repo-level agent instructions, link the base protocol from your `AGENTS.md`, system prompt, retrieval layer, or tool-specific skill wrapper.

Example instruction:

```text
Before analyzing public agenda, use Agenda-Intelligence.md.
Do not summarize by default. Classify the signal, identify what changed, separate fact from assessment, name the main uncertainty, and end with watch-next indicators.
```

The repository also includes an OpenClaw-compatible skill wrapper, but the useful part is plain markdown and portable.




---

## Built for agents

Agenda-Intelligence.md is designed to be consumed by agents, not just read by humans.

Agents can:

- discover the package through [`agent-manifest.json`](agent-manifest.json);
- load the entrypoint file with a stable path;
- select regional and sector lenses programmatically;
- validate structured outputs against JSON schemas;
- run a lightweight CLI;
- score before/after examples with the eval harness;
- store reusable reasoning memories in AnalysisBank.

Agent-first files:

```text
agent-manifest.json
schemas/agenda-brief.schema.json
schemas/memory-card.schema.json
schemas/lens-manifest.schema.json
schemas/signal-classification.schema.json
scripts/agenda_intelligence.py
SOURCE_POLICY.md
source-taxonomy.json
source-requirements/*.json
MCP.md
```

CLI examples:

```bash
python3 scripts/agenda_intelligence.py manifest
python3 scripts/agenda_intelligence.py list-lenses
python3 scripts/agenda_intelligence.py get-lens regional eu
python3 scripts/agenda_intelligence.py get-protocol entrypoint
python3 scripts/agenda_intelligence.py validate-brief examples/agenda-brief.json
python3 scripts/agenda_intelligence.py source-plan technology-ai
python3 scripts/agenda_intelligence.py validate-evidence examples/source/evidence-pack.json
python3 scripts/agenda_intelligence.py score
```

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

## Source Acquisition Layer

Agenda-Intelligence.md separates reasoning from evidence.

Before writing a high-stakes or current brief, an agent should generate a source plan:

```text
Task → source requirement category → required evidence → unsupported claims → brief
```

Available source requirement categories:

- sanctions
- regulation
- elections
- conflict-security
- energy
- trade
- financial-market
- technology-ai
- regional-risk

CLI examples:

```bash
python3 scripts/agenda_intelligence.py source-types
python3 scripts/agenda_intelligence.py list-source-packs
python3 scripts/agenda_intelligence.py source-plan technology-ai
python3 scripts/agenda_intelligence.py validate-evidence examples/source/evidence-pack.json
```

If live retrieval fails, the agent should say so and downgrade evidence mode instead of pretending the brief is source-backed.

---

## AnalysisBank

[AnalysisBank](analysis-bank/README.md) is the ReasoningBank-inspired layer for Agenda-Intelligence.md.

The base protocol tells an agent how to analyze public agenda. AnalysisBank helps it improve across tasks by storing compact reasoning memories from both good and bad outputs.

Current memory cards include:

- vague monitoring → concrete indicators;
- overconfident sanctions upgrades → evidence thresholds;
- EU rhetoric treated as law → institutional-path check;
- sanctions routing → mechanism-first signal classification.

Memory format:

```text
Trigger → Pattern → Better reasoning → Apply when → Do not apply when → Watch indicators → Example rewrite
```

Eval harness:

```bash
python3 scripts/eval_before_after.py
```

The eval checks that after examples score higher than generic before examples on signal classification, actor specificity, uncertainty, falsifiability, watch-next indicators, and decision value.

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
ADOPTION.md
agent-manifest.json
MCP.md
SOURCE_POLICY.md
source-taxonomy.json
source-requirements/
  sanctions.json
  regulation.json
  elections.json
  conflict-security.json
  energy.json
  trade.json
  financial-market.json
  technology-ai.json
  regional-risk.json
analysis-bank/
  README.md
  MEMORY_FORMAT.md
  failures/
  successes/
  prompts/
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
schemas/
  agenda-brief.schema.json
  memory-card.schema.json
  lens-manifest.schema.json
  signal-classification.schema.json
  evidence-pack.schema.json
scripts/
  agenda_intelligence.py
  validate.py
  eval_before_after.py
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
