@AGENTS.md

# Claude Code working rules

AGENTS.md is the canonical project contract: identity, scope, boundaries, honesty rules, relationship to Global Think Tank Analyst and vertical specialists, retrieved-content trust. Follow it. Do not re-derive or restate those rules — apply them.

Runtime skill contracts live in [skills/agenda-intelligence/SKILL.md](skills/agenda-intelligence/SKILL.md) and [skills/source-ingest/SKILL.md](skills/source-ingest/SKILL.md).

This file (CLAUDE.md) contains only Claude-Code-specific working rules for this repo, on top of the global ~/.claude/CLAUDE.md.

## Project-specific paths to inspect

In addition to the global pre-edit checklist:
- pyproject.toml
- Makefile
- scripts/
- schemas/
- examples/
- evals/
- tests/
- skills/
- src/agenda_intelligence/
- source-requirements/
- .github/workflows/

## Critical invariant: dual-copy data/ sync

The repo keeps two copies of several files — top-level AND under `src/agenda_intelligence/data/`. These MUST stay in sync or CI breaks (enforced by `tests/test_package_consistency.py`):

- `Agenda-Intelligence.md` ↔ `src/agenda_intelligence/data/Agenda-Intelligence.md`
- `SOURCE_POLICY.md` ↔ `src/agenda_intelligence/data/SOURCE_POLICY.md`
- `llms.txt` ↔ `src/agenda_intelligence/data/llms.txt`
- `agent-manifest.json` ↔ `src/agenda_intelligence/data/agent-manifest.json`
- `schemas/*.json` ↔ `src/agenda_intelligence/data/schemas/*.json`
- `skills/**` ↔ `src/agenda_intelligence/data/skills/**`
- `source-requirements/*` ↔ `src/agenda_intelligence/data/source-requirements/*`

When changing any of these, change the paired copy in the same commit. Version bumps in particular must propagate to packaged copies or release CI fails.

## Validators before push

Mirror the CI checks locally before pushing:

```
make ci
python3 -m agenda_intelligence.cli validate-manifest
python3 -m agenda_intelligence.cli validate-brief examples/agenda-brief.json
python3 -m agenda_intelligence.cli validate-evidence examples/source/evidence-pack.json
python3 scripts/validate.py
python3 scripts/validate_public_examples.py
```

For MCP smoke check:

```
python3 -m agenda_intelligence.cli doctor --mcp-command "python3 -m agenda_intelligence.mcp_stdio" --strict
```

## Working style in this repo

Small, reviewable changes. Do not rewrite the project unless I explicitly ask.

Follow existing schema, CLI, and MCP patterns instead of inventing new ones. New schemas, validators, MCP tools, CLI subcommands, or workflow files require explicit approval — see AGENTS.md "Honesty rules" and the global "Code and repository changes" rule.

If a change touches release artifacts (version, packaged data, wheels) or any of the dual-copy paths above, verify the invariant before committing.
