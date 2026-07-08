# Agentic Interaction Trust Gate

Status: shipped 2026-05-29. Vertical worker service function `agentic_interaction_trust`. Schema family v1, additive (non-breaking under [ADR 0003](../adr/0003-v1-compatibility-policy.md)). No live retrieval.

## Proposition

Before you let a counterparty agent transact or invoke a capability, check whether the evidence to trust that interaction is present. Bring the actor's identity claim, its target surface, the requested action, and dated evidence. Get an auditable trust-routing triage with the missing evidence, source coverage, watch-next indicators, and human-review escalation.

The primary case is agent-to-agent: an unknown A2A caller (or a delegated x402-style payment) wants to invoke a capability or settle a transaction, and you need to know — before it executes — whether there is enough evidence to allow it, step it up, escalate to a human, or block until verified. The same gate covers agent-mediated checkout, account, API, and MCP tool surfaces.

The point is not to decide whether the actor is a bot, and not to verify its identity. The point is to decide whether the evidence is sufficient to route a specific automated or agentic action: allow low-risk, require step-up, escalate to human review, or block until verified.

This is not cybersecurity monitoring, fraud adjudication, identity verification, transaction authorization, legal advice, compliance advice, or financial advice. It is an evidence-readiness gate for teams that already have logs, agent claims, policy data, and risk signals.

## Why this belongs in Agenda Intelligence MD

AI traffic and agentic browsing make "human vs bot" too blunt for high-stakes workflows. The operational question becomes:

> Which action is the actor trying to take, what authority does it claim, what evidence supports that authority, and what minimum evidence is missing before a human or policy engine can route it?

That matches the existing Agenda Intelligence pattern:

- structured request / response contract;
- source taxonomy;
- decision-readiness score;
- explicit evidence gaps;
- watch-next indicators;
- always-on human-review boundary.

## Target users

- Platform and agent teams exposing MCP tools or A2A endpoints to external agents, deciding whether to admit an unknown counterparty agent before it acts.
- Teams building agent-to-agent commerce (x402 / delegated payments) that need a step-up check before a transaction executes.
- Trust and safety teams designing policy for agent-mediated web traffic.
- Fraud, risk, and abuse teams reviewing checkout, account, auth, or API actions.
- Product security teams that need a structured handoff between telemetry, policy, and human review.
- Consultants writing agentic-risk operating procedures for clients.

## Input shape

```json
{
  "actor": {
    "declared_type": "ai_agent",
    "declared_name": "Example Shopping Agent",
    "operator": "Example Consumer",
    "authentication_context": "session_cookie"
  },
  "target_surface": "checkout",
  "requested_action": "complete purchase of two restricted-delivery items",
  "asset_or_resource": "order-123",
  "decision_stage": "pre_execution",
  "dated_sources": [
    {
      "id": "ait-1",
      "source_type": "agent_identity_claim",
      "title": "Declared agent identity header",
      "date": "2026-05-28"
    }
  ],
  "risk_question": "Is this agent-mediated checkout ready to allow, step up, or route to human review?"
}
```

## Output shape

```json
{
  "triage_recommendation": "require_step_up",
  "trust_signal": "medium",
  "decision_readiness_score": 40,
  "decision_readiness_label": "not_decision_ready",
  "supplied_sources": [
    "agent_identity_claim",
    "session_authentication_evidence",
    "transaction_or_target_action_evidence"
  ],
  "minimum_sources_before_action": [
    "operator_or_principal_authorization",
    "agent_card_or_manifest",
    "tool_scope_or_permission_evidence",
    "action_intent_evidence"
  ],
  "evidence_gaps": [
    "No operator or principal authorization supplied.",
    "No agent card or signed manifest supplied.",
    "No tool-scope or permission evidence supplied."
  ],
  "watch_next": [
    "checkout or transaction anomaly",
    "agent identity spoofing pattern",
    "provider allowlist or policy change"
  ],
  "human_review_required": true
}
```

## Product contract

The canonical interface is structured JSON, not free-text prompting.

- Request schema: [`../../schemas/v1/agentic-interaction-trust-request.schema.json`](../../schemas/v1/agentic-interaction-trust-request.schema.json)
- Response schema: [`../../schemas/v1/agentic-interaction-trust-response.schema.json`](../../schemas/v1/agentic-interaction-trust-response.schema.json)
- Source taxonomy: [`../../source-requirements/agentic-interaction-trust.json`](../../source-requirements/agentic-interaction-trust.json)
- Contract examples: [`../../examples/agentic-interaction-trust/contract/`](../../examples/agentic-interaction-trust/contract/)
- HTTP: `POST /v1/agentic-interaction/trust`
- A2A capability: `agentic_interaction_trust`

`decision_readiness_score` is a heuristic 0-100 evidence-pack readiness score for a human trust-routing decision. It is not approval, clearance, fraud adjudication, identity verification, cybersecurity monitoring, or transaction authorization.

## Source taxonomy

`required_before_go`:

| Source type | Why required |
|---|---|
| `agent_identity_claim` | Establishes what the actor claims to be. |
| `operator_or_principal_authorization` | Shows whether a user, organization, or principal authorized the action. |
| `agent_card_or_manifest` | Anchors the declared agent identity and capabilities where available. |
| `tool_scope_or_permission_evidence` | Shows whether the actor is allowed to invoke the requested capability. |
| `session_authentication_evidence` | Shows how the actor is authenticated for this session or API call. |
| `action_intent_evidence` | Captures the stated purpose and user intent behind the action. |
| `transaction_or_target_action_evidence` | Describes the concrete action, asset, order, account, endpoint, or resource under review. |

Helpful context includes MCP/A2A endpoint metadata, rate-limit or abuse signals, fraud or account-takeover signals, device or infrastructure evidence, provider policy or allowlist records, prior interaction history, threat-intel or incident reports, and human-review notes.

## Buyer-facing scenarios

| Scenario | What the user brings | What the gate returns |
|---|---|---|
| AI shopping agent checkout | Agent claim, session evidence, order details, partial policy data | `require_step_up`, missing principal authorization and agent manifest |
| Unknown A2A caller | Declared agent name, A2A endpoint metadata, requested capability | `escalate_to_human_review`, missing operator authorization and tool-scope evidence |
| API partner claim | API key context, partner name, requested data export | `not_decision_ready`, missing allowlist, action intent, and permission evidence |

## Boundary

This contract should not be presented as a detection engine. It is a structured evidence gate. It can help a team see what is missing before they let a policy engine, fraud analyst, trust-and-safety reviewer, or security owner make a routing decision.

No autonomous blocking. No identity verification. No factual-truth verification. No legal, compliance, financial, or cybersecurity advice. Human review remains required for consequential decisions.
