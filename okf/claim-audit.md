---
type: okf.concept
title: Claim Audit
status: active
updated: 2026-06-29
canonical_schema: ../schemas/v1/evidence-audit.schema.json
related:
  - evidence-pack.md
  - source-policy.md
  - human-review-packet.md
---

# Claim Audit

A claim audit maps a claim to the evidence supplied for it and records whether the claim is supported, weak, missing, or not assessable.

For the AI vendor evidence-readiness wedge, the claim audit is more important than a general narrative summary. It is the part of the artifact that can become a reviewer checklist or concierge-service output.

## Recommended columns

| Field | Meaning |
|---|---|
| Claim | The vendor, system, or buyer-process statement being assessed |
| Claim type | Capability, governance, monitoring, data, security, model performance, incident handling, or dependency |
| Evidence present | What the source pack currently shows |
| Source IDs | Which source-pack IDs support the evidence-present statement |
| Evidence gap | What must still be supplied before review |
| Readiness | `supported`, `weak`, `missing`, or `not assessable` |

## Boundary

A claim audit does not prove world-truth. It shows whether the available source pack is sufficient for human review.

