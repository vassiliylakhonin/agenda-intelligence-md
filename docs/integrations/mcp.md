# MCP (Model Context Protocol) Integration

This document describes the current state of the MCP tool surface for
**agenda‑intelligence‑md**.

## Stdio server

Install the package and run:

```bash
agenda-intelligence-mcp
```

The server speaks JSON-RPC over stdio and exposes tools for protocol lookup,
schema validation, lenses, source plans, and heuristic before/after scoring.

Print a client configuration:

```bash
agenda-intelligence mcp-config
agenda-intelligence mcp-config --client claude-desktop
agenda-intelligence mcp-config --client cursor
agenda-intelligence mcp-config --client codex
```

Output:

```json
{
  "mcpServers": {
    "agenda-intelligence": {
      "command": "agenda-intelligence-mcp"
    }
  }
}
```

## Client configuration

Install the package first:

```bash
pip install agenda-intelligence-md
```

If `agenda-intelligence-mcp` is not on your client app's `PATH`, replace the
command with the absolute path from:

```bash
which agenda-intelligence-mcp
```

### Claude Desktop

Add this server to `claude_desktop_config.json`. On macOS the file is usually:
`~/Library/Application Support/Claude/claude_desktop_config.json`.

```bash
agenda-intelligence mcp-config --client claude-desktop
```

```json
{
  "mcpServers": {
    "agenda-intelligence": {
      "type": "stdio",
      "command": "agenda-intelligence-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

Restart Claude Desktop after editing the file.

### Cursor

For a project-local setup, create `.cursor/mcp.json` in the project root. For a
global setup, create `~/.cursor/mcp.json`.

```bash
agenda-intelligence mcp-config --client cursor
```

```json
{
  "mcpServers": {
    "agenda-intelligence": {
      "type": "stdio",
      "command": "agenda-intelligence-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

Restart Cursor or reload the window after editing the file.

### Codex local MCP

Add this to `~/.codex/config.toml`:

```bash
agenda-intelligence mcp-config --client codex
```

```toml
[mcp_servers.agenda-intelligence]
command = "agenda-intelligence-mcp"
enabled = true
startup_timeout_sec = 10
tool_timeout_sec = 30
```

Keep `supports_parallel_tool_calls` disabled unless you have reviewed the tool
surface and want Codex to call this server's tools concurrently.

### Generic JSON

Use this shape for MCP clients that accept the common `mcpServers` JSON format:

```bash
agenda-intelligence mcp-config --client generic
```

```json
{
  "mcpServers": {
    "agenda-intelligence": {
      "type": "stdio",
      "command": "agenda-intelligence-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

The generic output intentionally keeps the older minimal shape:

```json
{
  "mcpServers": {
    "agenda-intelligence": {
      "command": "agenda-intelligence-mcp"
    }
  }
}
```

## What is implemented

| Tool | Status | Notes |
|------|--------|-------|
| `validate_brief` | ✅ **Implemented** | Uses the same `jsonschema` validation as the CLI `validate‑brief` command. |
| `validate_evidence` | ✅ **Implemented** | Uses the same `jsonschema` validation as the CLI `validate‑evidence` command. |
| `get_protocol` | ✅ **Implemented** | Returns packaged protocol markdown by name or `entrypoint`. |
| `list_lenses` | ✅ **Implemented** | Returns packaged regional and sector lens paths from the manifest. |
| `get_lens` | ✅ **Implemented** | Returns packaged lens markdown by type and id. |
| `source_plan` | ✅ **Implemented** | Returns packaged source requirements for a category. |
| `score_output` | ✅ **Implemented** | Scores before/after output with the public protocol-marker rubric. |

## JSON-RPC methods

The stdio server handles:

- `initialize`
- `notifications/initialized`
- `ping`
- `tools/list`
- `tools/call`

Tool results are returned as JSON text content.

## How the implemented tools work

```python
from agenda_intelligence.mcp_server import (
    get_lens,
    get_protocol,
    list_lenses,
    score_output,
    source_plan,
    validate_brief,
    validate_evidence,
)

result = validate_brief(brief_dict)
# result == {
#   "implemented": True,
#   "valid": True/False,
#   "errors": [...]
# }

result = validate_evidence(evidence_dict)
protocol = get_protocol("entrypoint")
lenses = list_lenses("regional")
eu_lens = get_lens("regional", "eu")
ai_plan = source_plan("technology-ai")
score = score_output(before_text, after_text)
```

The validation functions load the corresponding schema from the package data
(`data/schemas/agenda‑brief.schema.json` or `evidence‑pack.schema.json`)
and run `jsonschema.validate`.  They never return a fake “valid: true” when
validation did not actually happen.

The read-only functions load packaged manifest, protocol, lens, and source-plan
files through `importlib.resources`, so they work from editable installs and
wheels.

`score_output` is heuristic: it checks protocol markers such as signal
classification, what changed, uncertainty, falsifiability, watch-next
indicators, and decision value. It does not verify factual truthfulness.

## CLI equivalents

```bash
# Validate a brief
agenda-intelligence validate-brief examples/agenda-brief.json

# Validate an evidence pack
agenda-intelligence validate-evidence examples/source/evidence-pack.json

# List lenses
agenda-intelligence list-lenses

# Get a specific lens
agenda-intelligence get-lens regional eu

# Show a source plan
agenda-intelligence source-plan technology-ai

# Score a before/after example
agenda-intelligence score examples/before-after/eu-ai-act.md
```

## Roadmap

| Target | Planned |
|--------|----------|
| v0.6 | MCP stdio server exposing read-only tools. |
| v0.7 | Promote `score_output` from stub to rubric-based quality scoring. |
| v0.8 | Optional HTTP/WebSocket transport. |
