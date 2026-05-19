# MCP

`agenda-intelligence-mcp` is a real stdio MCP server shipping with the package.
It exposes 10 tool functions implemented in `agenda_intelligence.mcp_server`.

**Verification status**: wire-protocol verified — `scripts/smoke_mcp.py` exercises the full JSON-RPC cycle (initialize → tools/list → tools/call) against the running stdio server, including `audit_claims`.

Live source retrieval is **not implemented**.

---

## Running the server

```bash
agenda-intelligence-mcp
```

Or add it to your MCP client config:

```bash
agenda-intelligence mcp-config --client cursor
agenda-intelligence mcp-config --client claude-desktop
```

---

## Implemented tools

### `validate_brief`

Validate an agenda-brief dict against `agenda-brief.schema.json`.

```json
{ "brief_json": { "bottom_line": "...", "signal_classification": "structural_shift", "what_changed": "...", "why_it_matters": "...", "main_uncertainty": "...", "watch_next": ["..."] } }
```

Returns `{ "implemented": true, "valid": true|false, "errors": [...] }`.

---

### `validate_evidence`

Validate an evidence-pack dict against `evidence-pack.schema.json`.

```json
{ "evidence_json": { "evidence": [ { "evidence_id": "e1", "source_type": "primary", ... } ] } }
```

Returns `{ "implemented": true, "valid": true|false, "errors": [...] }`.

---

### `audit_claims`

**Experimental.** Validate a claim-level evidence-audit dict against `evidence-audit.schema.json` and report:

- `support_level` distribution across claims (`direct | partial | weak | unsupported`)
- orphan `evidence_id` references (evidence_ids in claims not present in the evidence list)
- count of explicitly listed `unsupported_claims`

```json
{
  "audit_json": {
    "brief_id": "eu-ai-act-2024-08",
    "claims": [
      {
        "claim_id": "c1",
        "claim": "EU AI Act tightens obligations on high-risk systems.",
        "claim_type": "regulatory_change",
        "evidence_ids": ["e1"],
        "support_level": "direct",
        "uncertainty": "Enforcement timeline per sector unclear.",
        "risk_if_wrong": "Compliance plans miss deadline."
      }
    ],
    "evidence": [ { "evidence_id": "e1", "title": "...", "url": "..." } ],
    "unsupported_claims": []
  }
}
```

Returns:

```json
{
  "implemented": true,
  "valid": true,
  "errors": [],
  "summary": {
    "claim_count": 5,
    "evidence_count": 4,
    "support_levels": { "direct": 3, "partial": 1, "weak": 1 },
    "orphan_evidence_refs": [],
    "unsupported_claims_listed": 0
  },
  "note": "Claim-level evidence audit is experimental. Schema-level only; does not verify factual truth."
}
```

Honest scope: schema-level only. Does not verify factual truth.

---

### `get_protocol`

Return packaged protocol markdown by name.

```json
{ "name": "entrypoint" }
```

Returns `{ "implemented": true, "name": "...", "path": "...", "protocol": "<markdown text>", "error": null }`.

---

### `list_lenses`

List available regional and sector lenses from the packaged `agent-manifest.json`.

```json
{ "lens_type": "regional" }
```

Pass `null` / omit `lens_type` to list all. Returns `{ "implemented": true, "lenses": { ... }, "error": null }`.

---

### `get_lens`

Return packaged lens markdown by type and id.

```json
{ "lens_type": "sector", "lens_id": "sanctions" }
```

Returns `{ "implemented": true, "type": "...", "id": "...", "path": "...", "lens": "<markdown text>", "error": null }`.

---

### `source_plan`

Return source requirements for an agenda category.

```json
{ "category": "technology-ai" }
```

Returns `{ "implemented": true, "category": "...", "path": "...", "plan": { ... }, "error": null }`.

---

### `source_coverage`

Diagnose whether an evidence pack covers category-specific `must_check` source types.

```json
{ "evidence_json": { "topic": "...", "claims": [] }, "category": "sanctions" }
```

Returns missing required source types without discovering sources or verifying factual truth. This is a diagnostic gate, not base schema validation.

---

### `score_output`

Score a before/after output pair with the marker rubric used in evals.

```json
{ "before_text": "...", "after_text": "..." }
```

Returns `{ "implemented": true, "score": 72, "dimensions": { ... }, "error": null }`.

---

## Design rule

Small stable contracts, not a large agent framework. The markdown files remain the source of truth.
