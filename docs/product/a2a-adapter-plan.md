# A2A adapter plan

This is the contract plan for a future production A2A adapter over the portable HTTP API shell.

The adapter should be a routing and protocol layer only. It must not duplicate service logic, introduce marketplace billing, perform live retrieval, persist payloads by default, or change MCP tool behavior.

## Layering

```text
Core package
  -> shared service functions
  -> HTTP API shell
  -> A2A adapter
  -> channel-specific deployment package
```

## Adapter responsibilities

- Expose an A2A-compatible agent card.
- Accept A2A `message/send` or equivalent task messages.
- Detect the requested product skill.
- Convert A2A message parts into the HTTP/service request shape.
- Return A2A artifacts and metadata derived from the HTTP/service response.
- Preserve non-advice, no-live-retrieval, and human-review boundaries.

## Endpoint mapping

| A2A capability | HTTP endpoint | Service function | Canonical payload |
|---|---|---|---|
| Evidence audit | `POST /v1/audit-claims` | `audit_claims` | `audit_json` |
| Source coverage | `POST /v1/source-coverage` | `source_coverage` | `evidence_json` plus optional `category` |
| Before/after score | `POST /v1/score` | `score_output` | `before_text`, `after_text` |
| Middle Corridor deal-risk gate | `POST /v1/middle-corridor/deal-risk` | `middle_corridor_deal_risk` | `middle-corridor-deal-risk-request.schema.json` |

## Middle Corridor A2A contract

The canonical enterprise interface is structured JSON. For the Middle Corridor deal-risk gate, the adapter should prefer A2A data parts containing a complete `middle-corridor-deal-risk-request.schema.json` object.

Free-text prompts may be accepted as discovery/demo input only. They should be converted into an explicit structured request only when the adapter can do so without inventing missing evidence. Otherwise the adapter should return a request-shape error that asks the caller to provide route, cargo, counterparties, dated sources, risk question, and decision stage.

Expected A2A metadata:

- `product_profile`: `middle_corridor_deal_risk`
- `canonical_http_endpoint`: `/v1/middle-corridor/deal-risk`
- `schema`: `schemas/v1/middle-corridor-deal-risk-request.schema.json`
- `human_review_required`: copied from the service response
- `not_advice_notice`: copied from the service response

## Data handling

The adapter should log only reduced operational metadata:

- request id
- A2A method
- selected capability
- status
- duration
- input size

The adapter must not log by default:

- prompt text
- source excerpts
- evidence packs
- API keys
- full memo content
- customer identifiers beyond what is necessary for operation

Full-payload logging, if ever added by an operator, must be explicit opt-in and documented outside core.

## Boundaries

- No autonomous live source retrieval.
- No factual-truth verification.
- No legal, compliance, sanctions, financial, investment, insurance, or trading advice.
- No compliance clearance, sanctions clearance, shipment authorization, investment recommendation, or insurance decision.
- Human review is required for high-stakes decisions.

## Non-goals for the first adapter PR

- Do not add billing, wallets, marketplace entitlements, or metering.
- Do not add cloud-provider SDKs.
- Do not change existing MCP tool names or behavior.
- Do not change the portable HTTP API response shapes.
- Do not add live retrieval.
- Do not add factual verification.
- Do not persist caller payloads by default.

## First implementation slice

The first A2A adapter slice implements only:

- agent card generation;
- JSON-RPC `message/send`;
- structured Middle Corridor data-part routing to `/v1/middle-corridor/deal-risk`;
- health and readiness metadata;
- reduced operational logging;
- tests for structured request mapping and invalid request handling.

Generic `audit_claims`, `source_coverage`, and `score_output` A2A routing can follow after the flagship path is stable.

Implementation module: [`../../src/agenda_intelligence/a2a_adapter.py`](../../src/agenda_intelligence/a2a_adapter.py).
