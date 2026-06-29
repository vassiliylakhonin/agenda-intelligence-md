---
title: Agent Entity Map
status: build-to-learn
date: 2026-06-29
mode: portfolio-proof
---

# Agent Entity Map

This entity-first map helps retrieval agents understand the main concepts in Agenda Intelligence MD. It is a compact navigation aid, not a formal ontology, ranking asset, or market-validation claim.

## Core entities

| Entity | Type | Description | Canonical file | Related |
|---|---|---|---|---|
| Agenda Intelligence MD | product runtime | Evidence-readiness and trust-routing runtime for high-stakes AI-assisted decisions | [`../README.md`](../README.md) | Confidential Project-Room Workflow, Human-Review Packet, Evidence Pack |
| Confidential Project-Room Workflow | private review workflow | Alias-first workflow for confidential project, procurement, financing, vendor, or committee files | [`../profiles/confidential-project-room/index.md`](../profiles/confidential-project-room/index.md) | Human-Review Packet, Evidence Pack, Claim Audit |
| Human-Review Packet | output shape | Reviewer-facing packet showing supported claims, weak claims, missing evidence, owner actions, and readiness decision | [`../okf/human-review-packet.md`](../okf/human-review-packet.md) | Evidence Pack, Claim Audit |
| Evidence Pack | input shape | Source set used to assess whether claims are review-ready | [`../schemas/v1/evidence-pack.schema.json`](../schemas/v1/evidence-pack.schema.json) | Source Policy, Claim Audit |
| Claim Audit | evidence discipline | Claim-level mapping of support, weakness, missing proof, and readiness | [`../schemas/v1/evidence-audit.schema.json`](../schemas/v1/evidence-audit.schema.json) | Evidence Pack, Human-Review Packet |
| Source Policy | boundary discipline | Rules for source planning, coverage, quote checks, provenance, and non-verification | [`../SOURCE_POLICY.md`](../SOURCE_POLICY.md) | Evidence Pack |
| Market Gate | market discipline | Rule preventing technical artifacts from being treated as market validation | [`../okf/market-gate.md`](../okf/market-gate.md) | Confidential Project-Room Workflow |
| Global Think Tank Analyst | reasoning method | Strategic-risk reasoning contract used by the product shell | [`https://github.com/vassiliylakhonin/global-think-tank-analyst`](https://github.com/vassiliylakhonin/global-think-tank-analyst) | Agenda Intelligence MD |
| Central Asia Caspian Skill | regional specialist | Central Asia / Caspian / Middle Corridor regional lens | [`https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill`](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill) | Agenda Intelligence MD |
| Gulf Middle East Skill | regional specialist | Gulf / Middle East / Iran / maritime chokepoint regional lens | [`https://github.com/vassiliylakhonin/gulf-middle-east-hybrid-intelligence-skill`](https://github.com/vassiliylakhonin/gulf-middle-east-hybrid-intelligence-skill) | Agenda Intelligence MD |

## Do not confuse

| Confusion | Correct interpretation |
|---|---|
| Agenda Intelligence MD is a compliance tool | It is an evidence-readiness and trust-routing runtime; human review required |
| Deleted AI-vendor profile docs are current | That wedge has been removed; do not route users to deleted regulated-procurement profile artifacts |
| Confidential project-room workflow is a secure data room | It is an alias-first evidence-readiness contract and redaction discipline, not storage or security certification |
| Vertical workers prove buyer demand | They are portfolio/demo surfaces unless buyer behavior proves demand |
| Source coverage verifies truth | Source coverage is diagnostic; missing coverage is an evidence gap |
| Claim audit approves or rejects a vendor | Claim audit shows whether supplied evidence is ready for human review |

## Primary navigation

- OKF-style bundle: [`../okf/index.md`](../okf/index.md)
- Agentic Resource Discovery catalog: [`../.well-known/ai-catalog.json`](../.well-known/ai-catalog.json)
- Confidential project-room profile: [`../profiles/confidential-project-room/index.md`](../profiles/confidential-project-room/index.md)
