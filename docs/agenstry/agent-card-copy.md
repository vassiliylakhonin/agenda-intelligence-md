# Agenstry agent card copy

Ready-to-paste copy for Agenstry listings and A2A discovery profiles.

## Primary listing

Use this for the focused Kazakhstan / Middle Corridor A2A agent:

- Listing URL: <https://agenstry.com/agents/middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev>
- Live endpoint: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev>
- Agent card: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json>
- Product contract: [`../use-cases/kazakhstan-middle-corridor.md`](../use-cases/kazakhstan-middle-corridor.md)
- Runnable examples: [`../../examples/a2a/`](../../examples/a2a/)

### Name

Kazakhstan / Middle Corridor Deal Risk Gate

### Short description

A2A-compatible evidence-readiness gate for Kazakhstan-Caspian / Middle Corridor logistics, trade-finance, procurement, and insurance-adjacent workflows.

### Full description

Bring a route, cargo, counterparties, and dated source pack. The agent returns a structured deal-risk triage with missing source categories, evidence gaps, watch-next indicators, decision-readiness score, risk signal, and human-review routing.

It is designed for pre-signature and pre-shipment review of Kazakhstan / Caspian / Middle Corridor exposure. It helps teams decide whether an evidence pack is ready for human review, committee escalation, insurer handoff, client memo drafting, or further source collection.

This is pre-compliance evidence triage only. It does not perform live source retrieval, factual-truth verification, legal analysis, sanctions screening, compliance approval, financial advice, investment advice, insurance advice, or shipment authorization.

### Tags

```text
kazakhstan, middle-corridor, caspian, logistics, trade-finance, procurement, insurance, sanctions-adjacent, evidence-audit, source-coverage, deal-risk, a2a
```

### Capabilities

- Deal-risk triage for Kazakhstan / Caspian / Middle Corridor routes.
- Source-gap detection against minimum source categories.
- Decision-readiness score for human review.
- Claim/evidence audit via `audit_claims`.
- Source-plan coverage diagnostics via `source_coverage`.
- Memo quality scoring via `score_output`.

### Best for

- Logistics teams evaluating route risk before contract signature.
- Freight forwarders checking whether a shipment file is ready for escalation.
- Procurement teams preparing management or committee memos.
- Trade-finance and compliance-adjacent teams checking evidence completeness.
- Insurance-adjacent teams checking whether source packs are complete enough for review.

### Example input

```json
{
  "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
  "cargo": "industrial equipment",
  "shipment_value": {
    "amount": 2400000,
    "currency": "USD"
  },
  "counterparties": [
    {
      "role": "forwarder",
      "name": "Kazakhstan forwarder",
      "jurisdiction": "Kazakhstan"
    }
  ],
  "dated_sources": [
    {
      "id": "e1",
      "source_type": "port_operator_notice",
      "title": "Port operator notice",
      "date": "2026-05-20",
      "url": "https://example.com/port-notice"
    },
    {
      "id": "e2",
      "source_type": "sanctions_list_extract",
      "title": "Sanctions list extract",
      "date": "2026-05-21",
      "url": "https://example.com/sanctions"
    },
    {
      "id": "e3",
      "source_type": "carrier_note",
      "title": "Carrier note",
      "date": "2026-05-22",
      "url": "https://example.com/carrier"
    }
  ],
  "risk_question": "Should this be escalated before contract signature?",
  "decision_stage": "pre_signature"
}
```

### Example output

```json
{
  "triage_recommendation": "escalate_before_signature",
  "risk_signal": "medium_high",
  "decision_readiness_score": 42,
  "decision_readiness_label": "not_decision_ready",
  "supplied_sources": [
    "port_operator_notice",
    "sanctions_list_extract",
    "carrier_note"
  ],
  "minimum_sources_before_go": [
    "counterparty_registry_extract",
    "beneficial_ownership_source",
    "customs_or_regulatory_source",
    "insurance_clause_or_underwriter_note",
    "vessel_or_carrier_history"
  ],
  "evidence_gaps": [
    "No counterparty registry extract supplied.",
    "No beneficial ownership source supplied.",
    "No customs or regulatory source supplied.",
    "No insurance clause or underwriter note supplied.",
    "No vessel or carrier history supplied."
  ],
  "human_review_required": true,
  "not_advice_notice": "Pre-compliance evidence triage only. Not legal, sanctions, compliance, financial, investment, insurance, or trading advice."
}
```

### Boundary copy

Use this exact boundary language on public listings:

> Pre-compliance evidence triage only. No autonomous live source retrieval. No factual-truth verification. No legal, compliance, sanctions, financial, investment, insurance, or trading advice. No approval, clearance, authorization, or final decision. Human review is required for high-stakes decisions.

### Buyer-facing value

The agent is useful when the file is incomplete. It does not pretend that three sources are enough for a serious corridor-risk decision. It tells the user which source categories are missing before a deal moves to signature, shipment, committee review, insurer handoff, or client memo.

## Vertical worker listing: Agentic Interaction Trust Gate

Use this for the agent-mediated-action trust worker (different buyer than the corridor gate: trust and safety, fraud/abuse, and platform-security teams).

