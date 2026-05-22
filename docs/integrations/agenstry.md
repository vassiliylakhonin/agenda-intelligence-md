# Agenstry Discovery

Agenda Intelligence MD includes a public A2A-style Agent Card at:

```text
.well-known/agent-card.json
```

The card is intended for agent registries such as Agenstry and for agent clients that need a machine-readable description of the package.

## Current status

Agenda Intelligence MD is an installable stdio MCP server, not a hosted A2A HTTP service.

```bash
pip install agenda-intelligence-md
agenda-intelligence-mcp
```

The Agent Card therefore describes the product, skills, boundaries, schemas, and MCP transport, while the `url` points to the repository rather than a live `message/send` endpoint.

## Registry positioning

Use this description when submitting or reviewing the listing:

> Evidence-discipline MCP layer for strategic-risk agents. Validates structured strategic-risk memos, audits claim/evidence linkage, diagnoses source-category coverage, routes geography-specific reasoning modules, and exposes packaged signal references.

Use these tags:

```text
strategic-risk, policy-analysis, geopolitics, sanctions, trade, regulation, evidence-audit, source-coverage, mcp
```

## Boundaries to preserve

- No autonomous live source retrieval before v1.0.
- No factual-truth verification.
- No source reputation scoring.
- No legal, financial, compliance, investment, or trading advice.

These boundaries should stay visible in any public registry description. They are part of the trust surface, not a limitation to hide.

## Path to a higher registry score

A higher Agenstry score would require a hosted service wrapper around the current MCP product shell:

- expose a public Agent Card at `https://<domain>/.well-known/agent-card.json`;
- expose a JSON-RPC A2A endpoint, typically `message/send`;
- call the existing `analyze` and `validate_memo` product-layer functions behind that endpoint;
- preserve the current source-retrieval and factual-verification boundaries.

Until then, the current card should be treated as a discovery manifest for an installable MCP package.
