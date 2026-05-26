# Container deployment

## Purpose

This container runs the Agenda Intelligence MD stdio MCP server.

It is intended for MCP-compatible agent hosts, MCP catalogs, and container-based introspection. It is not yet a hosted HTTP API.

## Build

```bash
docker build -t agenda-intelligence-md-mcp:1.0.1 .
```

## Run

```bash
docker run --rm -i agenda-intelligence-md-mcp:1.0.1
```

## What starts

The image starts:

```bash
agenda-intelligence-mcp
```

## Optional LLM mode

The default image does not install the optional `llm` extra and does not require `ANTHROPIC_API_KEY`.

Hosts that want direct model calls from `analyze` should build a derived image that installs:

```bash
pip install "agenda-intelligence-md[llm]==1.0.1"
```

and injects `ANTHROPIC_API_KEY` through their own secret manager.

## Data handling

By default, the stdio MCP container does not persist customer inputs, source packs, memo content, or API keys.

Do not log prompts, source excerpts, evidence packs, full memo content, or secrets in downstream wrappers unless explicitly enabled by the operator.

## Boundaries

- No autonomous live source retrieval.
- No factual-truth verification.
- No legal, compliance, sanctions, financial, investment, insurance, or trading advice.
- Human review is required for high-stakes decisions.

## API container

The separate [`HTTP API shell`](http-api.md) uses `Dockerfile.api` for the portable HTTP wrapper. It exposes:

- `/healthz`
- `/readyz`
- `/v1/audit-claims`
- `/v1/source-coverage`
- `/v1/score`
- `/v1/middle-corridor/deal-risk`

The root `Dockerfile` remains the stdio MCP image.

## A2A container

The separate [`A2A adapter shell`](a2a-adapter.md) uses `Dockerfile.a2a` for the JSON-RPC stdio wrapper. It starts:

```bash
agenda-intelligence-a2a
```
