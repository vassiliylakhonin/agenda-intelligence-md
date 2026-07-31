# MCP

`agenda-intelligence-mcp` is a real stdio MCP server shipping with the package.
It exposes 27 tool functions implemented in `agenda_intelligence.mcp_server`.

The tools split into four layers:

- **Validation layer** (15 tools, this repo's original scope): schema checks,
  schema discovery (`get_schema`), evidence audit, lens and source-plan access,
  output scoring, quote verification, grounding and claim-verdict checks.
- **Authoring layer** (2 tools): `create_brief`, `append_evidence` — assemble a
  protocol-compliant brief or evidence pack step by step instead of hand-building
  JSON, and validate the result on every call. They return the document to the
  caller: no filesystem writes, no retrieval, no drafting of prose, no
  factual-truth verification. See [Authoring tools](#authoring-tools).
- **Product layer** (6 tools, Agenda Intelligence product shell): `analyze`,
  `validate_memo`, `check_memo_quality`, `list_signals`, `get_signal`,
  `deep_dive` (reserved/planned, returns a v2 placeholder). These wrap the
  validation layer with geography routing, system-prompt assembly, optional LLM
  invocation, and vendored signal access.
- **Vertical worker layer** (6 local stdio tools): `middle_corridor_deal_risk`,
  `cis_secondary_sanctions_exposure`, `agentic_interaction_trust`,
  `gulf_maritime_exposure`, `kazakhstan_market_entry_readiness`,
  `agent_output_verification` — the productized
  service functions (also exposed over HTTP and A2A) as MCP tools. Each takes a
  structured request matching its `schemas/v1/` contract and returns a triage
  recommendation, decision-readiness score, evidence gaps, and a mandatory
  human-review flag. Pre-compliance evidence triage only: no live retrieval in the
  local stdio transport, no factual-truth verification, no advice.

Every vertical worker with a live A2A endpoint is reachable over local stdio MCP;
`tests/test_mcp_tool_callability.py` fails if a deployed worker has no MCP tool.

Each of those tools declares its request shape inline — field names, types, enum
values, the required list, and the schema's own worked example — so a caller can
build a first payload from the tool listing alone. `get_schema` returns the full
nested contract when the inline shape is not enough.

**Verification status**: wire-protocol verified — `scripts/smoke_mcp.py` exercises the full JSON-RPC cycle (initialize → tools/list → tools/call) against the running stdio server, including `check_evidence_packet`, `list_source_categories`, and `audit_claims`.

Live source retrieval is **not implemented in the local stdio MCP transport**.

---

## Protocol revision

The server declares **2026-07-28**, the stateless core. In practice that means:

- No session and no handshake. Each request states its own protocol version in
  `_meta["io.modelcontextprotocol/protocolVersion"]`; each result names the
  server in `_meta["io.modelcontextprotocol/serverInfo"]`.
- `server/discover` returns the supported revisions, capabilities, and identity.
  A client may call it first instead of `initialize`.
- Every result carries `resultType: "complete"`. This server never returns the
  `"input_required"` interim result — no tool here has to stop and ask the human
  mid-call.
- `tools/list` returns `ttlMs` and `cacheScope: "public"` in a fixed tool order,
  so a client can cache the listing for an hour instead of re-listing per turn.

Earlier revisions are still served: `2025-11-25`, `2025-06-18`, and `2025-03-26`,
with `initialize`, `notifications/initialized`, and `ping` answered for clients
that still send them. A version stated in `_meta` and outside that set is rejected
with `-32022`. Roots, Sampling, and Logging were deprecated in this revision and
were never used here.

Design rationale and what was deliberately not adopted (MCP Apps, the Tasks
extension) are in
[ADR 0024](docs/adr/0024-mcp-2026-07-28-stateless-core.md).

### Hosted endpoint

The deployed Cloudflare workers also speak MCP over Streamable HTTP at
`POST /mcp` — possible only because 2026-07-28 removed per-client session state.

One deployment serves one profile and exposes exactly one tool: that profile's
triage contract, named identically to its stdio twin. For example:

```bash
curl -sX POST https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

`tools/call` runs through the same dispatch as the A2A `message/send` route and
inherits its access gate, rate limit, and usage logging. `server/discover` and
`tools/list` stay open. The full local catalog below is stdio only.

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

Returns `{ "implemented": true, "valid": true|false, "errors": [...] }`. When
invalid, `errors` lists **all** schema violations (not just the first), so an
agent can fix the payload in a single pass.

---

### `validate_evidence`

Validate an evidence-pack dict against `evidence-pack.schema.json`.

```json
{ "evidence_json": { "evidence": [ { "evidence_id": "e1", "source_type": "primary", ... } ] } }
```

Returns `{ "implemented": true, "valid": true|false, "errors": [...] }`.

---

### `check_evidence_packet`

Run the primary deterministic evidence-packet preflight from an MCP agent loop:

```json
{
  "packet_json": {
    "claims": [{"claim_id": "c1", "text": "...", "source_ids": ["s1"]}],
    "sources": [{"source_id": "s1", "text": "..."}]
  }
}
```

Returns claim-level and overall `packet_complete`, `source_review_required`, or
`packet_incomplete` status, plus broken references, quote checks,
lexical-support gaps, unmatched numbers, and owner actions. It uses only text
supplied in the call: no retrieval, source-authority scoring, factuality
determination, or action authorization. Human review remains required.

Focused runnable example:
[`examples/evidence-packet/mcp_client.py`](examples/evidence-packet/mcp_client.py).
It starts the stdio server, sends the canonical synthetic packet, and prints
the packet status, factuality boundary, review requirement, and status counts.

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

### `get_schema`

Return a packaged JSON Schema so an agent can construct a valid payload *before*
calling `validate_brief`, `validate_evidence`, `validate_memo`, `analyze`, or a
vertical worker — closing the discover → construct → validate loop without
leaving the MCP surface.

`name` accepts the schema key (`agenda_brief`), the file name
(`agenda-brief.schema.json`), or the bare stem (`agenda-brief`). Omit `name` to
list the available schemas.

```json
{ "name": "agenda_brief" }
```

Returns `{ "implemented": true, "name": "...", "path": "...", "schema_version": "v1", "schema": { ... } }`,
or, when `name` is omitted, `{ "available": [{ "name", "path", "schema_version" }], "count": N }`.

The registry is read from `agent-manifest.json` (ADR 0013: the manifest is the
authoritative schema registry), so the set never drifts from the packaged
`schemas/v1/` files. Contract discovery only: it does not validate data, fill in
a template, or verify factual truth.

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

### `grounded_check`

Check whether a caller-supplied corpus of source texts lexically supports each claim.

```json
{
  "request_json": {
    "topic": "example",
    "claims": [
      {
        "claim_id": "c1",
        "claim_text": "Freight volumes on the corridor grew 62 percent in 2024.",
        "quotes": [{ "corpus_id": "doc1", "quote": "grew 62 percent in 2024" }]
      }
    ],
    "corpus": [
      { "corpus_id": "doc1", "title": "Annual report", "text": "..." }
    ]
  }
}
```

Returns per-claim `grounding_status` (`grounded` / `weakly_grounded` / `ungrounded`), term coverage against the best-matching corpus document, a best-matching passage excerpt, numeric values not found anywhere in the corpus, verbatim quote checks, and owner actions, plus an overall `grounding_signal`.

Deterministic and local-text only: term overlap plus verbatim quote presence. It does not fetch sources, score source reliability, or verify factual truth — grounding in a wrong corpus does not make a claim true, and paraphrased support can be under-detected. `human_review_required` is always `true`. Request contract: `schemas/v1/grounded-check-request.schema.json`; response contract: `schemas/v1/grounded-check-response.schema.json`.

---

### `score_output`

Score a before/after output pair with the marker rubric used in evals.

```json
{ "before_text": "...", "after_text": "..." }
```

Returns `{ "implemented": true, "score": 72, "dimensions": { ... }, "error": null }`.

---

## Authoring tools

These two tools let an agent produce protocol documents inside the contract
rather than validating one it already assembled by hand. Both are deterministic
and stateless: they take what the caller supplies, return the resulting
document, and never touch the filesystem, the network, or a live source.

### `create_brief`

Assemble an agenda brief from supplied fields and report what is still missing.

```json
{
  "bottom_line": "...",
  "signal_classification": "compliance_relevant_development",
  "what_changed": "...",
  "main_uncertainty": "...",
  "watch_next": ["..."]
}
```

Call it with no arguments to get an empty scaffold plus the required-field list,
then call again as fields are filled in. `evidence_mode` defaults to
`reasoning_only` — the honest default for a runtime with no live retrieval;
callers that actually supplied sources must set it explicitly.

Returns `{ "implemented": true, "valid": true, "complete": true,
"missing_required": [], "ignored_fields": [], "brief": { ... }, "errors": [] }`.

Unknown keys are reported in `ignored_fields` rather than silently dropped.

### `append_evidence`

Append a claim and its sources to an evidence pack, then re-validate the pack.

```json
{
  "topic": "EU implementing act timing",
  "claim": "The effective date moved to 2026-09-01.",
  "sources": [
    {
      "name": "Official journal notice",
      "url": "https://example.org/journal/2026-114",
      "source_type": "official",
      "freshness": "current",
      "supports": ["The effective date is 2026-09-01."],
      "limits": ["Does not address transition relief."]
    }
  ],
  "support_status": "supported"
}
```

Omit `pack_json` to create a new pack (`topic` is then required); pass the pack
back on each subsequent call to extend it. A claim whose text already exists
gains the new sources — de-duplicated on `(name, url)` — instead of being
duplicated, and `unsupported_claims` is kept consistent with the per-claim
`support_status` on every call. Free-text entries in `unsupported_claims` that
have no claim record of their own are preserved.

`support_status` is never inferred as `supported`. When omitted it defaults to
`unsupported` (no sources supplied) or `partially_supported` (sources supplied);
upgrading a claim is an analyst judgement and must be passed explicitly. When
extending an existing claim without an explicit `support_status`, the stored
status is left unchanged.

Returns `{ "implemented": true, "valid": true, "action": "claim_added",
"created_pack": true, "appended_sources": 1, "claim_count": 1,
"unsupported_claim_count": 0, "pack": { ... }, "errors": [] }`.

The caller's `pack_json` is never mutated in place.

---

## Product layer tools

The five tools below form the Agenda Intelligence product shell. They share the
request/response contract defined by `schemas/v1/agenda-request.schema.json` and
`schemas/v1/agenda-memo.schema.json`.

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
  "memo_errors": [],
  "memo_quality_ok": true,
  "memo_quality_errors": [],
  "memo_quality_passed": [
    "evidence_mode_discipline",
    "no_approval_or_clearance_overreach",
    "gaps_visible_when_unknowns_exist",
    "owner_actions_are_actionable",
    "watch_next_is_observable",
    "unknowns_connected_to_actions"
  ]
}
```

Without an API key, `llm_invoked` is `false` and `memo` is a clearly-marked
skeleton (`validation_score: 0`) so a host model (e.g. Claude Desktop) can
complete the analysis from the returned `system_prompt`.

`memo_valid` is schema validity. `memo_quality_ok` is a separate post-hoc
evidence-readiness quality guard. A memo can be schema-valid but quality-failed
if it uses approval/clearance language, hides missing evidence, gives generic
monitoring instead of owner actions, or fails evidence-mode discipline.

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

### `check_memo_quality`

Check a memo dict against schema validity plus post-hoc evidence-readiness
quality guardrails. Use this after `validate_memo` when a schema-valid memo
still needs a decision-readiness quality check.

```json
{ "memo_json": { "meta": { ... }, "risk_summary": { ... }, "analysis": { ... }, "watch_next": [...], "audit": { ... } } }
```

Returns `{ "implemented": true, "schema_valid": true|false, "schema_errors": [...], "ok": true|false, "errors": [...], "passed": [...] }`.

This guard catches schema-valid but unsafe output such as approval/clearance
overreach, hidden evidence gaps, generic monitoring, weak owner actions, and
evidence-mode discipline failures. It does not verify factual truth.

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
