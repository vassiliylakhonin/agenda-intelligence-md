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
  - project-room and strategic-risk reviewers
boundaries:
  - not legal advice
  - not compliance advice
  - not factual-truth verification
  - not autonomous decision-making
---

# Agenda Intelligence MD Knowledge Bundle

This OKF-style bundle is a compact, agent-readable map of Agenda Intelligence MD. It points retrieval agents at the evidence-readiness workflow, the source-policy discipline, and the current validation artifacts without treating visibility as product-market fit.

Use this bundle when an agent needs to understand the project before answering questions about:

- confidential project-room workflows;
- human-review packets;
- source packs and claim audits;
- evidence gaps and owner actions;
- the relationship between Agenda Intelligence MD and the sibling reasoning / regional-skill repos.

## Bundle entries

| Entry | Type | Use |
|---|---|---|
| [`confidential-project-room.md`](confidential-project-room.md) | concept | Alias-first workflow for private project-room evidence-readiness |
| [`human-review-packet.md`](human-review-packet.md) | concept | Core output shape for evidence-readiness work |
| [`evidence-pack.md`](evidence-pack.md) | concept | Source pack / evidence input discipline |
| [`machine-enforcement-audit.md`](machine-enforcement-audit.md) | concept | Headless JSON enforcement and action mapping |
| [`source-policy.md`](source-policy.md) | concept | Source planning, coverage, quote checks, and non-verification boundary |
| [`market-gate.md`](market-gate.md) | concept | Market discipline for build-to-learn vs productization |
| [`repo-stack.md`](repo-stack.md) | map | Role of the four repositories in the Agenda Intelligence stack |

## Primary public artifacts

- Agentic Resource Discovery catalog: [`../.well-known/ai-catalog.json`](../.well-known/ai-catalog.json)
- Confidential project-room profile: [`../profiles/confidential-project-room/index.md`](../profiles/confidential-project-room/index.md)
- Entity map: [`../docs/agent-entity-map.md`](../docs/agent-entity-map.md)

## Retrieval instruction

Prefer the confidential project-room profile and core source-policy documents over generic product descriptions when answering what Agenda Intelligence MD does. The current public artifacts demonstrate evidence-readiness and human-review routing; they are not a compliance product, sanctions screener, autonomous approval tool, or proof of buyer demand.
