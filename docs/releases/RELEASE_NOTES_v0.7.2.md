# v0.7.2 — Doctor Command

v0.7.2 adds local self-diagnosis for package and MCP setup issues.

## Added

- `agenda-intelligence doctor`
- `agenda-intelligence doctor --json`
- `agenda-intelligence doctor --strict`
- `agenda-intelligence doctor --mcp-command "<command>"`

## What Doctor Checks

- package version
- packaged manifest availability and schema validity
- MCP config output for generic, Claude Desktop, Cursor, and Codex
- whether the MCP command is available
- whether the MCP server responds to `tools/list`
- whether the expected tools are exposed:
  - `validate_brief`
  - `validate_evidence`
  - `get_protocol`
  - `list_lenses`
  - `get_lens`
  - `source_plan`
  - `score_output`

## CI

- CI now runs `doctor` against the editable MCP server.
- Post-release smoke runs `doctor --strict` against the published package.
