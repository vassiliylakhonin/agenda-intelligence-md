# Strategic Infrastructure Evidence-Readiness Profile

Profile date: 2026-06-28  
Reviewer: Agenda Intelligence MD synthetic example  
Project alias: ProjectCo AI Compute Facility  
Artifact type: mixed redacted packet  
Decision moment: committee review before procurement shortlist  
Evidence mode: buyer-provided redacted  
Confidentiality mode: synthetic

This example uses aliases only. It is not based on a real project.

## Market Gate

- Economic buyer: sponsor CFO, PMO lead, and investment committee secretary.
- Painful trigger this month: the team must decide whether the file is ready for committee review before vendor shortlist and lender follow-up.
- Current workaround: weekly status notes, spreadsheet risk register, adviser comments, and separate procurement/legal/commercial workstreams.
- Observed evidence: synthetic source pack contains a feasibility excerpt, RFP summary, partial vendor proposal, customer LOI, lender email, tax note, and risk-register draft.
- Inference: the workflow may save review time if it converts scattered updates into owner-specific missing-evidence actions.
- Unknown: whether the committee already has a stronger internal data-room checklist.
- Kill criterion tested by this profile: if reviewers say the missing-evidence table duplicates existing PMO workflow and does not change actions, the wedge is weak.

## Source Pack

| ID | Source role | Date / age | Confidentiality | Type | Notes |
|---|---|---:|---|---|---|
| S1 | Feasibility study excerpt | current | redacted | feasibility | Contains project rationale and high-level economics, but not final vendor pricing. |
| S2 | RFP summary | current | redacted | RFP | Lists technical scope and commercial proposal deadline. |
| S3 | Vendor proposal excerpt | current | redacted | proposal | Provides indicative pricing and delivery assumptions, but omits export-control conditions. |
| S4 | Customer LOI | current | redacted | LOI | Non-binding expression of interest; no committed volume, term, or pricing. |
| S5 | Lender email | current | redacted | financing | Requests updated model, vendor quotes, and customer evidence before term-sheet discussion. |
| S6 | Tax note | unknown | redacted | tax memo | Mentions possible import treatment but lacks final adviser conclusion. |
| S7 | Risk-register draft | current | redacted | risk register | Lists risk themes, but several entries lack owner, mitigation, and trigger. |

## Decision Questions Implied by the Packet

| Question | Why it matters | Evidence needed | Likely owner |
|---|---|---|---|
| Is the packet ready for committee review? | Committee should not decide on a file with unsupported economics or demand. | Finalized claim table, vendor proposals, financing conditions, demand evidence, and risk owner actions. | PMO / CFO |
| Is procurement deliverable under the stated constraints? | Shortlist decision can fail if proposal assumptions are not comparable or supply route is unconfirmed. | Comparable proposals, delivery terms, restriction review, warranties, and service model. | Procurement / CTO / legal |
| Is demand strong enough to support financing? | Lenders will discount non-binding interest without volume, term, and credit evidence. | Signed or near-binding offtake evidence, budget-owner confirmation, and pricing logic. | Commercial / CFO |
| Are tax and import assumptions ready to use in the model? | An unsupported tax benefit can materially distort project economics. | Adviser-reviewed memo or official-source-backed treatment. | Tax / legal |

## Project Claims

| Claim | Claim type | Evidence present | Evidence gap | Risk if wrong | Readiness |
|---|---|---|---|---|---|
| ProjectCo can proceed to committee review with current economics. | financing | S1, S3, S5 | Final vendor pricing and lender-required source pack are missing. | Committee may approve a model that changes materially. | weak |
| Procurement can be shortlisted from the current RFP process. | procurement | S2, S3 | Only one partial proposal is represented; comparability and restrictions are not evidenced. | Shortlist may be premature or non-comparable. | partial |
| Customer demand supports the base-case utilization assumption. | demand | S4 | LOI is non-binding and lacks volume, term, pricing, and budget-owner evidence. | Revenue case may be overstated. | weak |
| Site and infrastructure readiness support the target schedule. | site-power | S1 | No separate site-control, power-allocation, cooling, interconnection, or commissioning evidence in the packet. | Schedule and CAPEX may slip. | missing |
| Tax treatment improves project economics. | tax-customs | S6 | No final adviser conclusion, legal basis, or applicability test. | Model may understate cost. | weak |
| The risk register is ready for committee use. | risk-mitigation | S7 | Several risks lack owner, mitigation, trigger, and evidence required. | Committee may see activity but not accountable mitigation. | partial |

