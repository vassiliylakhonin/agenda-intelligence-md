# Agenda Intelligence MD now has a live A2A wrapper

Agenda Intelligence MD now has a live A2A/JSON-RPC wrapper on Cloudflare Workers:

- Live endpoint: <https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev>
- Agent Card: <https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json>
- JSON-RPC endpoint: <https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/message/send>
- Agenstry listing: <https://agenstry.com/agents/agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev>

This is a discovery and routing surface for the installable MCP product shell. It lets agent registries, A2A clients, and reviewers see that Agenda Intelligence MD has a live Agent Card, structured skills, and a working JSON-RPC endpoint.

The full product remains the stdio MCP package:

```bash
pip install agenda-intelligence-md
agenda-intelligence-mcp
```

## What it does

- Serves a valid A2A 1.0 Agent Card.
- Responds to JSON-RPC `message/send`.
- Routes prompts to the relevant Agenda modules, such as Central Asia/Caspian, Gulf/Middle East, EU, and sanctions-sector coverage.
- Points callers back to the installable MCP server for full analysis, memo validation, evidence audit, source coverage, quote checks, and signal archive lookup.
- Publishes live trust/uptime badges through Agenstry.

## What it does not do

- No payments or wallet rails.
- No autonomous live source retrieval.
- No factual-truth verification.
- No legal, financial, compliance, investment, or trading advice.
- No replacement for analyst judgment.

## Try it

```bash
curl -X POST https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/message/send \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": "demo-1",
    "method": "message/send",
    "params": {
      "message": {
        "parts": [
          {
            "kind": "text",
            "text": "Route a sanctions question about Kazakhstan and the Middle Corridor."
          }
        ]
      }
    }
  }'
```

Expected result: a JSON-RPC 2.0 response with `status.state` set to `completed`, a short routing note, and `metadata.modules_used`.

## Current status

- Package version: `0.9.3`
- A2A protocol: `1.0`
- Hosted runtime: Cloudflare Workers
- Marketplace listing: Agenstry
- Usage analytics: private Cloudflare KV-backed `/stats`, protected by `STATS_TOKEN`

Deployment and analytics details live in [`deploy/cloudflare-worker/README.md`](../../deploy/cloudflare-worker/README.md).
