# Full analyze trace — canonical product-shell example

Reproducible artifacts from one end-to-end `analyze` call. The case is a
real example shipped with the repository: a Kazakhstan-incorporated
payments fintech evaluating USD correspondent banking exposure to
secondary US sanctions risk.

The trace captures everything the product shell does **deterministically**
— request validation, geography routing, system-prompt assembly, schema
validation — without invoking any LLM. The LLM-completion step is the
host's responsibility and is documented separately at the end of this
file.

## Files

| File | What it is |
|---|---|
| `01-request.json` | Structured `analyze` input (matches `schemas/v1/agenda-request.schema.json`). |
| `02-routing.json` | Which reasoning modules `analyze` loaded for this question, plus the assembled system-prompt size. Derived from `route_modules` in `agenda_intelligence.product`. |
| `03-memo.json` | Memo returned by `analyze`. Because no LLM was called, this is the documented skeleton-memo path: a schema-shaped placeholder with explicit in-band disclaimers. |
| `03-memo.md` | The same memo rendered to Markdown via `render_memo_markdown`. |
| `04-validation.json` | Result of validating `03-memo.json` against `schemas/v1/agenda-memo.schema.json`. The skeleton memo intentionally fails strict validation; `memo_errors` carries the honest reason. |
| `05-audit.json` | The memo schema's own `audit` block, plus a note on why claim-level `audit-claims` does not apply to `evidence_mode=reasoning_only`. |
| `06-score.json` | Documented null result: the `score` CLI evaluates briefs against evidence packs, not analyze memos. Scoring of analyze memos against the rubric is a v0.9.x item. |
| `run.py` | Reproducibility script that regenerates the six artifact files from `01-request.json`. |

## Reproduce

From the repo root:

```bash
python3 -m venv .venv-trace
.venv-trace/bin/pip install -e . jsonschema
.venv-trace/bin/python3 examples/product-shell/full-analyze-trace/run.py
```

The script unsets `ANTHROPIC_API_KEY` before calling `analyze` to guarantee the
deterministic skeleton path. Re-running should yield the same artifact contents
except for the `meta.timestamp` field in the memo, which is generated at call
time.

## What this trace proves

- The product shell validates an `agenda-request` against schema.
- Geography routing is deterministic and inspectable: for a Kazakhstan +
  USD-correspondent question the shell loads Global Think Tank Analyst as the
  reasoning method, Central Asia + Caspian as the regional specialist, and the
  Sanctions sector module. Multiple modules can load together; the assembled
  system prompt is reproducible byte-for-byte.
- The memo schema's structural requirements are enforced by the same
  `validate_memo` function the MCP server exposes.

## What this trace does NOT do

- It does not call an LLM. No `analyze` claim about sanctions risk, decision
  framing, watch-next indicators, or audit findings is asserted by this trace.
  The skeleton memo's `analysis` and `watch_next` sections are explicit
  placeholders.
- It does not verify any factual claim about Kazakhstan, US secondary
  sanctions, or any sanctioned entity. Factual verification is out of scope
  for v0.9.
- It does not exercise `audit-claims` or `score`. Those tools operate on
  briefs and evidence packs, not on analyze memos. For runnable examples of
  those tools, see `examples/source-backed/eu-ai-act.{brief,evidence,audit}.json`
  and run:

  ```bash
  agenda-intelligence audit-claims examples/source-backed/eu-ai-act.audit.json --strict
  agenda-intelligence score examples/source-backed/eu-ai-act.brief.json --evidence examples/source-backed/eu-ai-act.evidence.json
  ```

## Completing the trace with a real LLM call

To produce a complete-completion trace (skeleton → LLM call → real memo →
schema validation → human review), set `ANTHROPIC_API_KEY` and rerun:

```bash
export ANTHROPIC_API_KEY=...
.venv-trace/bin/pip install "agenda-intelligence-md[llm]"
.venv-trace/bin/python3 examples/product-shell/full-analyze-trace/run.py
```

`run.py` will overwrite `03-memo.json`, `03-memo.md`, and `04-validation.json`
with the real-completion outputs. The other artifacts (request, routing,
audit-block extraction, score N/A documentation) remain identical. A reviewer
can then judge whether the LLM completion meets the rubric in
[`docs/rubric.md`](../../../docs/rubric.md) (added separately in v0.9).

## Why this is a "trust infrastructure" artifact

A new user can inspect six files and see exactly what Agenda Intelligence does
to a structured request before any model is invoked: which modules load, what
prompt is assembled, what shape the response must take, and what the system
will not claim on its own. That makes the product-shell layer reviewable
independently of any LLM judgment.