## Bankability Block Review

| Block | Evidence found | Gap | Owner action | Block status |
|---|---|---|---|---|
| Demand / offtake | One non-binding LOI. | No committed volume, term, pricing, budget owner, or termination conditions. | Request a redacted term sheet or structured customer letter. | blocked |
| Procurement / vendor delivery | RFP summary and one partial proposal. | No comparable proposal matrix or restriction review. | Build vendor-comparison table and request missing delivery/compliance terms. | weak |
| Site / power / infrastructure | High-level feasibility claim only. | Missing site-control and power/cooling evidence. | Add site evidence and commissioning assumptions. | blocked |
| Financing | Lender email asks for more evidence. | No term sheet or conditions precedent. | Convert lender questions into data-room checklist. | weak |
| Tax / customs / incentives | Preliminary tax note. | No final applicability conclusion. | Obtain adviser-reviewed treatment and model sensitivity. | weak |
| Regulatory / export-control | Not separately evidenced. | Restrictions and end-use path unknown. | Route to legal/compliance for source-backed review. | blocked |
| Governance / operator readiness | Not separately evidenced. | Operator structure, signatories, and key hires not shown. | Add operator readiness checklist. | weak |
| Risk register maturity | Risk themes listed. | Missing owners, mitigations, triggers, deadlines. | Convert risk themes into owner-action rows. | weak |

## Evidence-Readiness Decision

`not_decision_ready`

Rationale: the packet shows active workstreams, but the load-bearing claims for demand, procurement, site readiness, tax treatment, restrictions, and financing are not yet supported enough for committee review.

## Unsafe-To-Repeat Claims

| Claim | Why unsafe | Evidence needed before reuse | Owner |
|---|---|---|---|
| "Demand is secured." | Current source is a non-binding LOI without commercial terms. | Signed or near-binding offtake evidence. | Commercial / CFO |
| "Procurement is ready for shortlist." | Only one partial proposal is represented. | Comparable vendor matrix and restriction review. | Procurement / CTO |
| "Tax treatment materially improves economics." | Preliminary note does not establish applicability. | Adviser-reviewed memo and model sensitivity. | Tax / legal |
| "The project is ready for committee approval." | Several bankability blocks are weak or blocked. | Completed missing-evidence table and risk owner actions. | PMO |

## Missing Evidence

| Priority | Missing evidence | Why it blocks review | Suggested owner action |
|---|---|---|---|
| P0 | Comparable vendor proposal matrix | Committee cannot evaluate CAPEX, TCO, delivery, and restrictions. | Procurement prepares matrix and requests missing terms. |
| P0 | Demand evidence with commercial terms | Financing case depends on credible utilization and revenue. | Commercial obtains redacted term sheet or structured customer letter. |
| P0 | Site/power/cooling evidence | Schedule and feasibility depend on physical readiness. | Technical owner adds source-backed site packet. |
| P1 | Tax/customs applicability conclusion | Model assumptions may be materially wrong. | Tax owner obtains final adviser position. |
| P1 | Restrictions and supply-chain review | Procurement may be non-deliverable. | Legal/compliance creates review note and escalation path. |
| P1 | Risk register owner-action conversion | Risks are visible but not managed. | PMO assigns owner, mitigation, trigger, and due date. |

## Boundary Notes

- This profile does not approve or reject ProjectCo.
- This profile does not provide legal, compliance, procurement, security, tax, customs, financial, insurance, sanctions, export-control, or investment advice.
- This profile checks evidence readiness and claim support using synthetic source roles.
- Factual truth, regulatory interpretation, technical due diligence, legal conclusions, and investment decisions remain outside this artifact.
