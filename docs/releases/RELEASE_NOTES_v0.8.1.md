# v0.8.1 — Honest audit + tighter system prompt

v0.8.1 closes three rough edges in the product shell shipped in v0.8.0, found during an end-to-end agent run.

## Fixed — `audit.validation_score` is now machine-verified, not self-graded

Before v0.8.1, `analyze` returned the memo with the LLM's own `audit.validation_score` and `audit.validation_details`. A model could write `validation_score: 0.99` and the schema would accept it. From v0.8.1, the server overwrites both fields with values computed from six observable structural checks (schema valid, fact/assessment separation, unknowns acknowledged, modules match routing, watch_next present, evidence_mode within contract). The LLM's self-grade is preserved in a clearly-labeled `audit.self_assessed_score` field for transparency, and `audit.machine_verified: true` makes the rewrite explicit. `audit.provenance` is substantive content (per-claim basis labels) and is preserved as the model wrote it.

The score remains structural only — it is not a claim about whether the analysis is factually correct.

## Improved — system prompt has an explicit output-format block

The assembled `system_prompt` now ends with a dedicated `===== OUTPUT FORMAT — STRICT =====` section that:

- explicitly forbids markdown fences and surrounding prose,
- lists the required top-level keys,
- gives a compact valid skeleton the model can pattern-match against,
- tells the model that `audit.validation_score` and `validation_details` are advisory and will be overwritten by the server.

This raises the chance that weaker host models return parseable JSON on the first attempt.

## Added — schema fields for machine-verified audit

`agenda-memo.schema.json` gains two optional `audit` properties: `machine_verified` (bool) and `self_assessed_score` (number, 0–1). Documentation on `validation_score` clarifies that it is structural only and, when `machine_verified` is true, was computed by the server.

## Added — README quickstart mentions the `[llm]` extra

The Quickstart now explains how to install with `pip install "agenda-intelligence-md[llm]"` and set `ANTHROPIC_API_KEY` to let `analyze` call the Anthropic API directly. Without the extra, the tool still returns a usable `system_prompt` for the host model to complete.

## Tests

`tests/test_product_shell.py` adds `test_analyze_overrides_self_graded_audit_score`, which feeds the analyze pipeline a mocked LLM response with `validation_score: 0.99` and missing unknowns, and asserts that the server rewrites the score downward, marks `machine_verified: true`, preserves `self_assessed_score: 0.99`, flags `unknowns_acknowledged` as failed, and keeps the provenance entries intact.

## Unchanged

- 16 MCP tools, request/memo schemas, geography routing, signal vendoring — all behave as in v0.8.0.
- Live source retrieval is still not implemented.
- No new hard dependencies; the `anthropic` SDK is still gated behind the `[llm]` extra.
