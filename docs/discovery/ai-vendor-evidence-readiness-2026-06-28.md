# AI vendor evidence-readiness wedge

Status: discovery, public-signal only.
Date: 2026-06-28.
Mode: `build-to-learn`.

This is the current commercial discovery wedge for Agenda Intelligence MD. It should not create a new worker until buyer evidence passes the market gate. The first artifact is an evidence-readiness profile built from public RFP language, vendor claims, standards, and public documentation.

## Gate

Economic buyer:

- Regulated procurement owner, vendor-risk lead, AI governance lead, public-sector CIO / Chief AI Officer, or delegated AI assurance owner who can block or approve AI vendor adoption.

Painful trigger this month:

- A team must approve, reject, shortlist, or escalate an AI vendor / AI-assisted workflow under new governance expectations, but the evidence packet is scattered across RFP answers, vendor pages, security docs, model cards, policy claims, and standards mappings.

Current workaround:

- Manual RFP questionnaires, spreadsheets, security / privacy / legal review, vendor self-attestations, policy templates, consultant memos, and ad hoc governance meetings.

Observed public evidence:

- OMB M-25-22 frames AI acquisition as a governed procurement workflow and instructs agencies to perform market research, acquisition planning, and risk-aware vendor review.
- EU AI Act documentation, record-keeping, transparency, and human-oversight obligations make evidence packets material for high-risk systems.
- NIST AI RMF is widely used as a common AI risk-management vocabulary.
- ISO/IEC 42001 formalizes AI management-system requirements that buyers can ask vendors to evidence.
- NAIC's AI Systems Program bulletin creates an insurance-sector governance and third-party oversight frame.
- Healthcare AI governance groups have public model-card / assurance artifacts that make vendor evidence comparable without needing private data first.

Inference:

- Buyers who already write AI governance language into RFPs may pay for faster evidence-readiness triage before procurement, security, legal, or AI governance committee review.

Unknown:

- Whether the budget sits with procurement, vendor risk, AI governance, compliance ops, or the business owner.
- Whether buyers will share redacted RFPs / vendor packets.
- Whether the pain is urgent enough to pay for concierge review before software exists.

Kill criteria:

- After 10-15 target conversations, no buyer can name a recent AI vendor review delayed by missing evidence.
- Fewer than two teams provide a redacted or public artifact for teardown.
- No one asks for a second packet, paid concierge review, or budget-owner intro.
- Buyers say existing GRC / procurement tooling already solves the evidence-readiness problem well enough.
- The workflow collapses into legal/compliance advice rather than evidence-readiness for human review.

## Product wedge

AI Vendor Evidence-Readiness Profile:

- Input: public RFP, vendor page, security / trust page, model card, AI policy, public docs, and relevant standards references.
- Output: supported claims, weak claims, missing evidence, unanswered buyer questions, owner actions, and readiness for human review.
- Boundary: no legal advice, no compliance advice, no factual-truth verification, no vendor approval, no autonomous decision.

## Public-source set

Use these source families first:

- OMB M-25-22, AI acquisition in government: <https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-22-Driving-Efficient-Acquisition-of-Artificial-Intelligence-in-Government.pdf>
- NIST AI RMF: <https://www.nist.gov/itl/ai-risk-management-framework>
- EU AI Act technical documentation: <https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-11>
- EU AI Act record keeping: <https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-12>
- ISO/IEC 42001: <https://www.iso.org/standard/42001>
- NAIC Model Bulletin on AI Systems: <https://content.naic.org/sites/default/files/inline-files/2023-12-4%20Model%20Bulletin_Adopted_0.pdf>
- CHAI Applied Model Card: <https://www.chai.org/workgroup/applied-model>
- OWASP Agentic AI Threats and Mitigations: <https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/>
- CSA AI Controls Matrix: <https://cloudsecurityalliance.org/artifacts/ai-controls-matrix-v1-1>

## 30-day validation plan

Week 1:

- Collect 10 public RFPs or procurement documents containing AI governance / AI risk / audit-readiness language.
- Collect 20 vendor public pages from AI governance, healthcare AI, HR AI, public-sector AI, or model-risk vendors.
- Mark each artifact with buyer, required evidence, stated controls, missing evidence, review owner, and decision moment.

Week 2:

- Produce three public evidence-readiness profiles using the template in `docs/templates/ai-vendor-evidence-readiness-profile.md`.
- Choose one regulated-procurement profile, one healthcare-AI profile, and one insurance-AI-governance profile.

Week 3:

- Show profiles to 10 target reviewers.
- Ask about past behavior only: last AI vendor review, what evidence was missing, who blocked approval, what workaround they used, who owned budget.
- Do not ask "would you use this?"

Week 4:

- Offer a 72-hour concierge evidence-readiness packet for one RFP/vendor/use case.
- Success: two teams ask for a second packet, one team agrees to pay or introduces a budget owner, or a reviewer supplies a concrete workflow correction that changes the profile.
- Kill or pivot if the response is only compliments or generic interest.

## What not to build

- No new vertical worker.
- No AI governance platform.
- No dashboard.
- No legal/compliance/sanctions advice.
- No automated vendor approval.
- No broad market map unless it produces a concrete artifact teardown and buyer test.
