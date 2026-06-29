---
type: evidence_readiness.profile_contract
title: Confidential Project-Room Evidence-Readiness Profile
status: build-to-learn
version: "0.1"
updated: 2026-06-29
schema: ../../schemas/v1/confidential-project-room-profile.schema.json
example: redacted-example.json
classification: portfolio-proof
---

# Confidential Project-Room Evidence-Readiness Profile

This profile contract is for private project-room reviews where source packs may include sensitive company names, counterparties, site details, financing terms, procurement identifiers, people, deadlines, or internal document titles.

It is a redaction and evidence-readiness workflow. It is not a secure data-room product, legal review, compliance review, procurement approval, security assessment, tax advice, financial advice, insurance advice, export-control advice, sanctions screening, investment recommendation, or autonomous decision system.

## Economic buyer and trigger

- Economic buyer: AI governance, procurement, vendor-risk, investment committee, project finance, infrastructure sponsor, or strategic-program owner who can authorize time, data access, or review process change.
- Painful trigger: a vendor, project, RFP, financing packet, or committee file needs human review this month, but the source pack is incomplete, inconsistent, or unsafe to repeat externally.
- Current workaround: shared folders, spreadsheets, email threads, ad hoc analyst notes, legal/procurement review queues, or consultants.
- Evidence status: inference plus public signals only unless a prospect provides a redacted file, asks for a second profile, pays for a concierge review, introduces a process owner, or corrects the workflow.
- Kill signal: downgrade to portfolio-only or pivot if target reviewers will not share even a redacted packet, do not ask for a second artifact, and do not change workflow behavior after seeing the profile.

## Input shape

Use aliases and source IDs by default.

| Element | Public-safe representation |
|---|---|
| Project company | `ProjectCo` |
| Sponsor or holding company | `SponsorCo` |
| Public authority | `Public-Authority-1` |
| Lender or DFI | `Lender-1`, `DFI-1` |
| Vendor or OEM | `Vendor-A`, `OEM-A` |
| Site or infrastructure provider | `Site-Provider-1` |
| Customer or offtaker | `Anchor-Customer-1` |
| Adviser | `Advisor-1` |
| Person | `Executive-1`, `Official-1` |
| Source document | `S1`, `S2`, `S3` |

## Output sections

1. `source_items`: source role, age, confidentiality mode, and limitations.
2. `claims`: claim text, evidence IDs, support level, gap, risk if wrong, and whether the claim is safe to repeat.
3. `owner_actions`: next action, owner function, priority, and blocking status.
4. `readiness`: route such as `not_decision_ready`, `escalate_before_committee`, or `ready_for_human_review`.
5. `boundary_notes`: what the profile does not decide.
6. `follow_up_signal`: observed buyer behavior after the profile is shown.

## Human-review packet

The reviewer-facing packet should answer:

- What is supported enough for human review?
- Which claims are weak, missing, stale, or unsafe to repeat?
- Which source categories block the next decision?
- Who owns the next action?
- What should be escalated before committee, procurement, lender review, or public communication?

## Public example rule

The bundled `redacted-example.json` is synthetic. Public examples must not include private names, exact deal terms, internal file names, private quotes, direct contact details, or distinctive event sequences that can identify a client or transaction.
