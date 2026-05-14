# Claude Code working rules

This repository is Agenda Intelligence MD.

It should remain a practical agenda-intelligence / meeting-intelligence / structured decision-support repository, focused on turning agendas, discussions, notes, decisions, risks, and follow-ups into clear, useful, auditable markdown-based intelligence.

## How to work in this repo

Before editing, inspect relevant project files when present:
- README.md
- CLAUDE.md
- AGENTS.md
- SKILL.md
- llms.txt
- package.json
- pyproject.toml
- requirements.txt
- Makefile
- justfile
- examples/
- docs/
- tests/
- .github/workflows/

Prefer small, safe, reviewable changes.

Do not rewrite the project unless explicitly asked.

Follow existing project patterns instead of inventing new architecture.

## Preserve project boundaries

Do not add or imply:
- production-grade guarantees;
- legal, compliance, financial, or security advice;
- autonomous decision-making;
- fake benchmarks or unsupported evaluation claims;
- live source retrieval unless already implemented;
- enterprise deployment guarantees;
- privacy/security guarantees that are not supported by the code.

Do not add new frameworks, services, dependencies, MCP servers, schemas, validators, CLIs, CI pipelines, or deployment infrastructure unless:
- this repository already clearly points in that direction;
- I explicitly ask for it;
- or you first explain the trade-off and get approval.

## Documentation rules

When editing docs, examples, prompts, templates, or markdown workflows:
- separate facts, decisions, assumptions, risks, open questions, owners, and next actions;
- preserve traceability from source notes to outputs when relevant;
- make outputs useful for both humans and AI agents;
- avoid hype and unsupported claims;
- keep language practical, conservative, and decision-useful.

If this repo connects to or supports other strategic-analysis skills, keep the boundary clear:
- this repo handles agenda / meeting / decision intelligence;
- domain-specific geopolitical or hybrid-risk analysis belongs in the relevant skill repository unless explicitly integrated here.

## Definition of done

Before finishing, report:
1. what changed;
2. why it matters;
3. what was not changed;
4. how I can verify it;
5. risks or follow-ups.
