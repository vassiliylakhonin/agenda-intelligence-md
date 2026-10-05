# Hosted MCP and A2A quickstart

Each Worker serves one profile. This guide uses Critical Minerals; replace the
host with another published Worker to discover that profile's tools. These
connectivity checks are free and do not evaluate a case or transfer funds.

The installed local stdio MCP server is a separate transport and has no hosted
payment requirement. Hosted evaluation of your own input uses signed payment
on Base. Adding a remote MCP URL alone does not provide a payment adapter.

## 1. Find the service and price

```bash
BASE='https://critical-minerals-due-diligence-a2a.vassiliy-lakhonin.workers.dev'
curl -sS "$BASE/.well-known/agent-card.json"
curl -sS "$BASE/.well-known/mcp/server-card.json"
curl -sS "$BASE/.well-known/x402"
```

The remote MCP URL is `https://critical-minerals-due-diligence-a2a.vassiliy-lakhonin.workers.dev/mcp`.

## 2. Initialize and list tools

The hosted service accepts initialization with revision `2025-11-25`, verified
on all 12 Workers. Use the revision returned by initialization for subsequent
requests. The service is stateless and does not issue a session ID.

```bash
curl -sS "$BASE/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data-binary '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"example-client","version":"1.0"}}}'

# Initialization notification has no JSON response body (HTTP 202).
curl -sS "$BASE/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  --data-binary '{"jsonrpc":"2.0","method":"notifications/initialized"}'

curl -sS "$BASE/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  --data-binary '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Read `result.tools`: each tool publishes its name, input schema, output schema
and example arguments in `_meta["com.agenda/readiness"].example_arguments`.
Use those arguments directly in `tools/call.params.arguments`; do not send a
local stdio tool name to a Worker that does not list it.

## 3. Free A2A connectivity check

```bash
curl -sS "$BASE/message/send" \
  -H 'Content-Type: application/json' \
  -H 'A2A-Version: 1.0' \
  --data-binary '{"jsonrpc":"2.0","id":"heartbeat","method":"SendMessage","params":{"message":{"messageId":"example-heartbeat","role":"ROLE_USER","parts":[{"text":"ping"}]}}}'
```

Expect HTTP 200 and `result.task.metadata.operation: "heartbeat"` with
`evaluation_performed: false`. This checks reachability only. Adding a case,
capability, file, context or task continuation does not grant free evaluation.
Use `SendMessage` with `A2A-Version: 1.0`; the legacy `message/send` method is
for A2A 0.3. For domain input, use the exact message example published by the
serving agent card.

## 4. Evaluation and payment

A valid unpaid evaluation returns HTTP 402 with a JSON-RPC `error`, the original
request ID and payment challenge fields. It is not a successful tool result.
Invalid input can return 400 before payment. Inspect both HTTP status and the
JSON-RPC envelope; do not retry a 402 as a successful call or keep polling it.

Follow [payment execution v2](payment-execution.md) for the published price,
funding-wallet signature, exact original body/URL/protocol headers and recovery.
Payment headers are `X-Payment-Tx` and `X-Payment-Signature`; a transaction hash
inside tool arguments grants no access. Do not transfer funds automatically
when testing connectivity. MCP/A2A retries must keep the original JSON-RPC ID.

For a free demonstration, open the Worker site and click **Run a worked
example**. It displays a saved synthetic fixture; submitting an edited live
request remains paid. Responses concern evidence readiness and require human
review, without certifying factual truth or authorizing an external action.

## Runnable Output Verification client

See [the focused integration](../../examples/output-verification/README.md) for a
Node client, a fictional launch hand-off and the expected missing-evidence route.
The hosted demonstration stops at payment admission; offline tests exercise the
actual handler without transferring funds.
