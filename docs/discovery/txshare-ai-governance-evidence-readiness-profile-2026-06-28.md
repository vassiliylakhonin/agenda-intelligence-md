# TXShare AI Governance Platform evidence-readiness profile

Status: second public-only profile for the regulated-procurement wedge.
Date: 2026-06-28.
Mode: `build-to-learn`.

This profile uses a public cooperative-procurement RFP as the buyer artifact and asks what evidence a vendor packet would need before human procurement, AI governance, security, records, privacy, and implementation review. It is not a vendor approval, legal assessment, compliance assessment, procurement recommendation, security assessment, or factual-truth verification.

## Header

- Profile date: 2026-06-28
- Reviewer: Agenda Intelligence MD operator
- Buyer hypothesis: public-sector procurement / AI governance owner needs evidence-readiness triage before awarding or using a cooperative AI governance platform contract
- Artifact type: RFP + public procurement guidance + AI risk-management references
- Vendor or use case: TXShare AI Governance, Compliance, and Enablement Platform, RFP 2026-010
- Decision moment: responsive / non-responsive screen, shortlist, demonstration, award, customer SOW negotiation
- Evidence mode: public-only

## Market gate

- Economic buyer: cooperative procurement owner, municipal/county/school-district procurement lead, public-sector CIO, AI governance lead, records officer, security lead, or vendor-risk owner using the TXShare contract vehicle
- Painful trigger this month: a public entity wants to adopt AI tools faster but must show that vendor proposals can support AI policy management, risk mitigation, public-records retention, data protection, audit trails, and secure integration before contract use or customer SOW negotiation
- Current workaround: RFP review committee scoring, manual written responses, vendor references, demos, security questionnaires, catalog/pricing review, and customer-specific SOW negotiation after award
- Observed evidence: TXShare RFP 2026-010 weights the technical proposal at 50%, requires written responses to Section 5 requirements, asks vendors to disclose capability gaps and a roadmap, and names evidence categories such as public-records logging, PII controls, U.S. data residency, IAM/SIEM integration, security architecture, certifications, references, and implementation support
- Inference: public-sector buyers using cooperative contracts may need a compact evidence-readiness packet that separates vendor claims from proof before evaluation committees, security/records/privacy reviewers, or member agencies spend time on demos and SOW negotiation
- Unknown: whether TXShare, member agencies, or vendors would pay for this triage; whether the buyer pain sits before award, before member-agency purchase, or during SOW negotiation; whether vendor responses are public enough after award to support repeatable profiles
- Kill criterion tested by this profile: if reviewers say the RFP's written-response and scoring process already makes evidence gaps obvious enough, or if no public-sector reviewer recognizes public-records / logging / AI governance evidence gaps as a source of delay, this wedge weakens

## Source pack

| ID | Source | Date | Type | URL / location | Notes |
|---|---|---:|---|---|---|
| S1 | TXShare AI Governance, Compliance, and Enablement Platform RFP 2026-010 | 2025-12 | RFP | <https://txshare.org/getContentAsset/ce12252a-9a74-482e-90c1-9a458d99cfaf/dfc3d011-8f63-43f6-9ed8-4b444333a1d0/SOL2026-010.pdf?language=en-US> | Primary buyer artifact |
| S2 | NIST AI RMF Core | 2023 | risk-management framework | <https://airc.nist.gov/airmf-resources/airmf/5-sec-core/> | Public AI risk-management reference for govern / map / measure / manage evidence families |
| S3 | OMB M-25-22, Driving Efficient Acquisition of Artificial Intelligence in Government | 2025-04-03 | federal acquisition guidance | <https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-22-Driving-Efficient-Acquisition-of-Artificial-Intelligence-in-Government.pdf> | Public-sector AI acquisition signal |
| S4 | Georgia Technology Authority, Procurement of AI Tools Guidelines for Responsible Use | 2025 | public-sector procurement guidance | <https://gta-psg.georgia.gov/psg/procurement-ai-tools-guidelines-responsible-use-gs-25-002> | Public-sector AI vendor evaluation language |
| S5 | AI governance RFP corpus scan | 2026-06-28 | internal public-signal scan | [`docs/discovery/ai-governance-rfp-corpus-scan-2026-06-28.md`](ai-governance-rfp-corpus-scan-2026-06-28.md) | Shows TXShare is part of a recurring procurement pattern, not an isolated artifact |

## Retrieval and citation hints

- Canonical public URL: repository path for this Markdown profile
- Primary query phrase: public-sector AI governance RFP evidence gaps
- Secondary query phrases: TXShare AI governance platform evidence readiness; AI procurement public records retention vendor evidence; cooperative procurement AI governance vendor claims
- Related profile pack: [`ai-vendor-evidence-readiness-profile-pack-v0.1-2026-06-28.md`](ai-vendor-evidence-readiness-profile-pack-v0.1-2026-06-28.md)
- Source IDs referenced from claim rows: yes
- Crawlable text version available: yes
- PDF-only dependency avoided: yes
- Boundary notes present: yes

