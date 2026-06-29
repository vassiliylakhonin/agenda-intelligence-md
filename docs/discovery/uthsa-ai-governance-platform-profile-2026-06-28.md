# UTHSA AI Governance Platform evidence-readiness profile

Status: first public-only profile for the regulated-procurement wedge.
Date: 2026-06-28.
Mode: `build-to-learn`.

This profile uses a public RFP as the buyer artifact and asks what evidence a vendor packet would need before human procurement / AI governance / security review. It is not a vendor approval, legal assessment, compliance assessment, security assessment, or factual-truth verification.

## Header

- Profile date: 2026-06-28
- Reviewer: Agenda Intelligence MD operator
- Buyer hypothesis: regulated procurement / AI governance owner needs evidence-readiness triage before shortlisting an AI governance platform
- Artifact type: RFP + public procurement guidance + standards references
- Vendor or use case: UT Health San Antonio AI Governance and Monitoring Platform Services, RFP 745-26-P33
- Decision moment: shortlist / proof-of-concept alternative / contract execution review
- Evidence mode: public-only

## Market gate

- Economic buyer: university procurement owner, AI governance lead, information-security lead, privacy / compliance owner, or executive sponsor for institutional AI governance
- Painful trigger this month: an institution must evaluate AI governance platform proposals while satisfying healthcare, higher education, accessibility, cloud-security, privacy, and audit-readiness requirements
- Current workaround: RFP scoring sheets, manual vendor questionnaires, security review, accessibility forms, policy review, proof-of-concept demos, and ad hoc governance committee review
- Observed evidence: the UTHSA RFP requests centralized oversight, risk classification, policy enforcement, lifecycle monitoring, and audit readiness across AI use cases; it also requires healthcare and higher-education regulatory support
- Inference: buyers with similar RFP language may need a fast evidence-readiness packet that separates vendor claims from supplied proof before the evaluation committee spends time on demos or legal/security escalation
- Unknown: whether UTHSA or similar buyers would pay separately for this triage, whether the budget sits with procurement or AI governance, and whether vendors would provide enough evidence before finalist selection
- Kill criterion tested by this profile: if reviewers say the RFP scoring process already captures evidence sufficiency cleanly, or if no target reviewer can name a recent vendor-review delay caused by missing evidence, this wedge weakens

## Source pack

| ID | Source | Date | Type | URL / location | Notes |
|---|---|---:|---|---|---|
| S1 | UT Health San Antonio RFP 745-26-P33, AI Governance and Monitoring Platform Services | 2026-03-10 | RFP | <https://media.governmentnavigator.com/media/bid/1773165946_01_RFP_745-26-P33_AI_Governance_and_Monitoring_Platform.pdf> | Primary buyer artifact |
| S2 | Georgia Technology Authority, Procurement of AI Tools Guidelines for Responsible Use | 2025 | procurement guidance | <https://gta-psg.georgia.gov/psg/procurement-ai-tools-guidelines-responsible-use-gs-25-002> | Public-sector vendor-question language |
| S3 | OMB M-25-22, Driving Efficient Acquisition of Artificial Intelligence in Government | 2025-04-03 | procurement policy | <https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-22-Driving-Efficient-Acquisition-of-Artificial-Intelligence-in-Government.pdf> | Federal acquisition signal; public-sector buyer language |
| S4 | EU AI Act Article 11, Technical documentation | 2024 | regulation | <https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-11> | Documentation expectation for high-risk AI systems |
| S5 | ISO/IEC 42001:2023 | 2023-12 | standard | <https://www.iso.org/standard/42001> | AI management-system reference |
| S6 | UC AI Council Risk Assessment Guide | 2024 | buyer questionnaire / risk guide | <https://ai.universityofcalifornia.edu/_files/documents/final-uc-ai-council-risk-assessment-guide-1.0.pdf> | Third-party AI supplier questions suitable for RFP stage |

## Retrieval and citation hints