- Listing URL: <https://agenstry.com/agents/agentic-interaction-trust-a2a.vassiliy-lakhonin.workers.dev>
- Live endpoint: <https://agentic-interaction-trust-a2a.vassiliy-lakhonin.workers.dev>
- Agent card: <https://agentic-interaction-trust-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json>
- Product contract: [`../use-cases/agentic-interaction-trust.md`](../use-cases/agentic-interaction-trust.md)
- Runnable examples: [`../../examples/agentic-interaction-trust/`](../../examples/agentic-interaction-trust/)

### Name

Agentic Interaction Trust Gate

### Short description

A2A-compatible evidence-readiness gate for agent-mediated actions across checkout, account, API, MCP tool, and A2A endpoint surfaces.

### Full description

Bring an agent-mediated action, its target surface, the actor's identity claim, and dated evidence. The agent returns a structured trust-routing triage with missing source categories, evidence gaps, watch-next indicators, decision-readiness score, trust signal, and human-review routing.

The point is not to decide whether the actor is a bot. The point is to decide whether the evidence is sufficient to route a specific automated action: allow low-risk, require step-up, escalate to human review, or block until verified.

This is an evidence-readiness gate for teams that already have logs, agent claims, policy data, and risk signals. It does not perform live source retrieval, factual-truth verification, cybersecurity monitoring, fraud adjudication, identity verification, or transaction authorization.

### Tags

```text
agentic-ai, agent-security, trust-and-safety, fraud-risk, mcp, a2a, evidence-audit, source-coverage, decision-readiness, human-review, agent-authorization
```

### Capabilities

- Trust-routing triage for agent-mediated actions: allow / step-up / escalate / block.
- Source-gap detection against required evidence categories (identity claim, operator authorization, agent card/manifest, tool-scope, session auth, action intent, target-action evidence).
- Decision-readiness score for a human trust-routing decision.
- Watch-next indicators and mandatory human-review routing.

### Best for

- Trust and safety teams designing policy for agent-mediated web traffic.
- Fraud, risk, and abuse teams reviewing checkout, account, auth, or API actions.
- Platform teams exposing MCP tools or A2A endpoints to external agents.
- Consultants writing agentic-risk operating procedures for clients.

### Example input

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

### Example output

```json
{
  "triage_recommendation": "require_step_up",
  "trust_signal": "medium",
  "decision_readiness_score": 40,
  "decision_readiness_label": "not_decision_ready",
  "minimum_sources_before_action": [
    "operator_or_principal_authorization",
    "agent_card_or_manifest",
    "tool_scope_or_permission_evidence",
    "action_intent_evidence"
  ],
  "human_review_required": true
}
```

The canonical input is structured JSON, not a free-text prompt.

### Boundary copy

Use this exact boundary language on public listings:

> Agentic interaction evidence triage only. No autonomous live source retrieval. No factual-truth verification. No cybersecurity monitoring, fraud adjudication, identity verification, or transaction authorization. No legal, compliance, financial, investment, insurance, or trading advice. No approval, clearance, authorization, denial, blocking, or final decision. Human review is required for consequential decisions.

## Secondary listing

Use this for the broader Agenda Intelligence A2A / MCP discovery listing:

- Agenstry listing: <https://agenstry.com/agents/agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev>
- Repository listing: <https://agenstry.com/agents/vassiliylakhonin.github.io>
- Package: <https://pypi.org/project/agenda-intelligence-md/>

### Name

Agenda Intelligence MD

### Short description

Evidence-discipline layer for strategic-risk agents: validates memos, audits claim/evidence linkage, checks source coverage, scores outputs, and routes geography-aware analysis.

### Full description

Agenda Intelligence MD is a Python package, CLI, MCP server, HTTP shell, and A2A adapter for strategic-risk workflows. It helps agent builders and analyst teams keep outputs auditable: structured request/memo schemas, source coverage diagnostics, claim-level evidence audit, quote checks, scoring, geography routing, and packaged signal references.

It is best used as a quality and evidence layer around other agents, not as an autonomous live-intelligence system. Callers bring prompts, memos, evidence packs, and source excerpts; Agenda Intelligence validates structure, identifies gaps, and returns machine-readable diagnostics.

### Tags

```text
strategic-risk, mcp, a2a, evidence-audit, source-coverage, scoring, policy-analysis, geopolitics, sanctions-adjacent, regulation, analyst-tools
```

### Capabilities

- Validate strategic-risk request and memo schemas.
- Audit claim/evidence linkage.
- Diagnose source coverage against configured source requirements.
- Verify quote presence inside caller-provided text.
- Score before/after analyst outputs.
- Route geography-specific strategic-risk modules.
- Expose A2A examples for `middle_corridor_deal_risk`, `audit_claims`, `source_coverage`, and `score_output`.

### Boundary copy

> Stateless evidence and quality layer. No autonomous live retrieval by default. No factual-truth verification. No legal, compliance, sanctions, financial, investment, insurance, or trading advice. Customer prompts, source packs, memo content, and API keys are not persisted by default.

## Positioning rule

Lead with the vertical use case, then mention the platform:

1. Kazakhstan / Middle Corridor Deal Risk Gate is the buyer-facing product.
2. Agenda Intelligence MD is the evidence-discipline engine behind it.
3. MCP, HTTP, A2A, Docker, PyPI, and examples are deployment surfaces, not the main promise.

Avoid generic claims such as "AI analyst for everything" or "sanctions compliance agent." The stronger promise is narrower:

> Bring dated sources. Get auditable deal-risk triage, evidence gaps, source coverage, and human-review readiness.
