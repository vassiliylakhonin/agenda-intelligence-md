# AI governance RFP corpus scan

Status: public artifact scan, not outreach and not a product build.
Date: 2026-06-28.
Mode: `build-to-learn`.

This scan tests whether the AI vendor evidence-readiness wedge is visible in public procurement and buyer-risk artifacts without relying on cold replies. The question is not "will someone take a call?" The question is whether public artifacts repeatedly require the same evidence categories before human procurement, AI governance, security, privacy, accessibility, audit, or committee review.

## Verdict

`explore`

Rationale:

- The same evidence-readiness requirements recur across public RFPs, procurement guidelines, and third-party AI risk guides: inventory, ownership, risk classification, policy workflow, monitoring, audit trail, security/privacy controls, supplier evidence, implementation proof, and human oversight.
- This supports a narrow wedge: **AI Vendor Evidence-Readiness Profile for regulated procurement and AI governance review**.
- It does not justify a new worker, dashboard, platform, or broad market claim.

## Corpus

| ID | Artifact | Buyer / author | Type | What it proves | Strength |
|---|---|---|---|---|---|
| C1 | UTHSA AI Governance and Monitoring Platform RFP 745-26-P33 | UT Health San Antonio | Public RFP | Healthcare/higher-ed buyer asks for centralized oversight, risk classification, policy enforcement, performance monitoring, lifecycle management, and audit readiness. | Strong buyer-workflow signal |
| C2 | TXShare AI Governance, Compliance, and Enablement Platform RFP 2026-010 | TXShare cooperative purchasing program | Public RFP | Municipal/government cooperative buying vehicle asks for centralized visibility into AI usage, risk management, policy approval workflows, public-records activity capture, security architecture, certifications, and capability gap disclosure. | Strong buyer-workflow signal |
| C3 | Oxfam Canada AI Governance Framework for Responsible Use RFP | Oxfam Canada | Public RFP / consultancy procurement | Nonprofit buyer asks for practical governance structure, ownership, escalation pathways, approval thresholds, AI use policy integration, privacy and human-rights safeguards, and context-specific deliverables. | Strong workflow signal, less SaaS-specific |
| C4 | UCO AI Ecosystem RFP Q&A | University of Central Oklahoma | Procurement Q&A | Buyer clarifies governance committee, formal change-management process, AI safety/ethics review, identity/access, data architecture, logging, failover, and analytics reporting expectations. | Strong implementation-readiness signal |
| C5 | Georgia Procurement of AI Tools Guidelines for Responsible Use | Georgia Technology Authority | Procurement guidance | State agencies are told to evaluate AI procurements for fairness, data security, transparency, and accountability. | Strong public-sector procurement signal |
| C6 | UC AI Council Risk Assessment Guide | University of California | Buyer risk guide / supplier questionnaire | Buyer-side guide explicitly covers procurement, development, and deployment of AI systems; supplier questions include governance, policies, and third-party assessment. | Strong questionnaire signal |
| C7 | OMB M-25-22, Driving Efficient Acquisition of AI in Government | U.S. OMB | Federal acquisition guidance | Public-sector AI acquisition includes market research, lifecycle requirements, monitoring, vendor lock-in protections, portability, and risk-management practices. | Strong top-down procurement signal |
| C8 | FS-ISAC Generative AI Vendor Evaluation and Qualitative Risk Assessment | FS-ISAC | Third-party risk guide | Financial-sector TPRM programs need structured GenAI vendor evaluation and qualitative risk assessment. | Strong regulated-sector vendor-risk signal |
| C9 | Health Sector Council Third-Party AI Risk and Supply Chain Transparency Guide | Health Sector Coordinating Council Cybersecurity Working Group | Healthcare third-party AI risk guide | Healthcare buyers need transparency, governance, cybersecurity, and supply-chain visibility for third-party AI. | Strong healthcare-specific signal |
| C10 | ModelOp AI Lifecycle Management and Governance RFP Template | ModelOp | Vendor-side RFP template | Market category language converges around inventory, lifecycle oversight, workflows, monitoring, reporting, integrations, and architecture. | Supporting vendor-market signal, not buyer proof |