- Canonical public URL: repository path for this Markdown profile
- Primary query phrase: healthcare AI governance platform RFP evidence readiness
- Secondary query phrases: UTHSA AI governance monitoring platform evidence gaps; AI vendor evidence-readiness healthcare procurement; AI governance platform audit trail retention evidence
- Related profile pack: [`ai-vendor-evidence-readiness-profile-pack-v0.1-2026-06-28.md`](ai-vendor-evidence-readiness-profile-pack-v0.1-2026-06-28.md)
- Source IDs referenced from claim rows: yes
- Crawlable text version available: yes
- PDF-only dependency avoided: yes
- Boundary notes present: yes

## Buyer questions implied by the artifact

| Question | Why it matters | Evidence needed | Owner |
|---|---|---|---|
| Can the platform maintain a centralized AI inventory with intake, approval workflow, model documentation, version tracking, lifecycle status, department, risk tier, and data sensitivity? | The RFP makes centralized discoverable inventory and lifecycle management the operating backbone. | Product screenshots or sandbox walkthrough, data model, API docs, sample inventory export, workflow configuration evidence | AI governance / procurement / IT |
| Can the platform classify risk and flag PHI or student-data use for additional review? | UTHSA explicitly names PHI and student data as triggers for additional review. | Risk-classification methodology, configurable rules, PHI/student-data test case, audit log showing rule firing | AI governance / privacy / security |
| Can the platform map policies and validate controls for bias, data leakage, trust, privacy, and security? | The RFP requires policy mapping and AI-specific control validation. | Control library, policy mapping example, evidence object model, attestation workflow, sample control validation report | AI governance / compliance ops |
| Can the vendor provide evidence for bias detection, fairness monitoring, data drift, performance monitoring, and remediation? | The RFP requires risk assessment and compliance monitoring, not only a policy repository. | Test reports, monitoring design, drift thresholds, fairness metrics, remediation evidence, sample validated-results packet | AI governance / model risk / security |
| Can the platform produce comprehensive audit trails and retain audit logs for seven years? | The RFP requires audit trails across the AI lifecycle and configurable seven-year retention for compliance reports. | Audit-log schema, retention settings, export sample, tamper-resistance controls, role-based access policy | Internal audit / security / procurement |
| Can the platform support IAM, SSO, RBAC, data classification, retention, and third-party AI risk evaluation? | The buyer needs integration with existing institutional security and compliance infrastructure. | Architecture diagram, SSO/RBAC documentation, data-retention policy, integration list, third-party risk workflow demo | Security / IT / vendor risk |
| Can the platform monitor enterprise-approved generative AI tools and detect shadow AI usage without overclaiming surveillance capabilities? | The RFP requires generative-AI oversight, shadow AI discovery, prompt logging, usage analytics, and DLP alignment. | Data-flow diagram, supported connectors, logging policy, DLP integration docs, privacy impact notes, limitations statement | Security / privacy / AI governance |
| Can the vendor meet accessibility and TX-RAMP requirements before contract execution? | UTHSA lists accessibility evidence and TX-RAMP Level II as minimum requirements. | PDAA, VADSIR, VPAT/OpenACR, accessibility testing docs, TX-RAMP Level II certificate or in-process evidence | Procurement / accessibility / security |
| Can the vendor execute within the implementation and training expectations? | The RFP requires implementation, training, documentation, knowledge transfer, and a timeline not exceeding nine months. | Project plan, training materials, knowledge-transfer checklist, implementation references, staffing plan | Procurement / AI governance / IT |

## Vendor or system claims

