# Kazakhstan / Middle Corridor Deal Risk Gate

Flagship commercial use case for Agenda Intelligence MD.

## Proposition

Bring route, cargo, counterparties, and dated sources. Get an auditable corridor-risk triage with evidence gaps, source coverage, watch-next indicators, and human-review escalation.

This is not legal, compliance, investment, insurance, or sanctions advice. It is a pre-compliance evidence and decision-readiness gate for analyst, compliance-adjacent, logistics, procurement, trade-finance, and insurance workflows.

## Target users

- Logistics and freight forwarding teams evaluating Kazakhstan-Caspian routes.
- Commodity, industrial equipment, and procurement teams using Middle Corridor transit.
- Trade-finance, insurance, and compliance-adjacent teams checking whether a file is ready for human review.
- Consultants preparing route-risk memos for clients or management.

## Input shape

```json
{
  "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
  "cargo": "industrial equipment",
  "counterparties": ["shipper", "forwarder", "consignee"],
  "risk_question": "Should this be escalated before contract signature?",
  "dated_sources": [
    {
      "id": "e1",
      "source_type": "port_operator_notice",
      "title": "Port notice",
      "date": "2026-05-20",
      "url": "https://example.com/port-notice"
    }
  ]
}
```

## Output shape

```json
{
  "triage_recommendation": "escalate_before_signature",
  "risk_signal": "medium-high",
  "top_risks": [
    "sanctions adjacency",
    "Caspian chokepoint dependency",
    "customs/documentation uncertainty",
    "insurance exclusions"
  ],
  "evidence_gaps": [
    "No dated sanctions-list extracts supplied.",
    "No counterparty registry extract supplied.",
    "No vessel or carrier history supplied.",
    "No insurance clause or underwriter note supplied."
  ],
  "watch_next": [
    "new sanctions designations",
    "port delays or operator notices",
    "rail capacity constraints",
    "customs enforcement changes"
  ],
  "human_review_required": true
}
```

## A2A listing

- Live endpoint: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send>
- Agent card: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json>
- Agenstry listing: <https://agenstry.com/agents/kazakhstan-corridor-risk-a2a.vassiliy-lakhonin.workers.dev>

## Commercial packaging

Start with one flagship agent, not a wide catalog:

**Kazakhstan / Middle Corridor Deal Risk Gate**

Then expose these as skills:

- Middle Corridor deal desk triage.
- Middle Corridor source coverage auditor.
- Sanctions adjacency evidence gate.
- Risk memo quality gate.
- A2A evidence pack linter.

Separate agents can be created later only if usage shows clear demand.
