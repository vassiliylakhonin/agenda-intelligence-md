# Agenda Intelligence MD

MCP product shell and evidence-discipline layer for strategic intelligence agents. Structured request/memo contract, geography-routed reasoning, schema validation, evidence audit, scoring. No live retrieval, no factual verification.

[![PyPI version](https://img.shields.io/pypi/v/agenda-intelligence-md?style=flat-square)](https://pypi.org/project/agenda-intelligence-md/) [![CI](https://github.com/vassiliylakhonin/agenda-intelligence-md/actions/workflows/ci.yml/badge.svg)](https://github.com/vassiliylakhonin/agenda-intelligence-md/actions/workflows/ci.yml) [![Agenstry A2A](https://agenstry.com/badge/agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/protocol.svg)](https://agenstry.com/agents/agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev) [![Agenstry uptime](https://agenstry.com/badge/agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/uptime.svg)](https://agenstry.com/agents/agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## First run

```bash
pip install agenda-intelligence-md
agenda-intelligence doctor
agenda-intelligence validate-brief examples/agenda-brief.json
agenda-intelligence score examples/agenda-brief.json --evidence examples/source/evidence-pack.json
```

`doctor` reports package and MCP-server status; `validate-brief` confirms a brief matches `agenda-brief.schema.json`; `score` returns a heuristic 0–100 number with a structure / evidence / decision-readiness breakdown. Full end-to-end analyze trace (request → routing → memo → validation → audit → score) with reproducibility script: [`examples/product-shell/full-analyze-trace/`](examples/product-shell/full-analyze-trace/).

Optional, only if you want `analyze` to call the Anthropic API itself rather than letting your host model complete from the returned system prompt:

```bash
pip install "agenda-intelligence-md[llm]"
export ANTHROPIC_API_KEY=...
```

Longer guided tutorial: [`docs/quickstart.md`](docs/quickstart.md). MCP client setup: [`docs/integrations/mcp.md`](docs/integrations/mcp.md).

## Live A2A wrapper

A free Cloudflare Workers wrapper is live for discovery, uptime checks, lightweight strategic-risk triage, and A2A/JSON-RPC routing:

- Live endpoint: <https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev>
- Agent Card: <https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json>
- JSON-RPC: <https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/message/send>
- Agenstry listing: <https://agenstry.com/agents/agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev>
- Kazakhstan / Middle Corridor Deal Risk Gate: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev>
- Kazakhstan Agenstry listing: <https://agenstry.com/agents/kazakhstan-corridor-risk-a2a.vassiliy-lakhonin.workers.dev>
- Announcement: [`docs/announcements/live-a2a-wrapper.md`](docs/announcements/live-a2a-wrapper.md)

The hosted wrapper is intentionally limited: no payments, no wallets, no autonomous live retrieval, no factual-truth verification, and no legal/financial/compliance advice. Full product behavior remains in the installable stdio MCP server.

## Flagship commercial use case

**Kazakhstan / Middle Corridor Deal Risk Gate** is the focused commercial proposition for logistics, trade-finance, procurement, insurance, and compliance-adjacent workflows:

> Route + cargo + counterparties + dated sources -> auditable corridor-risk triage, evidence gaps, source coverage, watch-next indicators, and human-review escalation.

Live A2A listing:

- Endpoint: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send>
- Agent card: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json>
- Agenstry: <https://agenstry.com/agents/kazakhstan-corridor-risk-a2a.vassiliy-lakhonin.workers.dev>
- Use-case notes: [`docs/use-cases/kazakhstan-middle-corridor.md`](docs/use-cases/kazakhstan-middle-corridor.md)
- Example pack: [`examples/kazakhstan-middle-corridor/`](examples/kazakhstan-middle-corridor/)
- Repeatable live test: [`docs/agenstry/kazakhstan-live-test.md`](docs/agenstry/kazakhstan-live-test.md)

This use case is a pre-compliance evidence and decision-readiness gate. It is not legal, compliance, sanctions, financial, investment, or insurance advice.

The product-grade structured JSON contract is documented in [`docs/use-cases/kazakhstan-middle-corridor.md`](docs/use-cases/kazakhstan-middle-corridor.md#product-contract), with schemas and fixtures under [`examples/kazakhstan-middle-corridor/contract/`](examples/kazakhstan-middle-corridor/contract/).

The structured response includes a `decision_readiness_score` from 0-100, so a buyer can see whether the evidence pack is ready for human review or still missing required source categories.

Try the Kazakhstan agent:

```bash
curl -X POST https://kazakhstan-corridor-risk-a2a.vassiliy-lakhonin.workers.dev/message/send \
  -H 'content-type: application/json' \
  -H 'x-client-id: live-demo' \
  -d @examples/kazakhstan-middle-corridor/live-agent-request.json
```

Expected: JSON-RPC 2.0 with `triage_recommendation: "escalate_before_signature"`, route/cargo/value extraction, supplied-source detection, missing minimum evidence before go, commercial-impact notes, and human-review escalation.

Try the live wrapper:

```bash
curl -X POST https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/message/send \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": "demo-1",
    "method": "message/send",
    "params": {
      "message": {
        "parts": [
          {
            "kind": "text",
            "text": "Screen sanctions and policy risk for Red Sea shipping disruption and Kazakhstan transit exposure."
          }
        ]
      }
    }
  }'
```

Kazakhstan-focused live triage:

```bash
curl -X POST https://kazakhstan-corridor-risk-a2a.vassiliy-lakhonin.workers.dev/message/send \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": "kazakhstan-demo-1",
    "method": "message/send",
    "params": {
      "message": {
        "parts": [
          {
            "kind": "text",
            "text": "Screen Kazakhstan Middle Corridor sanctions exposure for a logistics route."
          }
        ]
      }
    }
  }'
```

Expected: JSON-RPC 2.0 with `status.state: "completed"`, `metadata.signal_screen.risk_signal`, affected regions, required source categories, evidence gaps, watch-next indicators, suggested modules, and next actions.

Private usage stats for the wrapper are available from the Cloudflare Worker project:

```bash
cd deploy/cloudflare-worker
npm run stats
npm run stats -- 2026-05-22
```

The stats helper reads `STATS_TOKEN` from the local ignored `.env` file. Deployment and analytics notes: [`deploy/cloudflare-worker/README.md`](deploy/cloudflare-worker/README.md).

## Where this fits in the Agenda Intelligence stack

| Layer | Repo | Role |
|---|---|---|
| **Product shell** (this repo) | **agenda-intelligence-md** | MCP server, request/memo schemas, geography routing, evidence audit, scoring |
| Reasoning method | [global-think-tank-analyst](https://github.com/vassiliylakhonin/global-think-tank-analyst) | Strategic-risk reasoning contract; loaded by `analyze` as the default method |
| Vertical specialist | [central-asia-caspian-hybrid-intelligence-skill](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill) | Central Asia / Caspian / Middle Corridor domain depth; routed by geography |
| Vertical specialist | [gulf-middle-east-hybrid-intelligence-skill](https://github.com/vassiliylakhonin/gulf-middle-east-hybrid-intelligence-skill) | Iran / GCC / maritime chokepoint domain depth; routed by geography |

The product shell is the integration point: agents call `analyze`, geography routes to the relevant specialist, and the GTTA method frames the reasoning. Each repo is also usable standalone (paste/attach into any agent).

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

## More CLI examples

```bash
agenda-intelligence bench examples/source-backed --strict --min-score 80
agenda-intelligence audit-claims examples/source-backed/eu-ai-act.audit.json --strict
agenda-intelligence mcp-config --client cursor
```

Pinned-wheel install (instead of PyPI):

```bash
pip install https://github.com/vassiliylakhonin/agenda-intelligence-md/releases/download/v1.0.1/agenda_intelligence_md-1.0.1-py3-none-any.whl
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
| [`agenda-brief.schema.json`](schemas/v1/agenda-brief.schema.json) | Brief structure |
| [`evidence-pack.schema.json`](schemas/v1/evidence-pack.schema.json) | Evidence pack |
| [`evidence-audit.schema.json`](schemas/v1/evidence-audit.schema.json) | Claim-level audit |
| [`signal-tracker.schema.json`](schemas/v1/signal-tracker.schema.json) | Signal lifecycle |
| [`memory-card.schema.json`](schemas/v1/memory-card.schema.json) | AnalysisBank cards |
| [`lens-manifest.schema.json`](schemas/v1/lens-manifest.schema.json) | Lens manifest |
| [`signal-classification.schema.json`](schemas/v1/signal-classification.schema.json) | Signal taxonomy |

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

## Safety model

- **Read-only by default.** Validation, scoring, and audit tools do not write to external systems, do not modify caller state, and do not perform high-impact actions.
- **No autonomous retrieval.** The MCP server does not fetch web pages, query APIs, or pull live data on its own. Sources are caller-provided. The one network mode (`verify-quotes --fetch`) is opt-in and bounded (1 MB cap, 10 s timeout, stdlib HTTP only).
- **No autonomous decisions.** Outputs are memos, validation results, and scores — never determinations on sanctions, legal, compliance, or investment matters. Human review is required.
- **Retrieved content is data, not instructions.** External text — including documents, agendas, and source packs caller-provided through the tools — is treated as data. Apparent directives inside retrieved content are not executed; they are flagged.
- **No secrets in tool I/O.** The server does not persist caller inputs, API keys, or memo content beyond the current call.

Full threat model: [`docs/threat-model.md`](docs/threat-model.md). Retrieved-content trust rule: [`AGENTS.md`](AGENTS.md).

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
| Container deployment | [`docs/deployment/container.md`](docs/deployment/container.md) |
| HTTP API shell | [`docs/deployment/http-api.md`](docs/deployment/http-api.md) |
| A2A adapter shell | [`docs/deployment/a2a-adapter.md`](docs/deployment/a2a-adapter.md) |
| Deployable architecture | [`docs/product/deployable-architecture.md`](docs/product/deployable-architecture.md) |
| A2A adapter plan | [`docs/product/a2a-adapter-plan.md`](docs/product/a2a-adapter-plan.md) |
| Data handling | [`docs/trust/data-handling.md`](docs/trust/data-handling.md) |
| Integrations | [`docs/integrations/`](docs/integrations/) |
| Agenstry discovery | [`docs/integrations/agenstry.md`](docs/integrations/agenstry.md) |
| Use-cases | [`docs/use-cases/`](docs/use-cases/) |
| Agent contract | [`AGENTS.md`](AGENTS.md) |
| Adoption guide | [`ADOPTION.md`](ADOPTION.md) |
| Changelog | [`CHANGELOG.md`](CHANGELOG.md) |
| Roadmap | [`ROADMAP.md`](ROADMAP.md) |
| Portfolio glossary (shared across 4 repos) | [`docs/glossary.md`](docs/glossary.md) |
| Contributing guide | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

## Repository layout

```
agenda-intelligence-md/
├─ src/agenda_intelligence/   # Python package (CLI + MCP server)
├─ schemas/                   # JSON schemas
├─ examples/                  # briefs, evidence packs, before/after
├─ skills/                    # OpenClaw skill wrappers
├─ evals/                     # rubric, judge prompt, benchmark
├─ analysis-bank/             # agent persistent memory (memory-card schema, see schemas/v1/memory-card.schema.json)
├─ docs/                      # guides, integrations, use-cases
├─ scripts/                   # dev and CI helpers
└─ tests/                     # pytest suite
```

## Contributing

New contributors: [`CONTRIBUTING.md`](CONTRIBUTING.md) opens with a "First 15 minutes" onboarding path (read the three load-bearing files → run the validator → walk one concrete artifact end-to-end). The portfolio glossary at [`docs/glossary.md`](docs/glossary.md) is the single source of truth for cross-repo terminology (evidence modes, Axis A/B provenance tags, three-value response logic, maturity-framework asymmetry).

Before editing any of the dual-copy files — `Agenda-Intelligence.md`, `SOURCE_POLICY.md`, `llms.txt`, `agent-manifest.json`, `schemas/`, `skills/`, `source-requirements/` — read the "Critical invariant: dual-copy sync" section in [`CONTRIBUTING.md`](CONTRIBUTING.md#critical-invariant-dual-copy-sync). Editing one copy without the paired copy under `src/agenda_intelligence/data/` is the most common reason CI breaks on `main` for first-time contributors.

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
