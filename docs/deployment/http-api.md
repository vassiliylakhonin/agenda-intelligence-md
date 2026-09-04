# HTTP API shell

## Purpose

The HTTP API shell is a portable JSON wrapper over the shared Agenda Intelligence service layer.

It is intended for local development, adapter development, integration tests, and deployment packaging inside a trusted perimeter. It does not replace the stdio MCP server.

It carries API-key authentication, a per-client rate limit, a usage ledger and a CORS allowlist — see [Access control](#access-control) — but it is a single-process standard-library server: no shared state across replicas, no queue, no TLS of its own. Terminate TLS and balance load in front of it.

## Access control

Configuration is environment-only. A policy that cannot be parsed refuses to start rather than enforcing nothing.

| Variable | Effect |
|---|---|
| `AGENDA_INTELLIGENCE_API_KEYS` | `client:secret` pairs, comma separated. Unset means open mode, which warns at startup and is reported on `/readyz`. |
| `AGENDA_INTELLIGENCE_REQUIRE_AUTH` | `1` refuses to start without keys. Set it anywhere the shell is reachable by anything but its own developer. |
| `AGENDA_INTELLIGENCE_RATE_LIMIT_PER_MINUTE` | Requests per client per minute. Default 60; `0` disables the limit. |
| `AGENDA_INTELLIGENCE_CORS_ORIGINS` | Exact origins that may call from a browser. `*` is rejected. |
| `AGENDA_INTELLIGENCE_ADMIN_KEY` | Bearer secret for `GET /usage`. Without one the endpoint returns 404. |

`/healthz` and `/readyz` answer without a key, so an orchestrator can tell a starting container from a broken one. Everything under `/v1/` requires `Authorization: Bearer <secret>` once keys are configured.

Responses carry `x-request-id` (echoed from the request when the caller sends a safe one), `x-ratelimit-limit` and `x-ratelimit-remaining`. A 429 carries `retry-after`.

`GET /usage` returns per-client, per-endpoint counts — requests, answers, client errors, rate-limited refusals, server errors, last seen. It is in memory and per process: scrape it, do not treat it as a record.

For embedding this in another product, see [OEM integration](../integrations/oem.md).

## Run

```bash
agenda-intelligence-http --host 127.0.0.1 --port 8080
```

Environment defaults:

- `AGENDA_INTELLIGENCE_HTTP_HOST`
- `AGENDA_INTELLIGENCE_HTTP_PORT`

## Container

Build:

```bash
docker build -f Dockerfile.api -t agenda-intelligence-md-api:1.0.1 .
```

Run:

```bash
docker run --rm -p 8080:8080 agenda-intelligence-md-api:1.0.1
```

The API image starts:

```bash
agenda-intelligence-http --host 0.0.0.0 --port 8080
```

## Endpoints

- `GET /healthz`
- `GET /readyz`
- `POST /v1/audit-claims`
- `POST /v1/source-coverage`
- `POST /v1/score`
- `POST /v1/middle-corridor/deal-risk`
- `POST /v1/agentic-interaction/trust`
- `POST /v1/cis-secondary-sanctions/exposure`
- `POST /v1/gulf-maritime/exposure`
- `POST /v1/market-entry/readiness`
- `POST /v1/agent-output/verification`
- `POST /v1/agent-output/pre-action-check`

## Examples

Audit claims:

```bash
curl -sS http://127.0.0.1:8080/v1/audit-claims \
  -H 'content-type: application/json' \
  -d '{"audit_json":{"topic":"x","claims":[],"evidence":[]}}'
```

Source coverage:

```bash
curl -sS http://127.0.0.1:8080/v1/source-coverage \
  -H 'content-type: application/json' \
  -d '{"category":"sanctions","evidence_json":{"claims":[]}}'
```

Score:

```bash
curl -sS http://127.0.0.1:8080/v1/score \
  -H 'content-type: application/json' \
  -d '{"before_text":"Generic update.","after_text":"Signal classification: policy risk. Watch next: regulator guidance."}'
```

Middle Corridor deal risk:

```bash
curl -sS http://127.0.0.1:8080/v1/middle-corridor/deal-risk \
  -H 'content-type: application/json' \
  -d @examples/kazakhstan-middle-corridor/contract/pre_signature_escalate.request.json
```

Agentic interaction trust:

```bash
curl -sS http://127.0.0.1:8080/v1/agentic-interaction/trust \
  -H 'content-type: application/json' \
  -d @examples/agentic-interaction-trust/contract/checkout_step_up.request.json
```

Pre-action check:

```bash
curl -sS http://127.0.0.1:8080/v1/agent-output/pre-action-check \
  -H 'content-type: application/json' \
  -d @examples/pre-action-check/low-risk-continue.request.json
```

The response is a routing instruction for the caller: `continue`,
`request_evidence`, `require_approval`, or `stop`. The shell does not enforce
the instruction or perform the action.

## Data handling

The shell suppresses default request logging. It does not persist prompts, evidence packs, source excerpts, memo content, or API keys.

Downstream deployments should keep operational logs reduced to fields such as request id, endpoint, status, duration, input size, and selected module names where applicable.

## Boundaries

- No autonomous live source retrieval.
- No factual-truth verification.
- No legal, compliance, sanctions, financial, investment, insurance, or trading advice.
- Human review is required for high-stakes decisions.

## Future work

Future deployment work may add production runtime guidance, A2A adapter routing, and entitlement/metering abstractions. Those are intentionally separate from this portable shell.
