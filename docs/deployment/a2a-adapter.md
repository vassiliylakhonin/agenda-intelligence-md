# A2A adapter shell

## Purpose

The A2A adapter shell is a JSON-RPC stdio entrypoint over the structured Middle Corridor deal-risk adapter.

It is intended for adapter development, local protocol testing, and future deployment packaging. It is not a marketplace integration, billing layer, hosted server, or replacement for the stdio MCP server.

## Run

```bash
agenda-intelligence-a2a < request.json
```

The shell reads one JSON-RPC object from stdin and writes one JSON-RPC response to stdout.

Optional environment variable:

- `AGENDA_INTELLIGENCE_A2A_BASE_URL` - URL placed in the returned agent card. Defaults to `http://localhost:8080`.

## Supported methods

- `agent/card`
- `message/send`

Aliases accepted by the adapter:

- `agentCard`
- `GetExtendedAgentCard`
- `tasks/send`
- `SendMessage`

## Middle Corridor request

The first adapter slice supports only structured Middle Corridor deal-risk requests. The canonical input is `schemas/v1/middle-corridor-deal-risk-request.schema.json`.

The adapter accepts the structured request in:

- `params.request`
- `params.middle_corridor_deal_risk_request`
- `params.input`
- A2A `message.parts[].data`
- A2A `message.parts[].json`
- JSON object text in `message.parts[].text`

Free text without the structured request is rejected so the adapter does not invent missing evidence.

## Example

```bash
jq -n --slurpfile request examples/kazakhstan-middle-corridor/contract/pre_signature_escalate.request.json \
  '{jsonrpc:"2.0", id:"a2a-demo", method:"message/send", params:{request:$request[0]}}' |
  agenda-intelligence-a2a
```

Expected response metadata:

- `product_profile`: `middle_corridor_deal_risk`
- `canonical_http_endpoint`: `/v1/middle-corridor/deal-risk`
- `human_review_required`: `true`
- `not_advice_notice`: present
- `response.decision_readiness_score`: `42` for the bundled escalation fixture

## Data handling

The shell does not log or persist prompts, source excerpts, evidence packs, full memo content, or API keys.

Downstream wrappers should log only reduced operational fields such as request id, method, selected capability, status, duration, and input size.

## Boundaries

- No autonomous live source retrieval.
- No factual-truth verification.
- No legal, compliance, sanctions, financial, investment, insurance, or trading advice.
- No compliance clearance, sanctions clearance, shipment authorization, investment recommendation, or insurance decision.
- Human review is required for high-stakes decisions.

## Future work

Generic A2A routing for `audit_claims`, `source_coverage`, and `score_output` should be added only after the Middle Corridor structured path is stable.
