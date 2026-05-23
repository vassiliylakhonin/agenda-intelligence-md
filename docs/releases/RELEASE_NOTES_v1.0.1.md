# v1.0.1 — MCP directory metadata

v1.0.1 is a metadata-only patch release for MCP directories and agent registries.

## What changed

- Expanded all 16 stdio MCP tool descriptions with clearer usage guidance, expected inputs, returned outputs, and explicit boundaries.
- Added non-validation `description` annotations to MCP `inputSchema` properties and mirrored them in both `agent-manifest.json` copies.
- Kept tool names, required arguments, validation behavior, CLI behavior, and product behavior unchanged.

## Why

Directories such as Glama inspect published wheels to build MCP server profiles and tool-quality scores. The v1.0.0 wheel exposed correct tools, but several descriptions were too terse for downstream discovery and ranking.

## Install

```bash
pip install --upgrade agenda-intelligence-md
```

Pinned wheel:

```bash
pip install https://github.com/vassiliylakhonin/agenda-intelligence-md/releases/download/v1.0.1/agenda_intelligence_md-1.0.1-py3-none-any.whl
```
