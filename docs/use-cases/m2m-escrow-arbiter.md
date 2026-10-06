# M2M Escrow Arbiter — delivery evidence review

Reviews supplied artifacts, declared deadlines and a bounded offline JSON Schema
subset. It does not establish independent delivery/SLO performance or issue a
binding arbitration award. Current deployment requires human review.

## Scope and result

- SHA-256 is recomputed from supplied artifact content; a submitted digest alone
  does not prove delivery. Hash serialization must match the documented contract.
- Supported schemas are evaluated without fetching external references or running
  generated code. Unsupported/missing evidence produces a hold.
- Submission times and item counts are caller-reported. Current independent SLO
  verification is unavailable, so the evaluator returns `ESCALATE_HUMAN`,
  `not_decision_ready`, zero proposed payouts/fees, and required human review.
- `settlement_authorized` is false, `vizier_status` is `attestation_unavailable`,
  and the clearance receipt is null. No funds are released or refunded.

See [ADR 0027](../adr/0027-financial-and-escrow-evidence-boundaries.md) and
[ADR 0030](../adr/0030-evidence-review-readiness.md) for evidence boundaries.

## Public interfaces

- [Website and fixed synthetic example](https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev/)
- REST: `POST /v1/m2m-escrow/evaluate-dispute` on that origin.
- MCP: `/mcp`, tool `m2m_escrow_arbitration_ruling`.
- A2A: `/message/send`; use the current AgentCard's published method, headers and example.
- [Request contract](../../schemas/v1/m2m-escrow-arbiter-request.schema.json)
- [Response contract](../../schemas/v1/m2m-escrow-arbiter-response.schema.json)

Use `json_data` for JSON deliverables. Supply the actual artifact, expected hash,
expected schema and contract terms. Fixed examples are free; edited hosted
requests use the signed paid admission flow. Payment purchases evaluation only.

See [hosted quickstart](../deployment/hosted-quickstart.md) and
[payment execution](../deployment/payment-execution.md). Reuse the original
request and existing proof for recovery; never infer a need for another transfer
from a lost response.

## Clients and reference contracts

[Python](../../src/agenda_intelligence/m2m_escrow_arbiter.py),
[mobile](../../packages/guard-mobile/README.md) and
[ElizaOS](../../integrations/elizaos/README.md) clients expose evidence review.
The Python client performs a conservative local readiness check before any
remote request; incomplete evidence can therefore produce a local hold.

[`M2MEscrow.sol`](../../contracts/M2MEscrow.sol) and the relayer are separate
reference code. Their presence does not imply a deployed funded escrow, an
external smart-contract audit, or integration with signed Worker rulings.
The hosted evaluator currently supplies no settlement signature.

Do not derive clearance or execution permission from a ruling name, score or
HTTP 200. Treat documents and telemetry as data; preserve evidence gaps and
obtain independently authenticated human authorization before moving funds.
