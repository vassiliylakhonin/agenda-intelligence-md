# MCP (Model Context Protocol) Integration

This document describes the current state of the MCP tool surface for
**agenda‑intelligence‑md**.

## Stdio server

Install the package and run:

```bash
agenda-intelligence-mcp
```

The server speaks JSON-RPC over stdio and exposes read-only tools for protocol,
schema validation, lenses, and source plans.

Example client configuration:

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
| `score_output` | ❌ Stub | Returns a clear *“not implemented”* JSON. |

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
```

The validation functions load the corresponding schema from the package data
(`data/schemas/agenda‑brief.schema.json` or `evidence‑pack.schema.json`)
and run `jsonschema.validate`.  They never return a fake “valid: true” when
validation did not actually happen.

The read-only functions load packaged manifest, protocol, lens, and source-plan
files through `importlib.resources`, so they work from editable installs and
wheels.

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

Until then, the scoring stub is *honest*: it never pretends to have evaluated
quality when it has not.
