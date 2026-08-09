# HTTP API shell

## Purpose

The HTTP API shell is a portable JSON wrapper over the shared Agenda Intelligence service layer.

It is intended for local development, adapter development, integration tests, and future deployment packaging. It is not a hardened internet-facing production server and does not replace the stdio MCP server.

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
