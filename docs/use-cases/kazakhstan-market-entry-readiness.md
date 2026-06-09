# Kazakhstan Market Entry Readiness Gate

Use-case contract for Agenda Intelligence MD.

## Proposition

Bring a company, product or project concept, Kazakhstan commercial objective, counterparties, and dated sources. Get a market-entry readiness triage with evidence gaps, claim status, owner actions, watch-next indicators, and human-review routing.

This is an evidence and decision-readiness layer for Kazakhstan market entry. It helps analysts, consultants, project teams, partner managers, and commercial leads decide whether a file is ready for validation, signature, import, showroom or launch spend, dealer appointment, or committee review.

It is not legal, compliance, customs, tax, financial, investment, insurance, sanctions, or launch-authorization advice. It does not verify factual truth, approve counterparties, or replace professional review.

## Target users

- Project and partner managers preparing Kazakhstan market-entry files.
- International companies evaluating Kazakhstan distribution, branch, LLP, representative-office, importer, dealer, or service models.
- Commercial teams checking whether evidence is sufficient before budget, inventory, showroom, advertising, or partner commitments.
- Consultants preparing management-ready gate memos for leadership, banks, law firms, customs brokers, certification advisors, or investors.

## Best-fit scenarios

- Foreign company considering Kazakhstan distribution.
- Product supplier planning import, sales, service, and local contracting.
- EPC, renewable-energy, infrastructure, mobility, technology-transfer, or industrial partner entering Kazakhstan.
- Deal team preparing a file before law-firm, customs-broker, certification, freight, bank, or committee review.
- Partner manager separating confirmed facts from assumptions before a public-facing commitment.

## Input shape

```json
{
  "project_name": "Kazakhstan market-entry review",
  "partner_or_company": "Example Mobility Company",
  "market": "Kazakhstan / Almaty first",
  "sector": "mobility",
  "commercial_objective": "Evaluate Kazakhstan distribution, import, service, showroom, and partner-entry readiness.",
  "decision_question": "Can the project move from concept discussion to controlled validation?",
  "decision_stage": "pre_signature",
  "counterparties": [
    {
      "role": "supplier",
      "name": "Example Mobility Company",
      "jurisdiction": "China"
    },
    {
      "role": "law_firm",
      "name": "Kazakhstan counsel",
      "jurisdiction": "Kazakhstan"
    }
  ],
  "supplied_sources": [
    {
      "id": "s1",
      "source_type": "partner_company_profile",
      "title": "Company profile",
      "date": "2026-06-01"
    },
    {
      "id": "s2",
      "source_type": "product_or_project_description",
      "title": "Product catalogue",
      "date": "2026-06-01"
    }
  ],
  "known_assumptions": [
    "Public cost benchmarks are not signed quotes.",
    "Supplier prices are not landed costs."
  ],
  "requested_output": "both"
}
```

## Output shape

```json
{
  "gate_decision": "proceed_to_validation",
  "readiness_label": "validation_ready",
  "human_review_required": true,
  "summary": "The opportunity appears commercially attractive, but the file is not launch-commitment-ready until legal, customs, certification, landed-cost, service, and partner evidence gaps are closed.",
  "strongest_reason_to_proceed": "The market-entry thesis is coherent and has enough initial material for structured validation.",
  "strongest_reason_to_pause": "The evidence pack is not sufficient for signature, import, lease, inventory, or public launch commitments.",
  "evidence_gaps": [
    {
      "source_type": "law_firm_opinion",
      "evidence_needed": "Written recommendation on branch, representative office, LLP, distributor, importer, or dealer structure.",
      "why_it_matters": "The legal form affects sales, import, service, tax, contracting, and liability.",
      "owner": "Local legal counsel",
      "next_action": "Request a short written legal-structure memo.",
      "decision_blocked": "Signature or entity setup."
    }
  ],
  "watch_next": [
    "customs rule change",
    "certification requirement change",
    "freight rate change"
  ],
  "management_note": "The project can move to validation, but should not move to commitment until the evidence gaps are closed.",
  "boundary_notice": "Internal evidence triage only. Not legal, compliance, customs, tax, financial, investment, insurance, sanctions, or launch-authorization advice."
}
```

## Product contract

The product-grade interface is structured JSON, not free-text prompting.

- Request schema: [`../../schemas/v1/market-entry-readiness-request.schema.json`](../../schemas/v1/market-entry-readiness-request.schema.json)
- Response schema: [`../../schemas/v1/market-entry-readiness-response.schema.json`](../../schemas/v1/market-entry-readiness-response.schema.json)
- Source taxonomy: [`../../source-requirements/kazakhstan-market-entry-readiness.json`](../../source-requirements/kazakhstan-market-entry-readiness.json)
- Contract example: [`../../examples/kazakhstan-market-entry-readiness/contract/pre_signature_validation.request.json`](../../examples/kazakhstan-market-entry-readiness/contract/pre_signature_validation.request.json)

## Decision stages

- `concept_review`
- `pre_entity_setup`
- `pre_signature`
- `pre_import`
- `pre_certification`
- `pre_showroom_lease`
- `pre_first_batch_order`
- `pre_ad_spend`
- `pre_dealer_contract`
- `committee_review`
- `other`

## Gate decisions

- `proceed_to_validation` - enough to continue interviews, quotes, advisor checks, and controlled validation.
- `pause_for_evidence` - commercially interesting, but missing evidence blocks the next decision.
- `escalate_before_signature` - do not sign, appoint, lease, buy, import, announce, or commit until senior or advisor review.
- `not_decision_ready` - too little evidence to make even a controlled next-step decision.
- `stop` - known blocker makes the path impractical unless the project changes.

## Readiness labels

- `insufficient_information` - project basics missing.
- `concept_ready` - idea is coherent, but evidence pack is thin.
- `validation_ready` - enough for structured validation and advisor requests.
- `committee_review_ready` - evidence pack is strong enough for leadership or advisor review.
- `launch_commitment_ready` - only when legal, customs, certification, economics, service, partners, and budget are confirmed.

## Minimum evidence before common commitments

### Before validation

- Partner company profile.
- Product or project description.
- Kazakhstan use case.
- Commercial objective.
- Initial source links or documents.

### Before signature

- Law-firm opinion.
- Counterparty registry extract.
- Beneficial ownership source.
- Business-substance evidence.
- Authority-to-sign evidence.
- Contract or term-sheet draft.
- Tax/accounting note.

### Before import or first batch

- Customs-broker memo.
- HS code classification.
- Certification pathway.
- Packing list and Incoterms.
- Battery or product-safety documents where relevant.
- Freight-forwarder quote.
- Insurance or cargo-handling note.
- Landed-cost model.
- Supplier MOQ and payment terms.

### Before showroom or public launch

- Showroom lease offer.
- Showroom OPEX model.
- Outdoor advertising quote, if applicable.
- Localized customer materials.
- Warranty policy.
- Service-partner confirmation.
- Spare-parts price list.
- Demo-unit plan.
- Test-ride or pilot safety process.

### Before dealer or fleet expansion

- Dealer interview notes.
- Fleet customer validation.
- Dealer margin model.
- Fleet TCO model.
- Financing or leasing partner note.
- Service SLA draft.
- Regional expansion assumption register.

## Boundary

This use case is an internal evidence and decision-readiness gate. It is not legal, compliance, customs, tax, financial, investment, insurance, sanctions, or launch-authorization advice. Human review is required before signature, import, payment, lease, inventory purchase, public announcement, advertising commitment, dealer appointment, or partner appointment.