| Claim | Claim type | Evidence present | Source IDs | Evidence gap | Readiness |
|---|---|---|---|---|---|
| "Centralized AI inventory and lifecycle management" | capability | RFP requires it; no vendor packet assessed yet | S1 | Need data model, workflow proof, lifecycle-state examples, export/API evidence | missing |
| "Risk classification for healthcare and higher education" | governance / risk | RFP names risk tiers and PHI/student-data triggers | S1, S6 | Need risk methodology, configuration proof, PHI/student-data scenario, human override logging | missing |
| "Policy enforcement and control validation" | governance | RFP requires policy mapping, structured signoffs, approval requirements, and automated enforcement | S1, S2, S5 | Need control library, mapping examples, signoff/audit logs, limits of enforcement | missing |
| "Bias, drift, performance, and fairness monitoring" | monitoring | RFP requires monitoring and validated results | S1, S6 | Need monitoring design, metrics, thresholds, sample reports, remediation evidence | missing |
| "Audit-ready reporting" | audit evidence | RFP requires audit-ready reports and seven-year audit retention | S1, S4 | Need report export, log schema, retention controls, access controls | missing |
| "Security and privacy oversight" | security / privacy | RFP requires IAM, SSO, RBAC, data classification, data access, retention, and third-party AI risk support | S1, S2, S3, S6 | Need architecture, data-flow, subprocessor list, RBAC/SSO docs, retention policy, third-party workflow | missing |
| "Shadow AI discovery and generative-AI monitoring" | capability / security | RFP requires monitoring, prompt logging, usage analytics, DLP alignment | S1 | Need connector list, telemetry limits, privacy stance, false-positive handling, DLP integration proof | missing |
| "Healthcare and higher education regulatory support" | regulatory alignment | RFP names HIPAA, FERPA, FDA considerations, state privacy laws, and emerging AI regulations | S1, S6 | Need framework mapping, scope boundaries, proof that claims are evidence-ready and not legal conclusions | weak |
| "Accessibility-ready platform" | accessibility | RFP names PDAA, VADSIR, ACR/VPAT/OpenACR and testing documentation | S1 | Need completed forms and testing evidence | missing |
| "TX-RAMP Level II ready" | security certification | RFP requires TX-RAMP Level II before contract execution | S1 | Need certificate or credible path with dates and owner | missing |

## Control and standard mapping

| Requirement family | Public signal | Evidence expected | Evidence found | Gap |
|---|---|---|---|---|
| Risk management | UTHSA RFP, OMB M-25-22, NIST AI RMF, ISO 42001 | Risk methodology, cross-functional owner model, risk classification logic, PHI/student-data escalation rules | Buyer requirements identified; no vendor evidence assessed | Need vendor-specific method and proof artifacts |
| Documentation | UTHSA RFP, EU AI Act Article 11, Georgia procurement guidance, UC AI Council guide | Model/system documentation, training data source record, intended users, limitations, methodology, technical documentation repository | Buyer questions identified | Need vendor packet showing document structure and completeness |
| Record keeping | UTHSA RFP, EU AI Act Article 12 reference family, RFP audit trail and retention language | Audit trail, lifecycle logs, retention policy, exportable compliance reports | RFP requires audit trails and seven-year retention | Need log schema, retention control, export sample |
| Human oversight | UTHSA RFP, EU AI Act Article 14 reference family, Georgia guidance | Human-in-the-loop review for high-risk decisions, approval workflow, override logging, accountability mechanism | RFP suggests human-in-the-loop for high-risk AI decisions | Need workflow demo and owner/action logs |
| Vendor oversight | UTHSA RFP, UC AI Council third-party questions, Georgia procurement guidance | Third-party AI risk evaluation workflow, supplier governance evidence, references, implementation track record | RFP requires third-party AI risk evaluation support and references | Need references, prior deployments, risk-workflow proof |
| Security and misuse | UTHSA RFP, OMB M-25-22, Georgia guidance | SSO/RBAC, DLP alignment, prompt logging, restricted-data alerts, data handling terms, privacy/security evidence | RFP names these controls | Need architecture, integrations, privacy limits, security docs |

## Evidence-readiness decision

`not_decision_ready`

Rationale:

- The buyer artifact is strong enough to generate a vendor evidence checklist, but a vendor packet cannot be considered review-ready until it supplies proof for inventory/lifecycle workflow, risk classification, audit trails, monitoring evidence, security/privacy integration, accessibility, TX-RAMP, and implementation support.
- A marketing page claiming "AI governance" or "audit-ready compliance" would be insufficient for this RFP. The minimum useful packet needs artifacts: screenshots, exports, architecture diagrams, policy/control mappings, audit-log samples, certification evidence, and a proof-of-concept plan.

## Missing evidence

