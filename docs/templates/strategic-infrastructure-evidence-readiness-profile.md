# Strategic Infrastructure Evidence-Readiness Profile

Use this template for confidential or redacted strategic infrastructure projects where a sponsor, public authority, lender, procurement team, or investment committee needs to know whether the project file is ready for human review.

This is a research and concierge artifact, not a schema contract and not a worker spec. It does not approve a project, validate legal or tax treatment, clear export controls, recommend financing, or make an investment decision.

Use aliases by default. See [`../trust/confidential-project-workflow.md`](../trust/confidential-project-workflow.md).

## Header

- Profile date:
- Reviewer:
- Project alias:
- Buyer hypothesis:
- Artifact type: feasibility study / RFP / vendor proposals / financing data room / committee memo / mixed packet
- Project type: AI compute / data center / energy / logistics / industrial / other
- Decision moment: RFP shortlist / lender review / public-authority review / committee review / FID / financial close / phase gate
- Evidence mode: public-only / buyer-provided redacted / mixed
- Confidentiality mode: synthetic / redacted / private internal

## Market gate

- Economic buyer:
- Painful trigger this month:
- Current workaround:
- Observed evidence:
- Inference:
- Unknown:
- Kill criterion tested by this profile:

## Source pack

| ID | Source role | Date / age | Confidentiality | Type | Location / reference | Notes |
|---|---|---:|---|---|---|---|
| S1 |  | current / stale / unknown | public / redacted / confidential | feasibility / RFP / proposal / memo / LOI / model / official / other |  |  |

## Decision questions implied by the packet

| Question | Why it matters | Evidence needed | Likely owner |
|---|---|---|---|
| Is the project ready for the next committee or lender review? |  |  | PMO / CFO / M&A |
| Is the procurement path deliverable under the stated constraints? |  |  | procurement / CTO / legal |
| Is demand strong enough to support the financing case? |  |  | commercial / CFO / lender |
| Are site, power, permits, and delivery dates evidenced rather than assumed? |  |  | technical / site / public authority |
| Are tax, customs, incentive, or export-control assumptions supported by named source types? |  |  | tax / legal / compliance |

## Project claims

| Claim | Claim type | Evidence present | Evidence gap | Risk if wrong | Readiness |
|---|---|---|---|---|---|
|  | demand / procurement / site-power / financing / tax-customs / regulatory / governance / schedule / risk-mitigation |  |  |  | supported / partial / weak / missing / not assessable |

## Bankability block review

| Block | Minimum evidence expected | Evidence found | Gap | Owner action | Block status |
|---|---|---|---|---|---|
| Demand / offtake | Signed or near-binding customer evidence with volume, term, pricing logic, budget owner, and conditions |  |  |  | ready / weak / blocked |
| Procurement / vendor delivery | Comparable vendor proposals, TCO, delivery terms, warranties, service model, supply-chain and export-control conditions |  |  |  | ready / weak / blocked |
| Site / power / infrastructure | Site control, power allocation, grid/interconnection status, cooling plan, commissioning schedule, environmental constraints |  |  |  | ready / weak / blocked |
| Financing | Indicative terms, lender diligence requests, sponsor equity plan, covenants, conditions precedent, funding timeline |  |  |  | ready / weak / blocked |
| Tax / customs / incentives | Tax memo, customs treatment, incentive eligibility, assumptions tied to official or adviser-reviewed source types |  |  |  | ready / weak / blocked |
| Regulatory / export-control | Applicable restrictions, approval path, ownership/end-use constraints, counsel or compliance review status |  |  |  | ready / weak / blocked |
| Governance / operator readiness | ProjectCo structure, signatories, key hires, policies, risk ownership, operating model |  |  |  | ready / weak / blocked |
| Risk register maturity | Prioritized risks, owner, mitigation, evidence required, escalation route, deadline |  |  |  | ready / weak / blocked |

## Evidence-readiness decision

Choose one:

- `ready_for_human_review`
- `not_decision_ready`
- `escalate_before_committee`
- `escalate_before_FID`
- `insufficient_public_evidence`
- `insufficient_redacted_evidence`

Rationale:

-

## Unsafe-to-repeat claims

List claims that should not be repeated to lenders, public authorities, vendors, customers, or investment committees without caveat or additional evidence.

| Claim | Why unsafe | Evidence needed before reuse | Owner |
|---|---|---|---|
|  |  |  |  |

## Missing evidence

| Priority | Missing evidence | Why it blocks review | Suggested owner action |
|---|---|---|---|
| P0 / P1 / P2 |  |  |  |

## Human-review packet

Summary for reviewer:

-

What is ready:

-

What is weak:

-

What must be asked before the next decision:

-

## Boundary notes

- This profile does not approve or reject the project.
- This profile does not provide legal, compliance, procurement, security, tax, customs, financial, insurance, sanctions, export-control, or investment advice.
- This profile checks evidence readiness and claim support using supplied, redacted, or public sources.
- Factual truth, regulatory interpretation, model validation, technical due diligence, legal conclusions, and investment decisions remain outside this artifact.

## Follow-up signal

After showing the profile, record observed buyer behavior:

- Redacted file offered: yes / no
- Second artifact requested: yes / no
- Paid concierge interest: yes / no
- Budget-owner or process-owner intro: yes / no
- Concrete workflow correction: yes / no
- Only compliment / generic interest: yes / no
