# ADR 0033: Standard-client MCP admission without changing legacy payments

Accepted, 2026-10-09. Additive hosted endpoint, package 1.14.1.

The official Python MCP SDK connected and listed all fleet tools but raised an
HTTPStatusError on the first valid unpaid call to /mcp. Consequently the agent
could not read its payment admission details as a tool result. Legacy clients
rely on HTTP 402 and funding-signature HTTP 401, including exact URL/body binding.

Add /mcp/agent, advertised by hosted discovery and the next MCP Registry release.
Run the same billing handler on the original URL/body, then present valid payment
refusals as HTTP 200 JSON-RPC results with isError=true, text content and
_meta["com.agenda/admission"]. The documented admission object contains
`evaluated:false`, `admission_status` (402 or funding-signature 401), payment trace
and attempt ids, a next step and the original error data under `details`.
It contains no structuredContent: admission does not satisfy the successful
evaluation outputSchema. Signed execution and identical replay remain standard
successful tool results. A payment cannot be reused on a different URL/body.

Bearer authentication still uses HTTP 401. Malformed messages, invalid payment
credentials and quota failures keep their existing protocol/status contracts.
/mcp, /mcp/output-verification, REST and A2A are preserved. No payment, grant,
trial, quota, price or decision policy changes. No automatic funding/signing.
Payment telemetry retains the original admission stage/status before presentation.

Discovery uses actual hosted tool definitions and per-tool access. A free HTTP
/.well-known/fleet.json reuses the same directory as fleet_directory, including
12 profiles and canonical MCP endpoints. Local stdio remains a separate catalog.
Replace unsupported retention/security claims and stale prices with documented
data boundaries and the serving /.well-known/x402 pricing link.

Regression tests cover legacy and new paid journeys through real handlers,
signature and replay binding, auth failures, metadata and retained-client use.
Verify the official SDK against production before considering the rollout done.

Reference: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
(tool business failures use isError; successful structured output follows its schema).