## Buyer questions implied by the artifact

| Question | Why it matters | Evidence needed | Owner |
|---|---|---|---|
| Can the platform create and enforce centralized AI policy across public-sector departments? | The RFP asks for centralized AI policy creation and enforcement aligned with regulations. | Configured policy workflow, approval-state examples, policy-to-control mapping, role permissions, exception handling | AI governance / procurement / legal-review owner |
| Can the platform identify and mitigate AI-related risks in real time without overclaiming automated determinations? | The RFP asks for real-time risk identification, mitigation, scoring, alerts, and dashboards. | Risk taxonomy, scoring methodology, alert examples, false-positive handling, escalation workflow, human-review boundary | AI governance / risk / security |
| Can the platform capture and retain AI-related activities for public-records compliance? | Public agencies need official records and retention logic for AI-generated content and AI interactions used in agency business. | Logging schema, retention configuration, records export, deletion/hold workflow, public-information request response process | Records / internal audit / procurement |
| Can the platform prevent unauthorized sensitive-data exposure during AI interactions? | The RFP names PII upload blocking, confidential-data scanning, and keeping processing in approved environments. | Data-flow diagram, PII/confidential-data detection method, DLP integration, approved-environment controls, test cases | Security / privacy / data governance |
| Can the platform monitor approved, experimental, and shadow AI tools? | The RFP asks for safeguards across approved, experimental, and shadow AI use, which is broader than inventory alone. | Connector list, network/browser/app telemetry model, discovery limitations, department filters, approved-tool registry, privacy constraints | Security / AI governance / IT |
| Can the solution integrate into a public agency environment with minimal disruption? | The RFP names deployment flexibility, Azure Entra ID, SIEM, cloud storage, secure APIs, scalability, and U.S. processing/storage. | Architecture diagram, integration docs, IAM/SIEM examples, Azure Blob or storage evidence, API docs, data-residency controls | CIO / security / IT |
| Can the vendor support member-agency implementation after cooperative award? | TXShare contracts are non-exclusive and member agencies negotiate specific orders or SOWs after award. | Phased rollout plan, pilot approach, agency-specific configuration plan, SLA-backed support, training materials, annual review template | Procurement / business owner / IT |
| Can the vendor prove public-sector experience rather than general AI governance claims? | The RFP requires recent references, public-agency preference, comparable projects, and government/regulated-environment experience. | Four references, comparable project summaries, certifications, implementation outcomes, contract scope history | Procurement / vendor risk |
| Can pricing be audited and used by public customers under the cooperative contract? | The RFP requires catalog or unit pricing, clear category mapping, public pricing treatment, and customer-auditable pricing structure. | Completed pricing exhibit, current catalog or list-pricing link, discount/unit structure, category mapping, auditability explanation | Procurement / finance |
| Can the vendor disclose capability gaps and future roadmap honestly? | The RFP explicitly asks vendors to identify gaps and provide a roadmap for full compliance and future enhancements. | Gap matrix, roadmap with dates/owners, current vs planned capability labels, dependencies, no-claim boundary | Procurement / AI governance / vendor risk |

## Vendor or system claims

| Claim | Claim type | Evidence present | Source IDs | Evidence gap | Readiness |
|---|---|---|---|---|---|
| "AI policy management across agencies" | governance / workflow | RFP requires policy creation, enforcement, approval workflows, and alignment with applicable frameworks | S1, S2, S3, S4 | Need policy workflow proof, control mapping, approval logs, exception process, role model | missing |
| "Real-time AI risk scoring and mitigation" | risk / monitoring | RFP asks for risk scoring, alerts, dashboards, and mitigation | S1, S2 | Need risk taxonomy, scoring logic, alert examples, human-review escalation, limits of automation | missing |
| "Public-records compliant AI activity capture" | records / audit | RFP requires capture and retention of AI-related activities and official records management | S1 | Need log schema, retention schedule mapping, export format, audit trail, records request workflow | missing |
| "PII and confidential-data protection" | security / privacy | RFP asks for PII upload blocking, confidential-data scanning, and approved data environments | S1, S3, S4 | Need DLP/data-classification evidence, false-positive handling, test cases, data-flow and residency proof | missing |
| "Shadow AI and experimental-tool monitoring" | capability / security | RFP asks for safeguards across approved, experimental, and shadow AI tools | S1 | Need supported telemetry/connectors, discovery limits, privacy posture, department/risk filters | missing |
| "Secure public-sector deployment" | technical architecture | RFP names cloud/on-prem flexibility, encryption, kill-switch, digital signatures, IAM/SIEM/cloud-storage integration, secure APIs | S1 | Need architecture, integration screenshots/docs, secure API docs, deployment options, performance/scalability evidence | missing |
| "Implementation with minimal disruption" | implementation | RFP asks for planning, pilot deployment, agency configurations, rollout, validation, training, support, and annual performance reviews | S1 | Need project plan, staffing model, SLA, training materials, governance configuration documentation, annual review template | missing |
| "Government or regulated-environment experience" | vendor qualification | RFP asks for public-agency references and government/regulated AI governance experience | S1 | Need references, comparable projects, certification evidence, customer outcomes | missing |
| "Catalog/pricing ready for cooperative purchasing" | procurement / pricing | RFP requires category pricing, catalog/list pricing, auditability, and completed exhibits | S1 | Need pricing exhibit, current catalog, category mapping, discount/unit structure, public pricing acknowledgement | missing |
| "Roadmap-backed gap disclosure" | governance / trust | RFP asks vendors to disclose gaps and roadmap future capabilities | S1 | Need explicit current/planned matrix, dates, dependencies, owner, and no-overclaim statement | missing |

