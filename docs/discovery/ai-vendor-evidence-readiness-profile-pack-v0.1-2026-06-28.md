# AI Vendor Evidence-Readiness Profile Pack v0.1

Status: public discovery artifact for reviewer feedback.
Date: 2026-06-28.
Mode: `build-to-learn`.

This pack is a public workflow sample for testing the current Agenda Intelligence MD wedge: **AI vendor evidence-readiness for regulated procurement**.

It is not a product launch, sales page, landing page, worker spec, dashboard, legal/compliance/security assessment, procurement recommendation, or claim of product-market fit. It is a reusable artifact format for testing whether procurement, AI governance, vendor-risk, records, privacy, security, and program owners recognize the evidence-review workflow.

## What this pack tests

Hypothesis:

> A regulated buyer reviewing an AI vendor does not only need a score or a summary. They need a review-ready evidence packet: what the vendor claims, what proof is present, what proof is missing, which reviewer owns each gap, and whether the file is ready for human review.

This pack tests whether that workflow is visible from public procurement artifacts before asking prospects for private data.

## Included artifacts

| Artifact | Buyer/workflow | What it tests | Readiness decision |
|---|---|---|---|
| [UTHSA AI Governance Platform evidence-readiness profile](uthsa-ai-governance-platform-profile-2026-06-28.md) | Healthcare / higher-ed AI governance platform procurement | Whether a healthcare/higher-ed RFP can be turned into missing-evidence rows for AI governance, security, privacy, accessibility, audit, and implementation reviewers | `not_decision_ready` |
| [TXShare AI Governance Platform evidence-readiness profile](txshare-ai-governance-evidence-readiness-profile-2026-06-28.md) | Cooperative public-sector AI governance procurement | Whether a cooperative purchasing RFP can be turned into role-specific evidence gaps for policy workflow, risk scoring, public-records retention, PII controls, integrations, references, pricing, and roadmap disclosure | `not_decision_ready` |
| [AI governance RFP corpus scan](ai-governance-rfp-corpus-scan-2026-06-28.md) | Cross-artifact public signal scan | Whether UTHSA and TXShare are isolated examples or part of a repeating procurement pattern | `explore` |
| [Reusable profile template](../templates/ai-vendor-evidence-readiness-profile.md) | Repeatable concierge/research format | Whether the same evidence-readiness structure can be reused without a new worker | Template only |

## How to read it

The profiles follow the same pattern:

1. Name the buyer decision moment.
2. Separate observed public evidence from inference.
3. Translate RFP language into buyer questions.
4. Translate buyer questions into expected vendor evidence.
5. Mark missing or weak proof.
6. Assign likely reviewer owner.
7. Produce a readiness routing decision.
8. Preserve the boundary: no vendor approval, no legal/compliance/security/procurement advice, no factual-truth verification.

The core output is not a market map. The core output is the missing-evidence table plus owner actions.

## Target reviewer

Use this pack with people who have personally seen an AI vendor review, RFP scoring, vendor-risk process, security/privacy intake, AI governance committee review, public-records review, or SOW negotiation.

Primary reviewer profiles:

- Public-sector procurement lead
- AI governance program owner
- Vendor-risk / third-party-risk owner
- Security or privacy reviewer
- Records / internal audit reviewer
- CIO / digital transformation owner
- Healthcare or higher-ed AI governance reviewer

Do not optimize this pack for generic startup feedback, broad "AI governance" interest, or people who cannot describe a recent vendor-review workflow.

## The only question to ask

Do not ask:

- "Would you use this?"
- "Is this interesting?"
- "Should this be a SaaS?"
- "Do you like the idea?"

Ask:

> Which missing-evidence row is wrong, incomplete, or owned by the wrong reviewer compared with how your team reviews AI vendors?

Useful follow-ups:

- "When did this last happen?"
- "Which evidence item caused the most back-and-forth?"
- "Who blocked or escalated the review?"
- "What did you use instead: spreadsheet, questionnaire, GRC tool, counsel, consultant, security review, committee memo?"
- "Would a second packet on a real or redacted file save review time?"

## What counts as traction

Strong signal:

- Reviewer sends a redacted RFP, vendor packet, security questionnaire, model card, trust page, or SOW.
- Reviewer asks for a second evidence-readiness profile.
- Reviewer corrects the workflow with specific owner/action language.
- Reviewer introduces a budget owner or process owner.
- Reviewer asks what a paid 72-hour concierge review would cost.

Weak signal:

- "Interesting."
- "Useful framework."
- Likes, reposts, compliments, or general AI governance conversation.
- Suggestions to build a dashboard, worker, or platform without a concrete file or buyer workflow.

Negative signal:

- Reviewers say existing RFP scoring, GRC, procurement, security, or vendor-risk tooling already makes evidence gaps obvious enough.
- Reviewers cannot name a recent AI vendor review delayed by missing evidence.
- The workflow collapses into legal/compliance/security conclusions that Agenda Intelligence MD must not provide.
- The only apparent buyer is the vendor marketing team, not the buyer/reviewer side.

## Concierge test

Offer only this service-shaped test:

> 72-hour AI Vendor Evidence-Readiness Profile from a public or redacted source pack.

Input:

- RFP / procurement document
- Vendor response or public vendor claims
- Security / privacy / trust docs where available
- Model card / AI policy / public documentation where available

Output:

- Buyer questions implied by the source pack
- Vendor/system claims table
- Evidence present / weak / missing
- Missing evidence by priority
- Suggested reviewer owner action
- Readiness routing decision
- Boundary notes

Do not offer:

- Vendor approval
- Compliance opinion
- Legal interpretation
- Security certification
- Procurement scoring
- Autonomous accept/reject recommendation
- Continuous monitoring product

## What to build next

Build only if the pack produces behavior.

Allowed next build-to-learn steps:

- One more profile from a distinct buyer workflow: nonprofit/humanitarian AI governance or healthcare third-party AI risk.
- A redacted-file concierge profile if a reviewer supplies a file.
- A tighter profile template if reviewers correct the table structure.
- A small source-pack checklist if the same missing inputs repeat across three profiles.

Not allowed yet:

- New worker
- AI governance platform
- Dashboard
- Landing page
- Pricing page
- Outreach automation
- Kazakhstan / Middle Corridor revival
- Agentic Trust pivot

## Decision rule

After this pack is shown to 10 relevant reviewers:

- Continue if at least two reviewers request a second profile, provide a redacted/public file, introduce a budget/process owner, or correct the workflow in a way that improves the artifact.
- Park if the only response is compliments or abstract interest.
- Pivot if reviewers consistently say the evidence gap is already solved by their current RFP/GRC/vendor-risk workflow.

## Current verdict

`continue_build_to_learn`

The public artifacts are strong enough to keep testing the wedge through profiles and concierge review. They are not evidence of product-market fit, willingness to pay, or validated budget ownership.
