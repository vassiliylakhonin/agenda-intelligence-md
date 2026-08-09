# A2A adapter shell

## Purpose

The A2A adapter shell is a JSON-RPC stdio entrypoint over selected Agenda Intelligence service-layer functions.

It is intended for adapter development, local protocol testing, and future deployment packaging. It is not a marketplace integration, billing layer, hosted server, or replacement for the stdio MCP server.

## Run

```bash
agenda-intelligence-a2a < request.json
```

The shell reads one JSON-RPC object from stdin and writes one JSON-RPC response to stdout.

Optional environment variable:

- `AGENDA_INTELLIGENCE_A2A_BASE_URL` - URL placed in the returned agent card. Defaults to `http://localhost:8080`.

## Container

Build:

```bash
docker build -f Dockerfile.a2a -t agenda-intelligence-md-a2a:1.0.1 .
```

Run:

```bash
docker run --rm -i agenda-intelligence-md-a2a:1.0.1 < request.json
```

The A2A image starts:

```bash
agenda-intelligence-a2a
```

## Supported methods

- `agent/card`
- `message/send`

Aliases accepted by the adapter:

- `agentCard`
- `GetExtendedAgentCard`
- `tasks/send`
- `SendMessage`

## Capabilities

`message/send` accepts structured JSON for these capabilities:

- `middle_corridor_deal_risk`
- `agentic_interaction_trust`
- `cis_secondary_sanctions_exposure`
- `gulf_maritime_exposure`
- `kazakhstan_market_entry_readiness`
- `audit_claims`
- `source_coverage`
- `score_output`
- `agent_output_verification`
- `pre_action_check`

The capability can be supplied as `params.capability`, `params.tool`, `params.skill`, or `params.message.metadata.capability`.

If no capability is supplied, the adapter keeps the original default behavior and expects a structured Middle Corridor deal-risk request.

Unknown capabilities are rejected. Free text without the structured payload is rejected so the adapter does not invent missing evidence.

## Middle Corridor request

The canonical input is `schemas/v1/middle-corridor-deal-risk-request.schema.json`.

The adapter accepts the structured request in:

- `params.request`
- `params.middle_corridor_deal_risk_request`
- `params.input`
- A2A `message.parts[].data`
- A2A `message.parts[].json`
- JSON object text in `message.parts[].text`

## Generic service requests

`audit_claims` accepts an evidence-audit JSON object directly, or as `params.audit_json`.

`source_coverage` accepts an evidence/source object directly, or as `params.evidence_json`. The source category can be supplied as `params.category` or inside the request object as `category`.

`score_output` accepts:

```json
{
  "before_text": "Generic update. Monitor developments.",
  "after_text": "Signal classification: ... Watch next: ..."
}
```

`pre_action_check` accepts the structured object in
`schemas/v1/pre-action-check-request.schema.json`. The caller supplies a
`run_id`, actor, requested action, target, risk tier, claim evidence, optional
policy checks, and optional external approval reference. Resubmit the same
`run_id` after adding evidence or approval.

These generic routes expose the same service-layer behavior as the HTTP shell:

- `audit_claims` -> `/v1/audit-claims`
- `source_coverage` -> `/v1/source-coverage`
- `score_output` -> `/v1/score`
- `agent_output_verification` -> `/v1/agent-output/verification`
- `pre_action_check` -> `/v1/agent-output/pre-action-check`

They do not add live retrieval, factual verification, or advice/clearance behavior.

## Examples

Runnable JSON-RPC examples are in `examples/a2a/`.

```bash
jq -n --slurpfile request examples/kazakhstan-middle-corridor/contract/pre_signature_escalate.request.json \
  '{jsonrpc:"2.0", id:"a2a-demo", method:"message/send", params:{request:$request[0]}}' |
  agenda-intelligence-a2a
```

The same Middle Corridor example is also available as a ready-to-run file:

```bash
agenda-intelligence-a2a < examples/a2a/middle-corridor-deal-risk.request.json
```

Expected response metadata:

- `product_profile`: `middle_corridor_deal_risk`
- `canonical_http_endpoint`: `/v1/middle-corridor/deal-risk`
- `human_review_required`: `true`
- `not_advice_notice`: present
- `response.decision_readiness_score`: `42` for the bundled escalation fixture

Audit claims:

```json
{
  "jsonrpc": "2.0",
  "id": "audit-demo",
  "method": "message/send",
  "params": {
    "capability": "audit_claims",
    "audit_json": {
      "topic": "shipment memo",
      "claims": [
        {
          "claim_id": "c1",
          "claim": "The supplied port notice is dated.",
          "evidence_ids": ["e1"],
          "support_level": "direct"
        }
      ],
      "evidence": [
        {
          "evidence_id": "e1",
          "name": "Port notice",
          "source_type": "port_operator_notice"
        }
      ]
    }
  }
}
```

## Data handling

The shell does not log or persist prompts, source excerpts, evidence packs, full memo content, or API keys.

Downstream wrappers should log only reduced operational fields such as request id, method, selected capability, status, duration, and input size.

## Boundaries

- No autonomous live source retrieval.
- No factual-truth verification.
- No legal, compliance, sanctions, financial, investment, insurance, or trading advice.
- No compliance clearance, sanctions clearance, shipment authorization, investment recommendation, or insurance decision.
- Human review is required for high-stakes decisions.

## Protocol-level security is a gateway responsibility

The shell is deliberately stateless with no auth opinion, no agent registry, and no token issuance. That is a scoping decision, not a security claim: structured threat modeling of the emerging agent-protocol ecosystem (MCP, A2A, Agora, ANP) identifies twelve protocol-level risk classes across the creation, operation, and update phases of the agent lifecycle, with a measured MCP case study showing wrong-provider tool execution under multi-server composition (arXiv:2602.11327). Agent identity, registration integrity, token scoping, and token lifetime are not enforced by this shell and must be handled at the deploying gateway or IAM layer.

For deployments that need to *triage* exactly this class of evidence before a high-stakes action — caller identity, authorization, tool scope, session auth, action intent — the `agentic_interaction_trust` profile exists for that purpose; it produces an evidence-readiness verdict, not an enforcement decision.

## Future work

Production A2A hosting, auth, metering, streaming, push notifications, and channel-specific marketplace packaging remain out of scope for this shell.
