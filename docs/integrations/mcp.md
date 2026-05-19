# MCP Integration

The canonical MCP documentation lives in [`MCP.md`](../../MCP.md) (repository root).

This page covers client-specific setup. For tool descriptions, wire protocol, and verification status, see [`MCP.md`](../../MCP.md). For post-setup verification, see [`verified-mcp.md`](verified-mcp.md).

## Quick setup

```bash
pip install agenda-intelligence-md
agenda-intelligence mcp-config --client cursor
agenda-intelligence mcp-config --client claude-desktop
agenda-intelligence mcp-config --client codex
```

## Client configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

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

Restart Claude Desktop after editing.

### Cursor

Create `.cursor/mcp.json` in the project root (project-local) or `~/.cursor/mcp.json` (global):

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

Restart Cursor after editing.

### Codex

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.agenda-intelligence]
command = "agenda-intelligence-mcp"
enabled = true
startup_timeout_sec = 10
tool_timeout_sec = 30
```

Restart Codex after editing.

### Generic JSON

```json
{
  "mcpServers": {
    "agenda-intelligence": {
      "command": "agenda-intelligence-mcp"
    }
  }
}
```

If `agenda-intelligence-mcp` is not on your client app's `PATH`, replace with the absolute path from `which agenda-intelligence-mcp`.

After adding the config, follow the [`verified-mcp.md`](verified-mcp.md) checklist to confirm the tools are visible.
