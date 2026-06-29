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

A claim audit maps a claim to the evidence supplied for it and records whether the claim is supported, weak, missing, or not assessable. It is the part of an evidence-readiness packet that can become a reviewer checklist or concierge-service output.

## Recommended columns

| Field | Meaning |
|---|---|
| Claim | The project, source-pack, system, or buyer-process statement being assessed |
| Claim type | Capability, governance, monitoring, data, security, schedule, financial, operational, incident handling, or dependency |
| Evidence present | What the source pack currently shows |
| Source IDs | Which source-pack IDs support the evidence-present statement |
| Evidence gap | What must still be supplied before review |
| Readiness | `supported`, `weak`, `missing`, or `not assessable` |

## Boundary

A claim audit does not prove world-truth. It shows whether the available source pack is sufficient for human review.
