# MCP (Model‑Control‑Protocol) Integration

This document describes the current state of the MCP tool surface for
**agenda‑intelligence‑md**.

## What is implemented

| Tool | Status | Notes |
|------|--------|-------|
| `validate_brief` | ✅ **Implemented** | Uses the same `jsonschema` validation as the CLI `validate‑brief` command. |
| `validate_evidence` | ✅ **Implemented** | Uses the same `jsonschema` validation as the CLI `validate‑evidence` command. |
| `get_protocol` | ❌ Stub | Returns a clear *“not implemented”* JSON with an error message. |
| `list_lenses` | ❌ Stub | Returns a clear *“not implemented”* JSON. |
| `get_lens` | ❌ Stub | Returns a clear *“not implemented”* JSON. |
| `source_plan` | ❌ Stub | Returns a clear *“not implemented”* JSON. |
| `score_output` | ❌ Stub | Returns a clear *“not implemented”* JSON. |

## How the implemented tools work

```python
from agenda_intelligence.mcp_server import validate_brief, validate_evidence

result = validate_brief(brief_dict)
# result == {
#   "implemented": True,
#   "valid": True/False,
#   "errors": [...]
# }

result = validate_evidence(evidence_dict)
```

Both functions load the corresponding schema from the package data
(`data/schemas/agenda‑brief.schema.json` or `evidence‑pack.schema.json`)
and run `jsonschema.validate`.  They never return a fake “valid: true” when
validation did not actually happen.

## What to do until the other tools are implemented

Use the **CLI commands** that are fully functional:

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
| v0.6 | Full MCP server that exposes all tools via HTTP/WebSocket. |
| v0.7 | Add `get_protocol`, `list_lenses`, `get_lens`, `source_plan`, `score_output`. |

Until then, the MCP skeleton is *honest*: stubs never pretend to have done work.
