# v0.6.1 — MCP Config and Smoke Coverage

v0.6.1 makes the MCP server easier to connect and verifies it after release.

## Added

- `agenda-intelligence mcp-config` prints a copy-pasteable MCP stdio config.
- Post-release smoke workflow now checks:
  - `agenda-intelligence mcp-config`
  - `agenda-intelligence-mcp`
  - `tools/list`
  - `tools/call source_plan`

## Notes

- This is a small adoption/DX patch on top of the v0.6.0 MCP stdio server.
