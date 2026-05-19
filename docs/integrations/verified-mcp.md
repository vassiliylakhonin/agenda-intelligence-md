# Verified MCP Setup

Use this checklist after adding `agenda-intelligence-mcp` to Claude Desktop,
Cursor, Codex, or another MCP-capable client.

## Verify in 60 seconds

1. Confirm the package is installed:

```bash
agenda-intelligence --version
```

2. Confirm the server command is visible to your shell:

```bash
which agenda-intelligence-mcp
```

3. Print the config for your client:

```bash
agenda-intelligence mcp-config --client claude-desktop
agenda-intelligence mcp-config --client cursor
agenda-intelligence mcp-config --client codex
```

4. Run the local smoke tests:

```bash
agenda-intelligence doctor
agenda-intelligence doctor --json
python3 scripts/smoke_mcp_config.py --command agenda-intelligence
python3 scripts/smoke_mcp.py --command agenda-intelligence-mcp
```

If you are outside a source checkout and do not have the `scripts/` directory,
use your MCP client UI to run the sanity prompts below.

## Expected tools

After restart or reload, the MCP client should expose these tools:

- `validate_brief`
- `validate_evidence`
- `get_protocol`
- `list_lenses`
- `get_lens`
- `list_source_categories`
- `source_plan`
- `source_coverage`
- `score_output`

## Sanity prompts

Use these prompts in your MCP-capable client.

```text
List the available Agenda Intelligence MCP tools.
```

```text
Call the Agenda Intelligence list_source_categories tool.
Then call source_plan for category technology-ai and return the must_check source types.
Then call source_coverage on an evidence pack for the same category and return any
missing_required_sources.
```

```text
Use Agenda Intelligence score_output to compare:

Before: Generic update. Monitor developments.

After: Signal classification: signal. Signal markers: compliance-relevant development.
What changed: guidance moved toward implementation.
Main uncertainty: whether enforcement follows.
Watch next: regulator guidance and compliance deadline.
```

Expected result:

- tool list includes `list_source_categories`, `source_plan`, `source_coverage`, and `score_output`
- `list_source_categories.category_ids` includes `technology-ai`
- `source_plan` returns category `technology-ai`
- `source_plan.plan.must_check` is present
- `source_coverage` returns `missing_required_sources`
- `score_output` returns `implemented: true`
- `score_output.after_score` is higher than `before_score`

## Troubleshooting

### `agenda-intelligence-mcp: command not found`

Find the absolute path:

```bash
which agenda-intelligence-mcp
```

Then replace `"command": "agenda-intelligence-mcp"` with that absolute path in
your MCP config.

### The terminal works, but the desktop app does not

Desktop apps often launch with a smaller `PATH` than your shell. Use an
absolute command path in the client config, then restart the app.

### The client says the JSON config is invalid

Run the CLI generator instead of editing by hand:

```bash
agenda-intelligence mcp-config --client claude-desktop
agenda-intelligence mcp-config --client cursor
```

Then paste the generated JSON into the client config file.

### Codex does not load the server

Confirm the block is in `~/.codex/config.toml`:

```toml
[mcp_servers.agenda-intelligence]
command = "agenda-intelligence-mcp"
enabled = true
startup_timeout_sec = 10
tool_timeout_sec = 30
```

Restart Codex after editing `config.toml`.

### The server starts, but no tools appear

Restart or reload the client, then ask it to list tools. If the list is still
empty, run:

```bash
agenda-intelligence doctor
```

For machine-readable output:

```bash
agenda-intelligence doctor --json
```

You can also start the raw server:

```bash
agenda-intelligence-mcp
```

The command should stay open and wait for JSON-RPC input. If it exits
immediately, reinstall the package:

```bash
pip install --upgrade agenda-intelligence-md
```

### The wrong Python environment is used

Check where the package is installed:

```bash
python3 -m pip show agenda-intelligence-md
which agenda-intelligence
which agenda-intelligence-mcp
```

If these point to different environments, install the package in the Python
environment used by your MCP client, or configure the client with the absolute
path to the intended `agenda-intelligence-mcp`.
