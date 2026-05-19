# v0.6.0 — MCP Stdio Server

v0.6.0 makes Agenda Intelligence directly usable as an MCP stdio server.

## Added

- `agenda-intelligence-mcp` console command.
- Minimal JSON-RPC stdio transport with:
  - `initialize`
  - `ping`
  - `tools/list`
  - `tools/call`
- MCP tools:
  - `validate_brief`
  - `validate_evidence`
  - `get_protocol`
  - `list_lenses`
  - `get_lens`
  - `source_plan`

## Notes

- The server is read-only and local-first.
- Tool results are returned as JSON text content.
- HTTP/WebSocket transport remains planned.
