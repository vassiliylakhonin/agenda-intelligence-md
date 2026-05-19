# v0.7.1 — Client-Specific MCP Configs

v0.7.1 makes MCP setup more copy-pasteable for specific agent clients.

## Added

- `agenda-intelligence mcp-config --client generic`
- `agenda-intelligence mcp-config --client claude-desktop`
- `agenda-intelligence mcp-config --client cursor`
- `agenda-intelligence mcp-config --client codex`

## Docs

- MCP integration docs now include ready-to-copy sections for:
  - Claude Desktop
  - Cursor
  - Codex local MCP
  - generic JSON clients

## Compatibility

- `agenda-intelligence mcp-config` still defaults to the older minimal generic JSON shape.