## Repeating evidence requirements

| Requirement category | Appears in | Evidence buyer expects | Agenda Intelligence MD fit |
|---|---|---|---|
| AI inventory and visibility | C1, C2, C4, C10 | Inventory of AI tools/use cases/models, owners, departments, lifecycle stage, approvals, dependencies | Strong: evidence-readiness profile can check whether vendor packet proves inventory model and exportability |
| Risk classification / tiering | C1, C2, C5, C6, C7 | Risk taxonomy, high-risk triggers, data sensitivity, impact assessment, escalation logic | Strong: profile can separate claimed risk scoring from supplied methodology and examples |
| Governance workflow and policy approval | C1, C2, C3, C4, C5, C10 | Policy creation, approvals, signoffs, escalation pathways, approval thresholds, committee routing | Strong: maps directly to owner actions and human-review routing |
| Monitoring and performance evidence | C1, C2, C4, C7, C10 | Ongoing testing, model/performance monitoring, production issue reporting, dashboards, alerts | Strong: profile can identify missing monitoring artifacts |
| Audit trail / records / reporting | C1, C2, C4, C7, C10 | Logs, records retention, public-records capture, exportable reports, review cycles | Strong: profile can flag audit-readiness gaps |
| Security, privacy, and access controls | C1, C2, C4, C5, C6, C8, C9 | SSO/RBAC/IAM, data flows, data retention, cybersecurity, privacy safeguards, DLP / restricted-data handling | Strong: profile can route to security/privacy owner without giving security verdict |
| Supplier governance / vendor evidence | C2, C5, C6, C7, C8, C9 | Supplier policies, third-party assessments, certifications, references, implementation history, capability gaps | Strong: vendor evidence-readiness is the core wedge |
| Implementation and change management | C1, C3, C4, C7 | Implementation plan, change advisory cadence, training, knowledge transfer, adoption plan, post-award monitoring | Medium-strong: useful for concierge review / implementation readiness |
| Human oversight and accountability | C1, C3, C5, C6, C7 | Roles/responsibilities, human-in-the-loop review, accountability, escalation and override paths | Strong: directly maps to trust-routing / human-review packet |
| Context-specific adaptation | C1, C3, C4, C9 | Healthcare/higher-ed, nonprofit/humanitarian, public-sector, or regulated-sector fit; no boilerplate frameworks | Strong: profile can flag generic vendor claims as weak evidence |

## Buyer roles by requirement

| Buyer role | Owns these gaps | Why it matters |
|---|---|---|
| Procurement | RFP responsiveness, implementation plan, references, pricing/catalog evidence, accessibility/certification packet | Determines whether proposal is complete enough to score or shortlist |
| AI governance lead | AI inventory, risk tiering, policy workflow, oversight committee routing, human-review process | Owns the operating model and approval logic |
| Security / CISO | IAM, RBAC, DLP, telemetry, data flow, cybersecurity certifications, incident handling | Blocks unsafe vendor adoption before deployment |
| Privacy / data governance | PHI/student data, sensitive data categories, retention, consent/notice, data usage limits | Blocks or escalates if data handling is unclear |
| Internal audit / records | audit trail, retention, exportability, public-records compliance, report evidence | Needs durable review packet, not marketing claims |
| Business / program owner | implementation success criteria, change management, training, ROI/use-case reporting | Cares whether governance can actually run in operations |

## Product wedge implication

The repeated pain is not "AI governance strategy" in the abstract.

The repeated pain is:

> A buyer has an AI vendor or platform proposal, but the evidence packet is not ready for the people who must review it.

Agenda Intelligence MD should package this as:

- `AI Vendor Evidence-Readiness Profile`
- public or buyer-provided source pack
- claim support table
- missing evidence by reviewer role
- owner actions
- readiness decision: `ready_for_human_review`, `not_decision_ready`, `escalate_before_procurement_decision`, or `insufficient_public_evidence`