## Control and standard mapping

| Requirement family | Public signal | Evidence expected | Evidence found | Gap |
|---|---|---|---|---|
| AI governance operating model | TXShare RFP, NIST AI RMF Govern, OMB AI acquisition guidance | Policy workflow, roles, approval states, accountability, training, periodic review | Buyer requirement identified | Need vendor-specific workflow and owner evidence |
| AI inventory and use visibility | TXShare RFP, NIST AI RMF Govern 1.6, Georgia AI procurement guidance | Tool inventory, approved/experimental/shadow status, department owner, risk level, usage analytics | RFP requires visibility into AI usage and emerging use cases | Need actual inventory model, export, filters, and discovery limitations |
| Risk classification and monitoring | TXShare RFP, NIST AI RMF Map / Measure / Manage | Risk taxonomy, scoring logic, alert thresholds, remediation workflow, monitoring reports | RFP requires real-time risk scoring, alerts, and dashboards | Need methodology and sample outputs |
| Public records and audit trail | TXShare RFP, public-sector records obligations | Interaction logs, AI-generated content record handling, retention configuration, audit trail, export format | RFP requires logging, retention, and public-records compliance | Need record schema, retention mapping, export and hold process |
| Security, privacy, and data residency | TXShare RFP, OMB AI acquisition guidance, Georgia guidance | PII detection, confidential-data scanning, DLP, approved U.S. processing/storage, encryption, access control | RFP requires PII blocking, data residency, IAM/SIEM, encryption, kill-switch, digital signatures | Need architecture, control evidence, test cases |
| Integration and deployment | TXShare RFP | Cloud/on-prem options, Azure Entra ID, SIEM, Azure Blob, secure APIs, performance/scalability evidence | RFP names preferred integrations and scalability needs | Need integration docs and deployment proof |
| Vendor qualification | TXShare RFP | Four recent references, comparable projects, government/regulated implementation evidence, certifications | RFP requires references and qualifications | Need verifiable project packet |
| Pricing and cooperative contract auditability | TXShare RFP | Catalog/list pricing, category mapping, discount or unit pricing, public pricing treatment, auditability | RFP requires pricing clarity and auditability | Need completed pricing packet |
| Gap disclosure and roadmap | TXShare RFP | Current/planned matrix, roadmap dates, capability limitations, future enhancement plan | RFP asks for gaps and roadmap | Need explicit gap matrix, not marketing narrative |

## Evidence-readiness decision

`not_decision_ready`

Rationale:

- The buyer artifact is strong enough to generate a concrete evidence packet, but a vendor response is not review-ready unless it supplies proof for policy workflow, risk scoring, public-records logging/retention, PII/confidential-data controls, U.S. data residency, IAM/SIEM/cloud integration, public-sector references, pricing auditability, and gap disclosure.
- The technical proposal is worth 50% of evaluation, and failure to respond to required technical items is treated as inability to provide the product/service/functionality. That makes evidence completeness commercially material before demo, BAFO, award, or member-agency SOW negotiation.
- A generic "AI governance platform" page would not be sufficient. The packet needs inspectable artifacts: screenshots, exports, schemas, architecture diagrams, logging examples, retention configuration, integration docs, references, pricing exhibits, and a current-vs-roadmap matrix.

## Missing evidence

