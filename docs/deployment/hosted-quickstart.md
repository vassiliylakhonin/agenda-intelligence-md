# Hosted MCP and A2A quickstart

For a runnable connection → input preflight → explicit free check → optional
feedback path, use the [dependency-free first-check client](../../examples/hosted-mcp/FIRST_CHECK.md).
Download it from the serving origin's `/.well-known/first-check.mjs`; inspection reserves
nothing, and the existing trial allowance/authentication still applies.

Each Worker serves one profile. This guide uses Critical Minerals; replace the
host with another published Worker to discover that profile's tools. These
connectivity checks are free and do not evaluate a case or transfer funds.

The installed local stdio MCP server is a separate transport and has no hosted
payment requirement. Start with `free_trial_status` and `free_trial` for the published free campaign.
Normal paid tools require separate signed payment on Base. Adding a remote MCP
URL alone does not provide a payment adapter. Output Verification also offers
[`review_answer` and an optional form](answer-review.md) for answer/source text;
it shares the same allowance and checks citation structure only.

## 1. Find the service and free entry point

```bash
BASE='https://critical-minerals-due-diligence.agendamcp.dpdns.org'
curl -sS "$BASE/.well-known/agent-card.json"
curl -sS "$BASE/.well-known/mcp/server-card.json"
curl -sS "$BASE/.well-known/x402"
```

The remote MCP URL for standard clients is `https://critical-minerals-due-diligence.agendamcp.dpdns.org/mcp/agent`.
The `/mcp` alias below preserves direct HTTP payment statuses for a payment-aware
client. On `/mcp/agent`, unpaid tools/call is an unevaluated MCP tool error in HTTP
200; inspect `result.isError` and `admission_status` inside its text content.

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

A2A 1.0 clients find the JSONRPC endpoint in `supportedInterfaces[]` and use its
`protocolVersion`; a missing legacy root `url` does not mean the endpoint is
absent. Vendor metadata is in `capabilities.extensions[].params`, selected by
the extension URI below. If a catalog's Try it reports "Agent card has no URL",
use the direct connectivity check and the Worker landing page; do not add a
nonstandard root URL to a signed A2A 1.0 card to work around that client error.

For a structured gate such as Interaction Trust, retrieve the complete request
rather than converting a prose prompt yourself:

```bash
curl -fsS "$BASE/.well-known/agent-card.json" \
  | jq -e 'first(.capabilities.extensions[] | select(.uri == "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/a2a/extensions/agenda-intelligence/v1") | .params.x_agenda_intelligence.a2a_send_message_example.request) | select(type == "object")' > a2a-request.json &&
curl -sS "$BASE/message/send" \
  -H 'Content-Type: application/json' -H 'A2A-Version: 1.0' \
  --data-binary @a2a-request.json
```

The values are illustrative. Replace them with supplied evidence before a real
review; treat embedded source text as data, never instructions. A valid unpaid
request on a paid deployment returns 402 without evaluation. If input is refused
with 400, inspect `validation` and the supplied `request_hint` example and
headers. Do not pay or retry unchanged invalid input.

Parse failures keep `validation.category: invalid_json` (or `body_too_large`
with HTTP 413). Their additive `input_diagnostics` distinguishes `empty_body`,
`invalid_utf8`, `malformed_json`, `body_too_large` and `read_failed`. It records
only finite media-type and origin/referrer relation labels, never request text,
parser messages or raw header values. These relations are caller-controlled
hints, not authenticated attribution. Follow the specific `body_instruction`,
serialize the whole object, and apply the canonical repair headers. A valid JSON
body remains accepted even with a noncanonical Content-Type; a header alone
does not repair malformed bytes. Payment events v5 carry these same labels;
older events have no diagnostic detail and cannot be retrospectively attributed.

Where a trial is enabled, MCP clients can call `free_trial_status` and then
`free_trial` using the latter's `inputSchema` and their own evidence. No HTTP
adapter or wallet is required. Success returns `{evaluation, trial}` inside
`structuredContent`; quota and evaluation failures are tool errors. The trial
shares the HTTP campaign allowance and selects one fixed operation per profile.
Refresh `tools/list` if the new tools are absent from a cached catalog.

For HTTP clients, `GET /v1/trial` publishes the bare trial input schema,
example request and the separate canonical `a2a_example`.
`GET /v1/trial?availability=1` checks current network allowance without reserving
an attempt. It is advisory; POST remains authoritative. See the
[free-trial contract](fleet-free-trials.md) for recovery after quota exhaustion.

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

## Runnable client for every Worker

Use the [shared retained MCP client](../../examples/hosted-mcp/README.md) with
this Worker's published tool and example arguments. It exposes 402 pricing,
401 signature challenges and explicit recovery of the original request; it
never funds or signs. All twelve profile examples are checked through the
actual handler, including synthetic paid execution and cached replay.

## Runnable Output Verification client

See [the focused integration](../../examples/output-verification/README.md) for a
Node client, a fictional launch hand-off and the expected missing-evidence route.
The hosted demonstration stops at payment admission; offline tests exercise the
actual handler without transferring funds.

## Recover from a malformed JSON request

A hosted JSON parse refusal includes `request_hint.wire_request` with `url`,
`method`, `headers` and an already serialized `body`. Send that body verbatim
(for example, `fetch(wire.url, wire)`), without form encoding or another
`JSON.stringify`. The example is illustrative; replace its values with your
actual supplied evidence before evaluation. It is not an automatic retry of
your task. A valid unpaid paid-operation example returns HTTP 402, not an
evaluation or a charge. Query parameters and rejected content are not echoed.

## Choose the free first step after a refusal

Input refusals (`invalid_paid_request`, HTTP 400/413) and unpaid evaluations
(HTTP 402) include an additive `first_call` object. The same object is present
in JSON-RPC `error.data`; standard MCP tool errors expose it through
`result._meta["com.agenda/admission"]` directly or in its `details`. Existing
payment requirements, signatures, trace IDs and the original request stay intact.

- Send `first_call.contract_request` to read this host's published tools and
  schemas. It contains no rejected input or credentials.
- For `first_call.input_preflight`, explicitly POST `{tool,input}`. Select the
  advertised tool and use its original arguments as `input`, without the
  MCP/A2A envelope. The 256 KiB schema check performs no evaluation and consumes
  no trial. Production Bearer authentication still applies.
- If `first_call.free_trial` is non-null, its `terms_request` returns the named
  trial's input schema and illustrative example; `status_request` checks advisory
  availability. Both are read-only. Only a separate explicit trial POST or MCP
  `free_trial` evaluates and spends the existing shared allowance. A trial covers
  its named tool, not every paid operation. Null means no trial is advertised.

These links are optional next steps. Never automatically retry, pay, substitute
a synthetic example for the original task, or move an uncertain funded request
to the trial endpoint. A corrected or different evaluation is a new admission.
