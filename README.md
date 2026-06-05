# Agenda Intelligence MD

Product runtime and evidence-discipline layer for strategic intelligence agents. One core service layer behind four delivery surfaces — MCP server, HTTP API, A2A adapter, and a deployable Cloudflare Worker baseline — plus structured per-product contracts, geography-routed reasoning, schema validation, evidence audit, and scoring. Ships with four vertical workers: Middle Corridor Deal Risk Gate, CIS Secondary-Sanctions Exposure, Agentic Interaction Trust Gate, and Gulf Maritime Exposure Gate.

Read it as a **trust-routing layer for agent-mediated decisions**: it turns a partial evidence pack into a structured routing decision — allow, step up, escalate, or not-decision-ready — surfaces the specific missing evidence, and always requires human review for high-stakes actions. It does not approve, clear, or make a factual determination. Evaluate any of the four workers in a few minutes with live curl calls: [`docs/agenstry/demo-pack.md`](docs/agenstry/demo-pack.md). Per-profile live retrieval is declared as a capability for `cis_secondary_sanctions` with two upstream options ([ADR 0014](docs/adr/0014-per-profile-live-retrieval.md)): [Watchman](https://github.com/moov-io/watchman) self-host (Apache-2.0, $0/month on free-tier container) — preferred — and the [OpenSanctions](https://www.opensanctions.org) hosted API (paid €0.10/call) — fallback. Activation is env-derived (`WATCHMAN_URL` or `OPENSANCTIONS_API_KEY`); both are currently deferred until an operator configures one. Profile operates on user-supplied evidence only when nothing is wired. No factual-truth verification.

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

- Interactive browser demos: [Middle Corridor Deal Risk Gate](https://vassiliylakhonin.github.io/deal-risk-gate.html) · [CIS Secondary-Sanctions Exposure](https://vassiliylakhonin.github.io/cis-secondary-sanctions.html)
- Live endpoint: <https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev>
- Agent Card: <https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json>
- JSON-RPC: <https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/message/send>
- Agenstry listing: <https://agenstry.com/agents/agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev>
- Kazakhstan / Middle Corridor Deal Risk Gate: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev>
- Kazakhstan Agenstry listing: <https://agenstry.com/agents/middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev>
- CIS Secondary-Sanctions Exposure: <https://cis-secondary-sanctions-a2a.vassiliy-lakhonin.workers.dev>
- CIS Agenstry listing: <https://agenstry.com/agents/cis-secondary-sanctions-a2a.vassiliy-lakhonin.workers.dev>
- Agentic Interaction Trust Gate: <https://agentic-interaction-trust-a2a.vassiliy-lakhonin.workers.dev>
- Agentic Interaction Trust Agenstry listing: <https://agenstry.com/agents/agentic-interaction-trust-a2a.vassiliy-lakhonin.workers.dev>
- Gulf Maritime Exposure Gate: <https://gulf-maritime-exposure-a2a.vassiliy-lakhonin.workers.dev>
- Gulf Maritime Agenstry listing: <https://agenstry.com/agents/gulf-maritime-exposure-a2a.vassiliy-lakhonin.workers.dev>
- Announcement: [`docs/announcements/live-a2a-wrapper.md`](docs/announcements/live-a2a-wrapper.md)

The hosted wrapper is intentionally limited: no payments, no wallets, no factual-truth verification, and no legal/financial/compliance advice. Live retrieval is off by default and opt-in per vertical-worker profile only (currently `cis_secondary_sanctions` against OpenSanctions, CC-BY 4.0; see [ADR 0014](docs/adr/0014-per-profile-live-retrieval.md) and [SOURCE_POLICY.md](SOURCE_POLICY.md)). Full product behavior remains in the installable stdio MCP server.

## Self-host via HTTP API (if your stack does not run MCP)

If your environment cannot run an MCP / A2A server but can run a plain HTTP service, install the package and start the HTTP shell:

```bash
pip install agenda-intelligence-md
agenda-intelligence-http --host 127.0.0.1 --port 8080
```

The HTTP API is a portable JSON wrapper over the same core service layer that the MCP, A2A, and Cloudflare Worker surfaces use — same `schemas/v1/` contract, same evidence audit, same source coverage logic, same Middle Corridor deal-risk gate. Switching surfaces does not change input/output shape.

Endpoints:

- `GET /healthz`, `GET /readyz` — liveness / readiness probes
- `POST /v1/audit-claims` — claim-level evidence audit
- `POST /v1/source-coverage` — evidence-pack diagnostics against category source requirements
- `POST /v1/score` — heuristic before/after score
- `POST /v1/middle-corridor/deal-risk` — Middle Corridor Deal Risk Gate (`middle-corridor-deal-risk-request.schema.json`)
- `POST /v1/agentic-interaction/trust` — Agentic Interaction Trust Gate (`agentic-interaction-trust-request.schema.json`)
- `POST /v1/cis-secondary-sanctions/exposure` — CIS Secondary-Sanctions Exposure triage (`cis-secondary-sanctions-request.schema.json`); set `OPENSANCTIONS_API_KEY` to enable live retrieval, otherwise the profile degrades gracefully to user-supplied evidence only

One-call probe:

```bash
curl -sS http://127.0.0.1:8080/v1/middle-corridor/deal-risk \
  -H 'content-type: application/json' \
  -d @examples/kazakhstan-middle-corridor/contract/pre_signature_escalate.request.json
```

Container build (`Dockerfile.api`):

```bash
docker build -f Dockerfile.api -t agenda-intelligence-md-api:1.0.1 .
docker run --rm -p 8080:8080 agenda-intelligence-md-api:1.0.1
```

Full HTTP deployment guide, including environment defaults (`AGENDA_INTELLIGENCE_HTTP_HOST`, `AGENDA_INTELLIGENCE_HTTP_PORT`), logging discipline, and boundary statements: [`docs/deployment/http-api.md`](docs/deployment/http-api.md).

The HTTP shell is portable but **not a hardened internet-facing server**. No built-in authentication, rate limiting, or TLS — front it with a reverse proxy (nginx, Caddy, Cloudflare Tunnel) and your existing auth layer before exposing it beyond localhost / private network.

## Flagship commercial use case

**Kazakhstan / Middle Corridor Deal Risk Gate** is the focused commercial proposition for logistics, trade-finance, procurement, insurance, and compliance-adjacent workflows:

> Route + cargo + counterparties + dated sources -> auditable corridor-risk triage, evidence gaps, source coverage, watch-next indicators, and human-review escalation.

The structured response also presence-flags sanctions-relevant / high-risk and re-export / circumvention-watch counterparty jurisdictions, decomposes risk into a domestic-legal vs foreign-sanctions exposure view, and surfaces a vessel deceptive-shipping-practice checklist for the maritime leg. All of this is presence-flagging and evidence triage routed to human review — not a sanctions determination.

Live A2A listing:

- Endpoint: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send>
- Agent card: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json>
- Agenstry: <https://agenstry.com/agents/middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev>
- Use-case notes: [`docs/use-cases/kazakhstan-middle-corridor.md`](docs/use-cases/kazakhstan-middle-corridor.md)
- Example pack: [`examples/kazakhstan-middle-corridor/`](examples/kazakhstan-middle-corridor/)
- Repeatable live test: [`docs/agenstry/kazakhstan-live-test.md`](docs/agenstry/kazakhstan-live-test.md)

This use case is a pre-compliance evidence and decision-readiness gate. It is not legal, compliance, sanctions, financial, investment, or insurance advice.

The product-grade structured JSON contract is documented in [`docs/use-cases/kazakhstan-middle-corridor.md`](docs/use-cases/kazakhstan-middle-corridor.md#product-contract), with schemas and fixtures under [`examples/kazakhstan-middle-corridor/contract/`](examples/kazakhstan-middle-corridor/contract/).

## Second vertical worker: CIS secondary-sanctions exposure

For EU / UK / UAE / Singapore enhanced due diligence on CIS, Caucasus, and Central Asia counterparties (Kazakhstan, Uzbekistan, Kyrgyzstan, Tajikistan, Turkmenistan, Georgia, Armenia, Azerbaijan, Moldova). Structured secondary-sanctions exposure evidence triage against OFAC EO 14114, EU 14th sanctions package, UK OFSI, UN, and FATF / EAG typologies.

This profile **declares the capability** for per-profile live retrieval with two upstream options, per [ADR 0014](docs/adr/0014-per-profile-live-retrieval.md):

1. **Watchman** (preferred, free) — `moov-io/watchman` Apache-2.0 self-host on a free-tier container (Fly.io, Railway, Render). Set `WATCHMAN_URL` to activate.
2. **OpenSanctions** (fallback, paid) — hosted API at €0.10/call. Set `OPENSANCTIONS_API_KEY` (30-day business-email trial at https://www.opensanctions.org/api/, then per-call billing).

Both are currently deferred — the project has not committed to either, and no buyer has been confirmed. When both env vars are set, Watchman wins. When neither is set, the service degrades gracefully and triage is based on user-supplied evidence only — `live_retrieval_status: disabled` in the response and `boundaries.live_retrieval: false` in `/status`.

- HTTP: `POST /v1/cis-secondary-sanctions/exposure`
- Schemas: [request](schemas/v1/cis-secondary-sanctions-request.schema.json) + [response](schemas/v1/cis-secondary-sanctions-response.schema.json)
- A2A profile: `cis_secondary_sanctions`; capability `cis_secondary_sanctions_exposure`
- Use-case notes: [`docs/use-cases/cis-secondary-sanctions.md`](docs/use-cases/cis-secondary-sanctions.md)
- Example pack: [`examples/cis-secondary-sanctions/`](examples/cis-secondary-sanctions/)
- Source-requirements taxonomy: [`source-requirements/cis-secondary-sanctions.json`](source-requirements/cis-secondary-sanctions.json)

Honest traction: zero paying customers, zero named pilots. Shipped as a portfolio-grade vertical worker for technical evaluators and as a contract real practitioners can inspect, not as a claim of production traction. Boundaries unchanged from the rest of the runtime: `not_advice: true`, `factual_verification: false`, `human_review_required: true` always.

The structured response includes a `decision_readiness_score` from 0-100, so a buyer can see whether the evidence pack is ready for human review or still missing required source categories.

## Third vertical worker: Agentic Interaction Trust Gate

For trust-and-safety, fraud-risk, product-security, and platform teams reviewing agent-mediated actions across checkout, account, API, MCP tool, and A2A endpoint surfaces.

This worker does not decide whether an actor is a bot. It asks whether the supplied evidence is sufficient to route a specific automated or agentic action: `allow_low_risk`, `require_step_up`, `escalate_to_human_review`, `block_until_verified`, `not_decision_ready`, or `insufficient_information`.

- HTTP: `POST /v1/agentic-interaction/trust`
- A2A capability: `agentic_interaction_trust`
- Schemas: [request](schemas/v1/agentic-interaction-trust-request.schema.json) + [response](schemas/v1/agentic-interaction-trust-response.schema.json)
- Use-case notes: [`docs/use-cases/agentic-interaction-trust.md`](docs/use-cases/agentic-interaction-trust.md)
- Example pack: [`examples/agentic-interaction-trust/`](examples/agentic-interaction-trust/)
- Source-requirements taxonomy: [`source-requirements/agentic-interaction-trust.json`](source-requirements/agentic-interaction-trust.json)

Boundaries: no cybersecurity monitoring, fraud adjudication, identity verification, transaction authorization, legal advice, compliance advice, or financial advice. The worker returns evidence gaps, readiness scoring, watch-next indicators, and `human_review_required: true`.

Try the Kazakhstan agent:

```bash
curl -X POST https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send \
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
            "text": "Screen sanctions and policy risk for Red Sea shipping disruption and Kazakhstan transit exposure.",
            "mediaType": "text/plain"
          }
        ]
      }
    }
  }'
```

Kazakhstan-focused live triage:

```bash
curl -X POST https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": "kazakhstan-demo-1",
    "method": "message/send",
    "params": {
      "message": {
        "parts": [
          {
            "text": "Screen Kazakhstan Middle Corridor sanctions exposure for a logistics route.",
            "mediaType": "text/plain"
          }
        ]
      }
    }
  }'
```

Expected: JSON-RPC 2.0 with `status.state: "TASK_STATE_COMPLETED"`, `metadata.signal_screen.risk_signal`, affected regions, required source categories, evidence gaps, watch-next indicators, suggested modules, and next actions.

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
| **Product runtime** (this repo) | **agenda-intelligence-md** | Core service layer + MCP / HTTP / A2A surfaces, request/memo schemas, geography routing, evidence audit, scoring, vertical workers |
| Reasoning method | [global-think-tank-analyst](https://github.com/vassiliylakhonin/global-think-tank-analyst) | Strategic-risk reasoning contract; loaded by `analyze` as the default method |
| Vertical specialist | [central-asia-caspian-hybrid-intelligence-skill](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill) | Central Asia / Caspian / Middle Corridor domain depth; routed by geography |
| Vertical specialist | [gulf-middle-east-hybrid-intelligence-skill](https://github.com/vassiliylakhonin/gulf-middle-east-hybrid-intelligence-skill) | Iran / GCC / maritime chokepoint domain depth; routed by geography |

The product runtime is the integration point: agents call `analyze` via any surface (MCP, HTTP, A2A), geography routes to the relevant specialist, and the GTTA method frames the reasoning. Each canonical repo (GTTA, vertical specialists) is also usable standalone (paste/attach into any agent). Vertical workers (currently: Middle Corridor Deal Risk Gate, CIS Secondary-Sanctions Exposure, and Agentic Interaction Trust Gate) live inside this runtime as productized service functions with their own schemas and HTTP/A2A profiles — see [`AGENTS.md`](AGENTS.md#vertical-workers-inside-this-repo) for the spin-off rule.

## What this is

- **Core service layer** — pure Python functions (`audit_claims`, `source_coverage`, `score_output`, `middle_corridor_deal_risk`, `agentic_interaction_trust`, etc.) vendor-neutral, no transport, no marketplace
- **MCP server** — stdio server exposing 19 tools across the validation, product, and vertical worker layers. `analyze` accepts a structured request (`agenda-request.schema.json`), routes geography, assembles a system prompt, returns a memo validated against `agenda-memo.schema.json`
- **HTTP API shell** — thin transport over the service layer; self-host with `docs/deployment/http-api.md`
- **A2A adapter** — agent-card + JSON-RPC `message/send` over the HTTP/service layer; contract in `docs/product/a2a-adapter-plan.md`
- **Cloudflare Worker baseline** — production deployment under `deploy/cloudflare-worker/`; two live workers (general triage + Middle Corridor Deal Risk Gate)
- **Vertical workers** — productized service functions with their own schemas + HTTP/A2A profiles; Cloudflare deployments exist where configured. Currently shipped in the runtime: Middle Corridor Deal Risk Gate, CIS Secondary-Sanctions Exposure, Agentic Interaction Trust Gate
- **Markdown protocol** — structured reasoning workflow for agents (`Agenda-Intelligence.md`)
- **JSON schemas** — request/memo product contract + per-product contracts (e.g. `middle-corridor-deal-risk-*`) + validators for briefs, evidence packs, audits, signals, memory cards, lenses
- **CLI** — `validate-brief`, `validate-evidence`, `source-categories`, `source-coverage`, `audit-claims`, `score`, `bench`, `doctor` (30+ commands)
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
pip install https://github.com/vassiliylakhonin/agenda-intelligence-md/releases/download/v1.1.0/agenda_intelligence_md-1.1.0-py3-none-any.whl
```

## Benchmark baseline

20 source-backed cases, reproduced with `agenda-intelligence bench examples/source-backed/`. The score below measures **structural completeness** — schema validity, evidence labeling, source-coverage diagnostics, and decision-readiness — **not factual accuracy**. A high score means a brief is well-formed and audit-ready, not that its claims are true in the world.

| Metric | Value |
|---|---|
| Cases | 20 |
| Mean structural-completeness score | 87.6 / 100 |
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

Stdio MCP server with 19 tools. Full docs and wire-protocol verification: [`MCP.md`](MCP.md). Client setup: [`docs/integrations/mcp.md`](docs/integrations/mcp.md).

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
| `middle_corridor_deal_risk` | Kazakhstan / Middle Corridor deal-risk gate: structured request → triage, decision-readiness, evidence gaps, human-review flag |
| `cis_secondary_sanctions_exposure` | CIS counterparty secondary-sanctions exposure triage for EU/UK/UAE/Singapore EDD; local stdio runs on user-supplied evidence only |
| `agentic_interaction_trust` | Trust-evidence triage for an agent-mediated interaction before a high-stakes action |

## Status

| Component | Status |
|---|---|
| Markdown protocol, JSON schemas | Stable |
| CLI (validate, score, bench, audit, doctor) | Stable |
| MCP stdio server | Stable |
| HTTP API shell | Shipped (self-host); contract early — see `docs/deployment/http-api.md` |
| A2A adapter | Shipped (Cloudflare Worker baseline); contract in `docs/product/a2a-adapter-plan.md` |
| Cloudflare Worker deployment | Live (5 workers: general triage + Middle Corridor Deal Risk Gate + CIS Secondary-Sanctions Exposure + Agentic Interaction Trust Gate + Gulf Maritime Exposure) |
| Middle Corridor Deal Risk Gate (vertical worker) | Live, no paying customers yet — illustrative usage only |
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
| Agenstry agent card copy | [`docs/agenstry/agent-card-copy.md`](docs/agenstry/agent-card-copy.md) |
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
