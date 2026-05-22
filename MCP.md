# MCP

`agenda-intelligence-mcp` is a real stdio MCP server shipping with the package.
It exposes 16 tool functions implemented in `agenda_intelligence.mcp_server`.

The tools split into two layers:

- **Validation layer** (11 tools, this repo's original scope): schema checks,
  evidence audit, lens and source-plan access, output scoring, quote verification.
- **Product layer** (5 tools, Agenda Intelligence product shell): `analyze`,
  `validate_memo`, `list_signals`, `get_signal`, `deep_dive` (reserved/planned, returns a v2 placeholder). These wrap the
  validation layer with geography routing, system-prompt assembly, optional LLM
  invocation, and vendored signal access.

**Verification status**: wire-protocol verified — `scripts/smoke_mcp.py` exercises the full JSON-RPC cycle (initialize → tools/list → tools/call) against the running stdio server, including `list_source_categories` and `audit_claims`.

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

Validate a claim-level evidence-audit dict against `evidence-audit.schema.json` and report:

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
  "note": "Claim-level evidence audit is schema-level only; does not verify factual truth."
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

### `list_source_categories`

List packaged source requirement categories and per-pack counts.

```json
{}
```

Returns `{ "implemented": true, "category_ids": [...], "categories": [...], "count": 12, "error": null }`.

This is category discovery only. It does not discover sources, validate coverage, or verify factual truth.

---

### `source_coverage`

Diagnose whether an evidence pack covers category-specific `must_check` source types.

```json
{ "evidence_json": { "topic": "...", "claims": [] }, "category": "sanctions" }
```

If `category` is omitted, the tool uses `evidence_json.source_category`.

Returns covered and missing required source types plus `required_source_details`, which identifies the source entries and matched terms used for coverage. It does not discover sources or verify factual truth. This is a diagnostic gate, not base schema validation.

---

### `verify_quotes`

Check whether quoted fragments appear in caller-provided source text.

```json
{
  "evidence_json": {
    "evidence": [
      {
        "evidence_id": "e1",
        "quote": "quoted fragment",
        "url": "https://example.com/source"
      }
    ]
  },
  "texts": {
    "https://example.com/source": "source text containing the quoted fragment"
  }
}
```

The MCP tool does not fetch URLs. It only checks quote presence against text supplied by the caller, and it does not verify factual truth.

---

### `score_output`

Score a before/after output pair with the marker rubric used in evals.

```json
{ "before_text": "...", "after_text": "..." }
```

Returns `{ "implemented": true, "score": 72, "dimensions": { ... }, "error": null }`.

---

---

## Product layer tools

The five tools below form the Agenda Intelligence product shell. They share the
request/response contract defined by `schemas/agenda-request.schema.json` and
`schemas/agenda-memo.schema.json`.

### `analyze`

Run the full product pipeline. Validates the request, routes geography to in-repo
regional / sector references (Central Asia + Caspian, Gulf + Middle East,
sanctions), assembles a system prompt from the bundled SKILL.md and reference
files, and — when `ANTHROPIC_API_KEY` is set and the optional `anthropic` SDK is
installed — calls the Anthropic API and validates the returned memo against
`agenda-memo.schema.json`.

```json
{
  "request": {
    "question": "How exposed is a Kazakhstan-incorporated payments fintech to secondary US sanctions risk over the next 12 months?",
    "decision_context": "Whether to open a USD correspondent banking relationship in Almaty in Q3.",
    "audience": "founder",
    "geography": "Kazakhstan",
    "time_horizon": "12 months",
    "evidence_mode": "reasoning_only",
    "depth": "decision_pack"
  }
}
```

Returns:

```json
{
  "implemented": true,
  "valid_request": true,
  "errors": [],
  "modules_used": [
    { "module": "global-think-tank-analyst", "role": "reasoning_method" },
    { "module": "central-asia-caspian", "role": "regional_specialist" }
  ],
  "system_prompt": "...",
  "llm_invoked": true,
  "memo": { "meta": { ... }, "risk_summary": { ... }, "analysis": { ... }, ... },
  "memo_valid": true,
  "memo_errors": []
}
```

Without an API key, `llm_invoked` is `false` and `memo` is a clearly-marked
skeleton (`validation_score: 0`) so a host model (e.g. Claude Desktop) can
complete the analysis from the returned `system_prompt`.

Install the optional dependency for direct API calls:

```bash
pip install "agenda-intelligence-md[llm]"
export ANTHROPIC_API_KEY=...
```

Honest scope: no live source retrieval. Evidence comes from caller-supplied
material or model reasoning, as declared by `evidence_mode`.

---

### `validate_memo`

Validate a memo dict against `agenda-memo.schema.json`. Useful for checking the
output of an external analyst or another model before accepting it.

```json
{ "memo_json": { "meta": { ... }, "risk_summary": { ... }, "analysis": { ... }, "watch_next": [...], "audit": { ... } } }
```

Returns `{ "implemented": true, "valid": true|false, "errors": [...] }`.

---

### `list_signals`

Return the vendored Global Think Tank Analyst signal index. Read-only mirror of
the packaged `data/signals/index.json` snapshot.

```json
{}
```

Returns `{ "implemented": true, "index": { ... } }`.

---

### `get_signal`

Return a vendored signal markdown file by id (filename without extension).

```json
{ "signal_id": "2026-05-09-hormuz" }
```

Returns `{ "implemented": true, "id": "...", "content": "<markdown text>" }`.

---

### `deep_dive`

Reserved for Agenda Intelligence v2. Returns a planned-status message. For
detailed analysis today, call `analyze` with `depth: scenario` or `red_team`.

```json
{ "aspect": "sanctions-clearing-risk" }
```

Returns:

```json
{
  "implemented": false,
  "status": "planned",
  "message": "deep_dive will be available in Agenda Intelligence v2. Use analyze with depth: scenario or red_team for detailed analysis."
}
```

---

## Design rule

Small stable contracts, not a large agent framework. The markdown files remain the source of truth.
