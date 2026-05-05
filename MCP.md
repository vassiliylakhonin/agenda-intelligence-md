# MCP.md

This file describes the current MCP-shaped Python tool surface and the future
transport/server direction for Agenda-Intelligence.md.

The repository is currently plain markdown + schemas + CLI plus read-only
functions in `agenda_intelligence.mcp_server`. A full HTTP/WebSocket MCP server
is still planned.

## Implemented Python tool functions

### `get_protocol`

Return the top-level protocol or one base reference file from packaged data.

Inputs:

```json
{ "name": "Agenda-Intelligence.md" }
```

### `list_lenses`

Return available regional and sector lenses from packaged `agent-manifest.json`.

Inputs:

```json
{ "type": "regional" }
```

### `get_lens`

Return packaged lens markdown by type and id.

Inputs:

```json
{ "type": "sector", "id": "sanctions" }
```

### `validate_brief`

Validate a JSON agenda brief against `schemas/agenda-brief.schema.json`.

Inputs:

```json
{ "brief": { "bottom_line": "...", "signal_classification": "signal", "what_changed": "...", "main_uncertainty": "...", "watch_next": ["..."] } }
```

## Design rule

MCP should expose small stable contracts, not a large agent framework. The markdown files remain the source of truth.


### `source_plan`

Return required source types for an agenda category from packaged data.

Inputs:

```json
{ "category": "technology-ai" }
```

### `validate_evidence`

Validate an evidence pack against `schemas/evidence-pack.schema.json`.

Inputs:

```json
{ "path": "examples/source/evidence-pack.json" }
```

## Stubs / planned

### `score_output`

Currently returns an explicit `implemented: false` response. It should become a
rubric-based quality scorer after the evaluator moves beyond the before/after
CLI harness.

### `write_memory_card`

Planned. It should create or propose an AnalysisBank memory card after a
success or failure, but it is not implemented yet.
