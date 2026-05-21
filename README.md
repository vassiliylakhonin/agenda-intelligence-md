# Agenda Intelligence MD

Product entry point and evidence-discipline layer for strategic intelligence agents.

[![PyPI version](https://img.shields.io/pypi/v/agenda-intelligence-md?style=flat-square)](https://pypi.org/project/agenda-intelligence-md/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Agenda Intelligence** is an MCP product shell and evidence-discipline layer for strategic intelligence agents. Structured request/memo contract, geography-routed reasoning, schema validation, evidence audit, and scoring. One MCP server. Structured input/output. No live retrieval, no factual verification — those are explicit non-goals before v1.0.

This repository hosts the product entry point: JSON schemas defining the request/response contract, the stdio MCP server exposing `analyze`, `validate_memo`, `list_signals`, `get_signal`, and `deep_dive`, plus the original validation surface (briefs, evidence packs, audits, lenses, source plans). Reasoning content is bundled as in-repo references derived from sibling repositories: [Global Think Tank Analyst](https://github.com/vassiliylakhonin/global-think-tank-analyst) (method), [Central Asia + Caspian](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill) and [Gulf + Middle East](https://github.com/vassiliylakhonin/gulf-middle-east-hybrid-intelligence-skill) (regional specialists routed by query geography).

## What this is

- **MCP product shell** — `analyze` accepts a structured request (`agenda-request.schema.json`), routes geography to the relevant regional specialist, assembles a system prompt, and returns a memo validated against `agenda-memo.schema.json`
- **Markdown protocol** — structured reasoning workflow for agents (`Agenda-Intelligence.md`)
- **JSON schemas** — request/memo product contract plus validators for briefs, evidence packs, audits, signals, memory cards, lenses
- **CLI** — `validate-brief`, `validate-evidence`, `source-categories`, `source-coverage`, `audit-claims`, `score`, `bench`, `doctor` (30+ commands)
- **MCP server** — stdio server exposing 16 tools across the validation and product layers
- **Eval kit** — rubric, LLM-judge prompt, human checklist, benchmark harness, agent-eval methodology
- **Source policy** — per-claim provenance tags (Axis A/B), source requirements for 12 categories

## What this is not

- Not a factuality verifier — checks structure, not truth
- Not an autonomous news agent or source retriever
- Not a source reputation scorer or live news gatherer
- Not a replacement for analyst judgment
- Not a compliance, legal, or financial advisory product

## Quickstart

```bash
pip install agenda-intelligence-md
# Add the optional [llm] extra to let the MCP `analyze` tool call the
# Anthropic API directly (otherwise the host model completes from the
# returned system_prompt):
#   pip install "agenda-intelligence-md[llm]"
#   export ANTHROPIC_API_KEY=...
#
# Or pinned wheel:
# pip install https://github.com/vassiliylakhonin/agenda-intelligence-md/releases/download/v0.9.2/agenda_intelligence_md-0.9.2-py3-none-any.whl

agenda-intelligence validate-brief examples/agenda-brief.json
agenda-intelligence score examples/agenda-brief.json --evidence examples/source/evidence-pack.json
agenda-intelligence bench examples/source-backed --strict --min-score 80
agenda-intelligence doctor
agenda-intelligence mcp-config --client cursor
```

## Benchmark baseline

20 source-backed cases, reproduced with `agenda-intelligence bench examples/source-backed/`:

| Metric | Value |
|---|---|
| Cases | 20 |
| Mean score | 87.6 / 100 |
| Min / max | 84 / 91 |
| Schema-valid | 100% |
| With evidence pack | 100% |
| With claim-level audit | 100% |
| With source category | 100% |
| Mean source coverage | 14.8% |
| Source coverage gap cases | 20 |
| Orphan evidence refs | 0 |

Heuristic scores are uncalibrated and not validated against expert judgment. They evaluate structure, evidence labeling, source-coverage diagnostics, and decision-readiness — not factual truth.

Flagship example: [`examples/source-backed/eu-ai-act.md`](examples/source-backed/eu-ai-act.md) — brief + evidence pack + claim-level audit using illustrative sources. Before / after pairs: [`examples/before-after/`](examples/before-after/).

## Verification Contract

`verify-quotes` checks whether a cited quote or excerpt appears in supplied local text, or in text fetched from an already-specified URL when `--fetch` is used. It does not discover sources, score source reputation, gather live news, or decide whether a claim is true in the world.

## Schemas

| Schema | Purpose |
|---|---|
| [`agenda-brief.schema.json`](schemas/agenda-brief.schema.json) | Brief structure |
| [`evidence-pack.schema.json`](schemas/evidence-pack.schema.json) | Evidence pack |
| [`evidence-audit.schema.json`](schemas/evidence-audit.schema.json) | Claim-level audit |
| [`signal-tracker.schema.json`](schemas/signal-tracker.schema.json) | Signal lifecycle |
| [`memory-card.schema.json`](schemas/memory-card.schema.json) | AnalysisBank cards |
| [`lens-manifest.schema.json`](schemas/lens-manifest.schema.json) | Lens manifest |
| [`signal-classification.schema.json`](schemas/signal-classification.schema.json) | Signal taxonomy |

## MCP

Stdio MCP server with 16 tools. Full docs and wire-protocol verification: [`MCP.md`](MCP.md). Client setup: [`docs/integrations/mcp.md`](docs/integrations/mcp.md).

| Tool | What it does |
|---|---|
| `validate_brief` | Validate a brief dict against `agenda-brief.schema.json` |
| `validate_evidence` | Validate an evidence-pack dict against `evidence-pack.schema.json` |
| `audit_claims` | Check claim-level audit: support distribution, orphan refs, unsupported claims |
| `score_output` | Heuristic score for structure, evidence labeling, decision-readiness |
| `get_protocol` | Return the full Agenda-Intelligence.md reasoning protocol |
| `list_source_categories` | List source requirement categories before calling `source_plan` |
| `source_plan` | Generate a source plan for a given topic |
| `source_coverage` | Diagnose evidence-pack coverage against category source requirements |
| `verify_quotes` | Check cited quote fragments in caller-provided text |
| `list_lenses` | List available lens packs |
| `get_lens` | Return a specific lens pack by name |
| `analyze` | Product-shell pipeline: validate request, route modules, assemble prompt, optionally call LLM, validate memo |
| `validate_memo` | Validate an Agenda memo against `agenda-memo.schema.json` |
| `list_signals` | List vendored signal archive entries |
| `get_signal` | Return a vendored signal markdown file by id |
| `deep_dive` | Planned v2 placeholder directing callers to `analyze` depth modes |

## Status

| Component | Status |
|---|---|
| Markdown protocol, JSON schemas | Stable |
| CLI (validate, score, bench, audit, doctor) | Stable |
| MCP stdio server | Stable |
| Evidence-audit schema (claim-level) | Stable |
| Signal-tracker schema (lifecycle) | Stable |
| Heuristic scoring | Stable (uncalibrated) |
| Live source retrieval | Not implemented |
| Factual-truth verification | Not in scope |

## Documentation

| Resource | Link |
|---|---|
| Quickstart | [`docs/quickstart.md`](docs/quickstart.md) |
| Tutorial | [`docs/tutorial.md`](docs/tutorial.md) |
| Evaluation layers | [`docs/evaluation.md`](docs/evaluation.md) |
| Agent-eval methodology | [`docs/agent-eval-methodology.md`](docs/agent-eval-methodology.md) |
| Factual verification boundary | [`docs/factual-verification.md`](docs/factual-verification.md) |
| Source plan coverage boundary | [`docs/source-plan-coverage.md`](docs/source-plan-coverage.md) |
| Evidence audit | [`docs/evidence-audit.md`](docs/evidence-audit.md) |
| Threat model | [`docs/threat-model.md`](docs/threat-model.md) |
| Integrations | [`docs/integrations/`](docs/integrations/) |
| Use-cases | [`docs/use-cases/`](docs/use-cases/) |
| Agent contract | [`AGENTS.md`](AGENTS.md) |
| Adoption guide | [`ADOPTION.md`](ADOPTION.md) |
| Changelog | [`CHANGELOG.md`](CHANGELOG.md) |
| Roadmap | [`ROADMAP.md`](ROADMAP.md) |

## Repository layout

```
agenda-intelligence-md/
├─ src/agenda_intelligence/   # Python package (CLI + MCP server)
├─ schemas/                   # JSON schemas
├─ examples/                  # briefs, evidence packs, before/after
├─ skills/                    # OpenClaw skill wrappers
├─ evals/                     # rubric, judge prompt, benchmark
├─ analysis-bank/             # agent persistent memory (memory-card schema, see schemas/memory-card.schema.json)
├─ docs/                      # guides, integrations, use-cases
├─ scripts/                   # dev and CI helpers
└─ tests/                     # pytest suite
```

## Contact

**Vassiliy Lakhonin** — Almaty, Kazakhstan (UTC+5)

[Portfolio](https://vassiliylakhonin.github.io/) ·
[For analysts](https://vassiliylakhonin.github.io/for-analysts.html) ·
[Email](mailto:vassiliy.lakhonin@gmail.com) ·
[LinkedIn](https://www.linkedin.com/in/vassiliy-lakhonin/) ·
[GitHub](https://github.com/vassiliylakhonin)

Issues, PRs, and eval-case contributions are welcome.

## License

MIT.

---

**Disclaimer.** This toolkit is for informational and educational purposes only. It does not constitute investment, financial, legal, compliance, or trading advice. It does not verify factual truth, predict outcomes, or replace professional judgment. Use at your own risk.

---

mcp-name: io.github.vassiliylakhonin/agenda-intelligence-md