| Priority | Missing evidence | Why it blocks review | Suggested owner action |
|---|---|---|---|
| P0 | Written response mapped to every Section 5 requirement | The RFP says failure to respond to all required items will be interpreted as inability to provide the requested product/service/functionality. | Require a requirement-by-requirement matrix with evidence links, not prose-only responses. |
| P0 | Public-records logging and retention proof | The RFP explicitly requires AI activity capture, retention, and compliance-ready audit trails. | Ask for log schema, retention schedule mapping, export sample, legal-hold/deletion behavior, and public-information request workflow. |
| P0 | PII/confidential-data control evidence | The RFP names PII upload blocking, confidential-data scanning, approved environments, and U.S. processing/storage. | Ask for DLP/data-classification test cases, data-flow diagram, residency controls, and exception handling. |
| P0 | Security architecture and integration proof | The RFP names encryption, kill-switch, digital signatures, Azure Entra ID, SIEM, Azure Blob, and secure APIs. | Ask for architecture diagram, integration docs, sample SIEM events, API docs, RBAC/SSO proof, and deployment options. |
| P0 | Risk-scoring and alert methodology | Real-time risk scoring and mitigation can become a black-box claim without inspectable logic. | Ask for risk taxonomy, scoring inputs, thresholds, alert examples, human-escalation workflow, and limits of automation. |
| P1 | Government or regulated-environment references | The RFP gives references pass/fail weight and evaluates public-sector/regulated experience. | Ask for four recent references, comparable project summaries, contract scope, outcomes, and implementation timeline. |
| P1 | Implementation and support packet | Member agencies will need phased rollout, training, support, and annual reviews after cooperative award. | Ask for pilot plan, customer-specific configuration approach, SLA, training materials, governance configuration documentation, and annual review template. |
| P1 | Catalog/pricing auditability packet | Cooperative customers need auditable pricing under public purchasing rules. | Ask for completed Exhibit 1, current catalog/list-pricing link, category mapping, unit/discount structure, and public pricing acknowledgement. |
| P1 | Gap and roadmap matrix | The RFP asks vendors to identify gaps and roadmap future capabilities; hiding gaps weakens trust. | Ask for current/planned capability matrix with dates, dependencies, and accountable owner. |
| P2 | Optional value-add evidence for agentic marketplace, workflows, and role-specific training | Optional enhancements may help differentiation but should not distract from core responsiveness. | Ask for separate evidence packets for optional enhancements so they do not mask missing core requirements. |

## Human-review packet

Summary for reviewer:

- TXShare RFP 2026-010 is a strong public-sector wedge artifact because it converts "AI governance" from a broad category into reviewable evidence requirements: policy workflow, real-time risk, records retention, sensitive-data controls, secure deployment, implementation support, references, pricing auditability, and roadmap disclosure.
- The likely review pain is not choosing the "best" AI governance vendor. It is deciding whether a vendor packet is complete enough for evaluation committee scoring, demonstration, BAFO/clarification, award, or member-agency SOW negotiation.

What is ready:

- The RFP provides a concrete requirement structure and evaluation weighting.
- The technical-proposal section produces a useful evidence-readiness checklist without needing private buyer data.
- The cooperative purchasing context makes repeatability plausible: one awarded contract may be marketed to many public entities, but each customer still negotiates its own orders and SOWs.

What is weak:

- No vendor response is public in this profile.
- No buyer has confirmed whether this evidence-readiness packet would save evaluation time.
- Some requirements could drift into legal, records, privacy, or security conclusions if the profile is not kept at evidence-readiness level.
- The RFP is broad and allows multiple awards, so evidence gaps may matter differently for platform vendors vs. "other AI governance-related tools and services."

What must be asked before approval / shortlist / escalation:

- "Show the artifact": requirement matrix, policy workflow, risk scoring logic, log export, retention configuration, data-flow diagram, DLP tests, IAM/SIEM integration, deployment architecture, references, pricing exhibit, and roadmap.
- "Name the reviewer": procurement, AI governance, records, security, privacy, IT, finance, or member-agency business owner.
- "Separate current from planned": current capability, configurable capability, professional-service dependency, roadmap item, or not supported.
- "Keep boundaries clear": evidence-readiness profile, not vendor approval, legal/compliance advice, security certification, or procurement recommendation.

## Boundary notes

- This profile does not approve or reject any vendor.
- This profile does not provide legal, compliance, procurement, security, financial, insurance, or sanctions advice.
- This profile checks evidence readiness and claim support using supplied or public sources.
- Factual truth, regulatory interpretation, model validation, security testing, procurement scoring, and legal conclusions remain outside this artifact.

## Follow-up signal

After showing the profile, record observed buyer behavior:

- Redacted file offered: no signal yet
- Second artifact requested: no signal yet
- Paid concierge interest: no signal yet
- Budget-owner intro: no signal yet
- Concrete workflow correction: no signal yet
- Only compliment / generic interest: no signal yet

Next public-signal test:

- Create one more profile from a different buyer type only if it sharpens a distinct review workflow: nonprofit/humanitarian AI governance using Oxfam, or healthcare third-party AI risk using Health Sector Council.
- Do not create a new worker unless a real buyer supplies a file, requests a second artifact, pays for concierge review, introduces a budget owner, or corrects a workflow assumption in a commercially specific way.
