# ADOPTION.md

How to use Agenda Intelligence MD in agent projects.

This repo is two things:
1. **A markdown protocol** (`Agenda-Intelligence.md`) — drop this file into any agent repo to improve agenda reasoning.
2. **A CLI + MCP server + JSON schemas** (`pip install agenda-intelligence-md`) — use these to validate, score, and audit agent output in CI pipelines or agent loops.

The sections below cover both. Start with whichever fits your setup.

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

## Use in CI pipelines

Install the package and drop validation into any pipeline that produces agent briefs:

```bash
pip install agenda-intelligence-md

# Validate brief structure
agenda-intelligence validate-brief path/to/brief.json

# Validate evidence pack
agenda-intelligence validate-evidence path/to/evidence.json

# Score with minimum threshold (exits non-zero if below)
agenda-intelligence score path/to/brief.json --evidence path/to/evidence.json --min-score 70

# Run full validation + audit + score across a directory of cases
agenda-intelligence bench examples/source-backed --strict --min-score 80
```

`validate-brief` and `validate-evidence` behave like linters: zero exit on success, non-zero on failure. Wire them into GitHub Actions, pre-commit, or any CI step that gates agent output.

## Use via MCP

The package ships a stdio MCP server. Any MCP-compatible host (Claude Desktop, Cursor, Codex) can call validation, audit, and scoring tools directly inside the agent loop.

```bash
# Print MCP client config for your host
agenda-intelligence mcp-config --client cursor
agenda-intelligence mcp-config --client claude-desktop
agenda-intelligence mcp-config --client codex

# Verify MCP server is working
agenda-intelligence doctor
```

Available MCP tools: `validate_brief`, `validate_evidence`, `audit_claims`, `score_output`, `get_protocol`, `list_lenses`, `get_lens`, `list_source_categories`, `source_plan`, `source_coverage`, `verify_quotes`. See [`MCP.md`](MCP.md) for details.

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
