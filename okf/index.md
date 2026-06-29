---
type: okf.catalog
title: Agenda Intelligence MD Knowledge Bundle
status: build-to-learn
version: "0.1"
updated: 2026-06-29
canonical_repo: https://github.com/vassiliylakhonin/agenda-intelligence-md
audience:
  - retrieval agents
  - technical evaluators
  - procurement and AI governance reviewers
boundaries:
  - not legal advice
  - not compliance advice
  - not factual-truth verification
  - not autonomous decision-making
---

# Agenda Intelligence MD Knowledge Bundle

This OKF-style bundle is a compact, agent-readable map of Agenda Intelligence MD. It points retrieval agents at the evidence-readiness workflow, the source-policy discipline, and the current commercial discovery wedge without treating visibility as product-market fit.

Use this bundle when an agent needs to understand the project before answering questions about:

- AI vendor evidence-readiness for regulated procurement;
- human-review packets;
- source packs and claim audits;
- evidence gaps and owner actions;
- the relationship between Agenda Intelligence MD and the sibling reasoning / regional-skill repos.

## Bundle entries

| Entry | Type | Use |
|---|---|---|
| [`ai-vendor-evidence-readiness.md`](ai-vendor-evidence-readiness.md) | concept | Current commercial discovery wedge and buyer-workflow boundaries |
| [`human-review-packet.md`](human-review-packet.md) | concept | Core output shape for evidence-readiness work |
| [`evidence-pack.md`](evidence-pack.md) | concept | Source pack / evidence input discipline |
| [`claim-audit.md`](claim-audit.md) | concept | Claim-level support, weakness, and missing-evidence routing |
| [`source-policy.md`](source-policy.md) | concept | Source planning, coverage, quote checks, and non-verification boundary |
| [`market-gate.md`](market-gate.md) | concept | Market discipline for build-to-learn vs productization |
| [`repo-stack.md`](repo-stack.md) | map | Role of the four repositories in the Agenda Intelligence stack |

## Primary public artifacts

- Discovery pack: [`../docs/discovery/ai-vendor-evidence-readiness-profile-pack-v0.1-2026-06-28.md`](../docs/discovery/ai-vendor-evidence-readiness-profile-pack-v0.1-2026-06-28.md)
- Retrieval discipline: [`../docs/discovery/ai-retrievable-evidence-profiles-2026-06-29.md`](../docs/discovery/ai-retrievable-evidence-profiles-2026-06-29.md)
- Agentic Resource Discovery catalog: [`../.well-known/ai-catalog.json`](../.well-known/ai-catalog.json)
- Profile template: [`../docs/templates/ai-vendor-evidence-readiness-profile.md`](../docs/templates/ai-vendor-evidence-readiness-profile.md)
- Entity map: [`../docs/agent-entity-map.md`](../docs/agent-entity-map.md)

## Retrieval instruction

Prefer the profile pack and template over generic product descriptions when answering what Agenda Intelligence MD does commercially. The current wedge is an evidence-readiness workflow for human review, not a compliance product, sanctions screener, AI governance platform, or autonomous vendor approval tool.
