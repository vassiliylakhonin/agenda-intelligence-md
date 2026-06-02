# Kazakhstan / Middle Corridor Deal Risk Gate

Flagship commercial use case for Agenda Intelligence MD.

## Proposition

Bring route, cargo, counterparties, and dated sources. Get an auditable corridor-risk triage with evidence gaps, source coverage, watch-next indicators, and human-review escalation.

This is a **pre-screening evidence triage layer**: it tells you which due-diligence documents are still missing before a deal's counterparties are committed to a sanctions-screening or network-intelligence tool. It complements those tools rather than replacing them — it performs no screening, name-matching, or live data retrieval itself, and holds no proprietary lists or ownership graph. Its job is to make the evidence dossier complete and auditable before the expensive data step, not to be that step.

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
  "risk_signal": "medium_high",
  "decision_readiness_score": 42,
  "decision_readiness_label": "not_decision_ready",
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
  "human_review_required": true,
  "counterparty_readiness": {
    "status": "partial",
    "required_total": 6,
    "supplied_count": 1,
    "missing_count": 5,
    "outstanding_documents": [
      "counterparty_registry_extract",
      "beneficial_ownership_source",
      "customs_or_regulatory_source",
      "insurance_clause_or_underwriter_note",
      "vessel_or_carrier_history"
    ],
    "document_ledger": [
      { "source_type": "sanctions_list_extract", "status": "received", "date_received": "2026-05-21" },
      { "source_type": "beneficial_ownership_source", "status": "missing" }
    ],
    "presentable_note": "Dossier-completeness view for presenting enhanced-due-diligence evidence to a bank, insurer, or counterparty. Tracks completeness of the required-before-go evidence set only; it is not clearance, approval, a sanctions determination, or compliance advice. Human review is required before any commercial action."
  }
}
```

## A2A listing

- Live endpoint: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send>
- Agent card: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json>
- Agenstry listing: <https://agenstry.com/agents/middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev>
- Live test: [`../agenstry/kazakhstan-live-test.md`](../agenstry/kazakhstan-live-test.md)

## Product contract

The product-grade interface is structured JSON, not free-text prompting. Use the request and response schemas when integrating this workflow into deal desks, analyst QA, procurement reviews, trade-finance file checks, or insurance handoffs:

- Request schema: [`../../schemas/v1/middle-corridor-deal-risk-request.schema.json`](../../schemas/v1/middle-corridor-deal-risk-request.schema.json)
- Response schema: [`../../schemas/v1/middle-corridor-deal-risk-response.schema.json`](../../schemas/v1/middle-corridor-deal-risk-response.schema.json)
- Source taxonomy: [`../../source-requirements/middle-corridor-deal-risk.json`](../../source-requirements/middle-corridor-deal-risk.json)
- Contract examples: [`../../examples/kazakhstan-middle-corridor/contract/`](../../examples/kazakhstan-middle-corridor/contract/)

The live A2A wrapper remains a demo and discovery convenience: it proves the route-risk framing, returns a useful first-pass triage, and helps directories such as Agenstry probe the public agent. It is not the canonical enterprise integration surface. The canonical contract is the structured request/response pair above, with explicit source categories, evidence gaps, human-review routing, and the non-advice notice carried in every response.

`decision_readiness_score` is a heuristic 0-100 evidence-pack readiness score for human review. It is not approval, clearance, compliance status, or advice. In buyer language: a low score means the file is not ready to send to a committee, insurer, client, or sign-off workflow because required source categories are missing.

`counterparty_readiness` reframes the same evidence-gap picture for the other actor. The score above answers the internal question — "should we escalate before signature?". The `counterparty_readiness` object answers the outward question a Kazakhstan / Central Asia party faces under tightened enhanced due diligence: "how complete is the dossier I must present to a bank, insurer, or counterparty?". Same required-before-go contract, no new evidence logic — `status` (`insufficient_information` / `incomplete` / `partial` / `complete_for_review`), the supplied-vs-required counts, and `outstanding_documents` (the source types still to obtain). It tracks dossier-completeness only; it is not clearance, approval, a sanctions determination, or compliance advice, and human review is still required.

`counterparty_readiness.document_ledger` mirrors the EDD chain-of-custody practice that guidance prescribes — tracking each required item with the date it was received. One entry per required-before-go source type, each `received` or `missing`, with `date_received` taken from the earliest supplied dated source of that type. It is status tracking only — not verification of any document's contents or authenticity.

When end-user / no-re-export evidence is not among the supplied sources, the response also carries `reexport_control_indicators`: an end-use verification checklist (signed end-user statement, no-re-export clause acceptance, end-use consistency, onward-destination disclosure, order-vs-destination match) drawn from EU Sanctions Helpdesk and US diversion red flags. It mirrors the `vessel_due_diligence_indicators` pattern — an evidence-gap checklist routed to human review, not an end-use or sanctions determination, and it does not change the `decision_readiness_score`. Supply a dated `end_user_or_reexport_evidence` source to close it.

Similarly, when source-of-funds / source-of-wealth evidence is not among the supplied sources, the response carries `source_of_funds_indicators`: an SOF/SOW verification checklist (source-of-funds and source-of-wealth evidence, profile/size consistency, payer match, funds-jurisdiction flag) drawn from FATF Recommendation 10 EDD guidance. Same pattern and boundary as the other checklists — routed to human review, not a financial determination or AML clearance, and it does not change the `decision_readiness_score`. Supply a dated `source_of_funds_or_wealth_evidence` source to close it.

And when PEP-screening evidence is not among the supplied sources, the response carries `pep_screening_indicators`: a politically-exposed-person screening checklist (counterparty + beneficial-owner PEP screening, family / close associates, senior-management approval, enhanced SOF/SOW, ongoing monitoring) drawn from FATF Recommendations 12 and 22. Same pattern and boundary — a checklist of what to screen routed to human review, never a PEP determination or political-exposure judgment, and it does not change the `decision_readiness_score`. Supply a dated `pep_screening_evidence` source to close it.

The boundary is part of the contract: no legal, compliance, sanctions, financial, investment, insurance, or trading advice; no autonomous live retrieval; no factual-truth verification; no authorization decision.

### Buyer-facing scenarios

| Scenario | What the user brings | What the agent returns |
|---|---|---|
| Pre-signature logistics deal | Route, cargo, counterparties, port notice, sanctions extract, carrier note | `42/100`, `escalate_before_signature`, missing registry, ownership, customs, insurance, vessel/carrier history |
| Pre-shipment evidence check | Full evidence pack before goods move | Higher readiness score, remaining source gaps, watch-next indicators for delays, customs, insurance, and carrier history |
| Committee review file readiness | Existing memo plus evidence pack | Human-review routing, missing source categories, evidence gaps, and a non-advice notice suitable for analyst QA |
| Counterparty dossier readiness | Same evidence pack, viewed outward | `counterparty_readiness`: dossier-completeness `status`, supplied-vs-required counts, and `outstanding_documents` still to obtain before presenting to a bank, insurer, or counterparty |

### Live structured JSON test

The hosted A2A wrapper accepts the product contract as JSON-RPC `params.request` and returns the contract response under `result.metadata.triage.deal_risk_contract`:

```bash
jq -n --slurpfile request examples/kazakhstan-middle-corridor/contract/pre_signature_escalate.request.json \
  '{jsonrpc:"2.0", id:"middle-corridor-contract-test", method:"message/send", params:{request:$request[0]}}' |
  curl -sS https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send \
    -H 'content-type: application/json' \
    --data @-
```

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