No new worker is needed. The current template is enough for 2-3 more profiles.

## What this validates

Validated enough to continue:

- Public procurement artifacts repeatedly ask for the same evidence categories.
- Evidence-readiness is visible before private interviews.
- The UTHSA profile is not an isolated artifact; TXShare, Oxfam, UCO, Georgia, UC, OMB, FS-ISAC, and Health Sector Council point to the same review problem.

Not validated:

- Willingness to pay.
- Budget owner.
- Whether procurement teams see this as painful enough to outsource.
- Whether buyers prefer a consultant/service artifact, template, or software tool.
- Whether vendors or buyers are more likely to pay.

## 30-day decision

Proceed with `build-to-learn`, but only as research profiles and concierge tests.

Next artifacts:

1. Public-sector / cooperative procurement profile using TXShare RFP.
2. Nonprofit / humanitarian AI governance framework profile using Oxfam RFP.
3. Healthcare third-party AI risk profile using Health Sector Council + UTHSA.

Success criteria:

- Three profiles show the same evidence categories with role-specific owner actions.
- At least one artifact generates an inbound correction, reuse request, second-profile request, or redacted source pack.
- A reviewer says which role owns the missing-evidence pain.

Kill / park criteria:

- Profiles become generic checklists rather than evidence-readiness packets.
- Public artifacts do not expose enough evidence to produce useful gaps.
- All artifacts require legal/compliance/security conclusions that Agenda Intelligence MD must not provide.
- Observable response is limited to likes or compliments with no artifact request, correction, or reuse.

## Sources

- UTHSA AI Governance and Monitoring Platform RFP: <https://media.governmentnavigator.com/media/bid/1773165946_01_RFP_745-26-P33_AI_Governance_and_Monitoring_Platform.pdf>
- TXShare AI Governance, Compliance, and Enablement Platform RFP: <https://txshare.org/getContentAsset/ce12252a-9a74-482e-90c1-9a458d99cfaf/dfc3d011-8f63-43f6-9ed8-4b444333a1d0/SOL2026-010.pdf?language=en-US>
- Oxfam Canada AI Governance Framework for Responsible Use RFP: <https://www.oxfam.ca/wp-content/uploads/2026/05/RFP_Artificial-Intelligence-Governance-Framework-for-Responsible-Use_Oxfam-Canada_25-May-2026.pdf>
- UCO AI Ecosystem RFP Q&A: <https://www.uco.edu/fin-ops/financial-services/uco-ai-project-rfp-responses-to-questions-final.pdf>
- Georgia Technology Authority, Procurement of AI Tools Guidelines for Responsible Use: <https://gta-psg.georgia.gov/psg/procurement-ai-tools-guidelines-responsible-use-gs-25-002>
- UC AI Council Risk Assessment Guide: <https://ai.universityofcalifornia.edu/_files/documents/uc-ai-council-risk-assessment-guide-1.1-1.pdf>
- OMB M-25-22, Driving Efficient Acquisition of Artificial Intelligence in Government: <https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-22-Driving-Efficient-Acquisition-of-Artificial-Intelligence-in-Government.pdf>
- NIST AI RMF Core: <https://airc.nist.gov/airmf-resources/airmf/5-sec-core/>
- FS-ISAC Generative AI Vendor Evaluation and Qualitative Risk Assessment: <https://www.fsisac.com/hubfs/Knowledge/AI/FSISAC_GenerativeAI-VendorEvaluation%26QualitativeRiskAssessment.pdf>
- Health Sector Council Third-Party AI Risk and Supply Chain Transparency Guide: <https://healthsectorcouncil.org/wp-content/uploads/2026/04/AI-Third-Party-Risk-Guide.pdf>
- ModelOp AI Lifecycle Management and Governance RFP Template: <https://www.modelop.com/rfp-template-ai-lifecycle-management-and-governance>
