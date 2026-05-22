# Agenda Intelligence A2A Worker

Free hosted A2A/JSON-RPC discovery wrapper for Agenda Intelligence MD.

This Worker is intentionally small:

- serves a public Agent Card at `/.well-known/agent-card.json`;
- responds to JSON-RPC `message/send` and `tasks/send`;
- returns a lightweight routing note and install instructions for the stdio MCP server;
- does not call paid APIs, payment rails, wallets, or live retrieval;
- does not replace the installable MCP server.

The full product layer remains:

```bash
pip install agenda-intelligence-md
agenda-intelligence-mcp
```

## Why Cloudflare Workers

Cloudflare Workers Free is enough for this wrapper: the official limits currently include 100,000 requests per day, 10 ms CPU time, and 128 MB memory. This endpoint is a small JSON responder, so it fits the free tier better than a long-running Python service.

Docs: https://developers.cloudflare.com/workers/platform/limits/

## Deploy

Install Wrangler if you do not already have it:

```bash
npm install -g wrangler
```

Authenticate once:

```bash
wrangler login
```

Deploy:

```bash
cd deploy/cloudflare-worker
wrangler deploy
```

The deploy output will include a `workers.dev` URL, usually:

```text
https://agenda-intelligence-a2a.<your-subdomain>.workers.dev
```

Use this URL in Agenstry as an A2A agent URL:

```text
https://agenda-intelligence-a2a.<your-subdomain>.workers.dev
```

The Agent Card URL will be:

```text
https://agenda-intelligence-a2a.<your-subdomain>.workers.dev/.well-known/agent-card.json
```

## Smoke test

```bash
curl https://agenda-intelligence-a2a.<your-subdomain>.workers.dev/.well-known/agent-card.json
```

```bash
curl -X POST https://agenda-intelligence-a2a.<your-subdomain>.workers.dev/message/send \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": "probe-1",
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

Expected: HTTP 200 with a JSON-RPC 2.0 response and `status.state: "completed"`.

## Usage analytics

This Worker uses Cloudflare's built-in free observability path:

- Cloudflare Workers Metrics show total requests, successful requests, errors, CPU time, and latency.
- Workers Logs capture one structured `agenda_intelligence_a2a_usage` event for each JSON-RPC `message/send`, `tasks/send`, or `SendMessage` call.
- Agenstry's public listing can show marketplace-side usage, but only for traffic Agenstry can observe.

The custom usage event is privacy-safe by design. It does not log IP addresses, cookies, authorization headers, or full prompt text. It keeps only:

- request method and path;
- JSON-RPC method;
- whether a JSON-RPC id was present;
- prompt character count;
- selected Agenda modules;
- coarse client class, such as `agenstry`, `curl`, `browser`, or `automation`;
- referrer hostname, when present;
- Cloudflare colo and country, when Cloudflare provides them.

View aggregate traffic in the Cloudflare dashboard:

```text
Workers & Pages -> agenda-intelligence-a2a -> Metrics
```

View live structured usage events:

```bash
cd deploy/cloudflare-worker
npx --yes wrangler tail agenda-intelligence-a2a --format=json
```

Useful filters in Workers Logs:

```text
event = "agenda_intelligence_a2a_usage"
jsonrpc_method = "message/send"
client = "agenstry"
likely_probe = false
```

## Test locally

```bash
npm test
```
