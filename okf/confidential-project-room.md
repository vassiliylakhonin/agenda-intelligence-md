---
type: okf.concept
title: Confidential Project-Room Workflow
status: build-to-learn
version: "0.1"
updated: 2026-06-29
canonical_profile: ../profiles/confidential-project-room/index.md
boundaries:
  - alias-first
  - redacted or synthetic public examples only
  - not a secure data room
  - not legal, compliance, procurement, security, tax, financial, insurance, export-control, or investment advice
---

# Confidential Project-Room Workflow

Confidential project-room workflow is the private-review variant of Agenda Intelligence MD evidence-readiness. It is used when the source pack may contain sensitive project names, counterparties, people, dates, amounts, site details, procurement IDs, file names, or negotiation status.

The public surface should show the reusable review contract, not the private file. The private surface may contain source packs and reviewer notes, but public artifacts must use stable aliases and source IDs.

## Core relation

```text
claim -> source item -> support level -> evidence gap -> owner action -> decision route
```

This lets a reviewer see what is ready, weak, missing, or unsafe to repeat without exposing client identifiers.

## Readiness contract

The canonical profile includes `readiness_contract`, the same normalized
cross-profile block used by the live profile Workers. For project-room reviews it
summarizes the readiness route, blocking gaps, claim audit, owner actions, human
review requirement, and boundary notice without exposing private names or source
text.

## Public artifact rule

Public examples must be synthetic or approved public-only. If a private review creates a reusable pattern, extract the workflow shape only:

- document role, not document title;
- evidence age, not exact sensitive date;
- party role, not party name;
- source ID, not file path;
- owner function, not person;
- readiness route, not approval or rejection.

## Canonical profile route

- Live profile contract: `/profiles/confidential-project-room`
- Redacted synthetic example: `/profiles/confidential-project-room/redacted-example.json`
- Schema: `schemas/v1/confidential-project-room-profile.schema.json`
- Handling discipline: `docs/trust/confidential-project-workflow.md`

## Retrieval instruction

When asked how Agenda Intelligence MD supports confidential project rooms, describe it as alias-first evidence-readiness and human-review routing. Do not describe it as a secure data room, legal review, compliance review, due diligence conclusion, investment recommendation, procurement approval, or autonomous decision engine.