| Priority | Missing evidence | Why it blocks review | Suggested owner action |
|---|---|---|---|
| P0 | Platform data model and inventory/lifecycle workflow proof | The RFP centers on inventory, intake, approval, model docs, version tracking, and lifecycle status. | Ask vendor for a configured sample inventory, lifecycle-state examples, and export/API evidence. |
| P0 | Risk classification methodology with PHI/student-data triggers | The buyer needs additional review for PHI and student-data use cases. | Ask vendor to run a PHI/student-data test case and show scoring logic plus override logs. |
| P0 | Audit trail and seven-year retention evidence | Audit-ready reports and retention are hard procurement requirements. | Ask for audit-log schema, retention configuration, export sample, and access-control model. |
| P0 | Security/privacy architecture | The RFP requires IAM/SSO/RBAC, data classification, access control, retention, and DLP alignment. | Ask for architecture diagram, data-flow, subprocessor list, retention policy, RBAC/SSO docs, and DLP integration details. |
| P0 | TX-RAMP Level II evidence | The RFP requires certification before contract execution. | Ask for certificate, status, or dated certification plan with accountable owner. |
| P1 | Bias, drift, fairness, and model performance monitoring proof | The RFP requires monitoring and validated results, not only governance policy. | Ask for sample monitoring reports, thresholds, remediation workflow, and validated-results evidence. |
| P1 | Accessibility evidence | Accessibility documentation is a minimum requirement. | Ask for PDAA, VADSIR, VPAT/OpenACR, and accessibility testing documentation. |
| P1 | Implementation and training packet | The RFP requires implementation, knowledge transfer, and training within a bounded timeline. | Ask for project plan, training materials, admin/end-user onboarding, and prior similar deployment references. |
| P2 | Regulatory mapping boundaries | The RFP names healthcare, education, privacy, and emerging AI regulations. | Ask vendor to distinguish product control mappings from legal/compliance advice. |

## Human-review packet

Summary for reviewer:

- This RFP is a good first wedge artifact because it bundles the exact operational pains Agenda Intelligence MD can route: inventory completeness, AI risk classification, control validation, monitoring evidence, audit trail readiness, security/privacy integration, and proof-of-concept evidence.
- The strongest buyer pain is not "What is the best AI governance platform?" but "Which proposal has enough evidence to send to the evaluation committee, security, privacy, accessibility, and procurement without rework?"

What is ready:

- Buyer requirements are concrete enough to build an evidence-readiness checklist.
- The RFP contains multiple measurable evidence categories: inventory, risk tiering, audit trails, seven-year retention, IAM/SSO/RBAC, DLP alignment, accessibility, TX-RAMP, proof-of-concept criteria.
- Public-sector procurement guidance corroborates the need to evaluate vendor transparency, risk management plans, monitoring, feedback loops, ethical AI governance, and production-facing references.

What is weak:

- No vendor response is available in this public-only profile.
- No buyer interview confirms whether evaluation teams experience this as painful rework or as normal procurement process.
- No budget owner has confirmed willingness to pay for external evidence-readiness triage.

What must be asked before approval / shortlist / escalation:

- "Show the configured artifact, not the claim": inventory export, risk scoring setup, audit logs, monitoring reports, retention settings, SSO/RBAC proof, DLP integration, accessibility docs, TX-RAMP evidence, implementation plan.
- "Which reviewer owns this gap?": procurement, AI governance, privacy, security, accessibility, internal audit, or business owner.
- "What would make this proposal non-responsive?": missing TX-RAMP path, missing accessibility forms, no audit-retention proof, no PHI/student-data risk logic, or no evidence for continuous monitoring.

## Boundary notes

- This profile does not approve or reject any vendor.
- This profile does not provide legal, compliance, procurement, security, financial, insurance, or sanctions advice.
- This profile checks evidence readiness and claim support using supplied or public sources.
- Factual truth, regulatory interpretation, model validation, security testing, and legal conclusions remain outside this artifact.

## Follow-up signal

After showing the profile, record observed buyer behavior:

- Redacted file offered: no signal yet
- Second artifact requested: no signal yet
- Paid concierge interest: no signal yet
- Budget-owner intro: no signal yet
- Concrete workflow correction: no signal yet
- Only compliment / generic interest: no signal yet

Next outreach target:

- 5 AI governance / procurement / vendor-risk people in healthcare or higher education.
- Ask: "When you last reviewed an AI vendor, which evidence item caused the most back-and-forth before security, privacy, or committee review?"
