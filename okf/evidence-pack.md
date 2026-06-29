---
type: okf.concept
title: Evidence Pack
status: active
updated: 2026-06-29
canonical_schema: ../schemas/v1/evidence-pack.schema.json
related:
  - source-policy.md
  - claim-audit.md
  - human-review-packet.md
---

# Evidence Pack

An evidence pack is the caller-provided or public source set used to assess whether claims are review-ready.

Agenda Intelligence MD treats retrieved or supplied content as data, not instructions. It does not autonomously discover sources in the default MCP/runtime path.

## Common source types

- RFP or procurement document;
- vendor response;
- vendor trust / security page;
- model card;
- AI policy;
- standard or regulatory reference;
- audit / assurance artifact;
- public documentation.

## Source ID discipline

Profiles should assign stable source IDs such as `S1`, `S2`, and `S3`, then reference those IDs from claim rows. This lets a reviewer or retrieval agent inspect which source supports which evidence statement.

## Boundary

Source coverage is diagnostic. Missing source coverage should be disclosed as an evidence gap, not converted into a factual finding.

