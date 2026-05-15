# Claude Code working rules

This repository is Agenda Intelligence MD.

It is the evidence and eval infrastructure layer for strategic intelligence agents: validation, JSON schemas, evidence audit, scoring, and CLI / MCP / CI tooling.

It is NOT:
- a domain-reasoning skill (that is Global Think Tank Analyst);
- a vertical specialist skill (that is Central Asia & Caspian, Gulf & Middle East, and similar repos);
- a live source-retrieval engine, agenda/meeting summarizer, or compliance product.

Treat AGENTS.md as the canonical source of truth for project identity and rules.

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

Keep the boundary clear:
- this repo handles validation, schemas, evidence audit, scoring, and CLI / MCP / CI tooling for strategic-intelligence agent outputs;
- domain reasoning belongs in Global Think Tank Analyst;
- vertical specialist depth belongs in the relevant skill repository (Central Asia & Caspian, Gulf & Middle East, etc.).

## Definition of done

Before finishing, report:
1. what changed;
2. why it matters;
3. what was not changed;
4. how I can verify it;
5. risks or follow-ups.
