# MCP.md

This file sketches a future MCP interface for Agenda-Intelligence.md.

The repository is currently plain markdown + schemas + CLI. An MCP server would expose the same primitives as tools for agents.

## Candidate tools

### `get_protocol`

Return the top-level protocol or one base reference file.

Inputs:

```json
{ "name": "Agenda-Intelligence.md" }
```

### `list_lenses`

Return available regional and sector lenses from `agent-manifest.json`.

Inputs:

```json
{ "type": "regional" }
```

### `get_lens`

Return a lens by id.

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

### `score_output`

Run the lightweight before/after rubric scorer or a future evaluator.

Inputs:

```json
{ "path": "examples/before-after/eu-ai-act.md" }
```

### `write_memory_card`

Create or propose an AnalysisBank memory card after a success or failure.

Inputs:

```json
{ "kind": "failure", "title": "...", "trigger": "...", "pattern": "..." }
```

## Design rule

MCP should expose small stable contracts, not a large agent framework. The markdown files remain the source of truth.


### `source_plan`

Return required source types for an agenda category.

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
