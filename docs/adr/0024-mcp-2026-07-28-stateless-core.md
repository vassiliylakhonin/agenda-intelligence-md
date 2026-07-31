# ADR 0024 — Adopt the MCP 2026-07-28 stateless core and serve MCP from the worker

Status: accepted
Date: 2026-07-31

## Context

The stdio MCP server declared `protocolVersion: "2025-03-26"` — three revisions
behind. The 2026-07-28 revision is the largest change to the protocol so far,
and the parts that matter here all point the same way:

- **Sessions and the handshake are gone.** `Mcp-Session-Id`, `initialize`,
  `notifications/initialized`, and SSE resumability were removed. Every request
  now carries its own protocol version and client capabilities in `_meta`, and
  list endpoints no longer vary per connection.
- **`server/discover` is mandatory.** Servers advertise supported versions,
  capabilities, and identity through it; clients may also use it as a
  backward-compatibility probe on stdio.
- **Results are typed.** Every result carries `resultType`; `"input_required"`
  is reserved for the Multi Round-Trip Requests pattern that replaced
  server-initiated `sampling/createMessage`, `elicitation/create`, and
  `roots/list`.
- **List results are cacheable.** `tools/list` returns `ttlMs` and `cacheScope`,
  and servers should keep tool order deterministic so the client's prompt prefix
  stays cacheable between turns.
- **Roots, Sampling, and Logging are deprecated** under a twelve-month window.

Two facts about this repo decide the response. First, every MCP tool here is a
pure function of its arguments over packaged data — there has never been any
per-connection state to negotiate, so the stateless core removes a handshake this
server was only going through the motions of. Second, serving MCP over HTTP
previously required holding a session and a resumable stream per client, which on
Cloudflare Workers means Durable Objects — cost and complexity out of proportion
to a triage endpoint. With sessions removed, MCP becomes an ordinary
request/response POST that the existing worker can answer on the path it already
uses for A2A.

## Decision

**Adopt 2026-07-28 as the declared revision on the stdio server, and expose a
stateless MCP endpoint on the deployed workers at `POST /mcp`.**

Stdio server (`src/agenda_intelligence/mcp_stdio.py`):

- `PROTOCOL_VERSION` becomes `2026-07-28`; `SUPPORTED_PROTOCOL_VERSIONS` lists the
  older revisions still answered.
- `server/discover` is implemented.
- Every result carries `resultType: "complete"` and the server identity under
  `_meta["io.modelcontextprotocol/serverInfo"]`.
- `tools/list` carries `ttlMs` and `cacheScope: "public"`, in a fixed order.
- A protocol version stated in `_meta` and not in the supported list is rejected
  with `-32022` (`UnsupportedProtocolVersion`), inside the `-32020..-32099` range
  the spec reserved for itself.
- `agenda-intelligence doctor` probes the way a current client does:
  `server/discover` then `tools/list`, version stated per request.

Worker (`deploy/cloudflare-worker/src/mcp.js`, `src/index.js`):

- `POST /mcp` serves `server/discover`, `tools/list`, and `tools/call`.
- One deployment serves one profile, so it exposes exactly one tool: that
  profile's triage contract, named identically to its stdio twin.
- `tools/call` and `message/send` both go through `runProfileRequest`, so the two
  transports cannot drift into different verdicts for the same payload.
- `tools/call` inherits the production Bearer gate, the rate limit, and the usage
  logging that `message/send` has. `server/discover` and `tools/list` stay open,
  like `agent/card`.
- The MCP server card advertises both transports and the supported revisions.

### What is deliberately not adopted

- **MCP Apps and the Tasks extension.** Both fit the shape of this product — an
  inline claim-review panel with human sign-off is exactly what the evidence
  packet workflow wants. Neither is built, because there is no inbound demand for
  it and building it now would be another governance surface without a buyer.
- **MRTR / `input_required`.** Triage is a pure function of supplied evidence; it
  never has to stop and ask the human mid-call. `human_review_required` in the
  response is the escalation channel, and it stays that way.
- **Anything replacing Roots, Sampling, or Logging.** None were ever used, so
  their deprecation is a no-op here.

## Consequences

- Clients on older revisions keep working: `initialize`, `notifications/initialized`,
  and `ping` are still answered on both transports, and an absent `_meta`
  version is treated as compatible rather than rejected.
- The hosted endpoint exposes the deployment's triage contract only, not the full
  local catalog. That difference is stated on the server card so a caller does not
  expect the stdio tool set from a worker.
- Adding a worker profile now means adding its MCP tool spec in `src/mcp.js`
  alongside the A2A dispatch, or the hosted endpoint silently falls back to the
  default profile's tool.
