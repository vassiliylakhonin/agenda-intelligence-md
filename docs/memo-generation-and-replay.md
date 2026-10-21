# Bounded memo generation and offline regression replay

The optional `analyze` generator sends an explicit memo output schema to the
Anthropic API. Install `pip install 'agenda-intelligence-md[llm]'`; the SDK floor
is 0.84. The existing host-completion mode still works without a key or SDK.
The deterministic evidence checker does not require either.

The generation schema excludes server-owned audit metadata. The SDK transforms
unsupported constraints for the provider; the original packaged schema and
local memo-quality checks still decide acceptance. A complete response must be
one whole JSON object with no duplicate keys, non-JSON numbers or surrounding
prose. Provider refusal, truncation and request failure return
`mode=generation_failed`, `memo=null`, `memo_valid=false` and a bounded diagnostic
in `errors`. They never silently become a host-completion skeleton or trigger
a fallback model. `llm_invoked` means a generation request was attempted, not
that a useful memo was delivered. Evidence support and action permission remain
separate from format validity.

## Request budgets

| Environment variable | Default | Meaning |
| --- | ---: | --- |
| `AGENDA_INTELLIGENCE_MAX_TOKENS` | 4096 | Maximum output tokens reserved for the generation call |
| `AGENDA_INTELLIGENCE_CONTEXT_TOKENS` | 200000 | Operator-selected context ceiling; configure for the selected model |
| `AGENDA_INTELLIGENCE_MAX_INPUT_BYTES` | 1048576 | Maximum serialized input, including system prompt and schema, before any API request |

All three limits must be positive integers. An oversized byte payload is rejected
locally. Otherwise the provider's token-count endpoint runs before generation;
the provider's estimated input tokens plus reserved output must fit the configured context ceiling.
The preflight sends the same input/schema to the same provider. No evidence is
silently truncated. Requests have a 60-second SDK timeout and SDK retries are
disabled. There is no automatic increase of output budget, retry or provider
switch. Token limits are not a dollar-denominated billing guarantee.

## Replay the existing synthetic corpus

Use the installed module (the manifest below is supplied by a checkout):

```sh
python -m agenda_intelligence.memo_replay capture \
  --manifest tests/fixtures/memo_quality/manifest.json \
  --run-dir .verification/memo-replay
python -m agenda_intelligence.memo_replay score \
  --run-dir .verification/memo-replay \
  --output .verification/memo-replay/summary.json
```

Capture refuses an existing run directory. It saves exact output text to
`raw.jsonl` and expectations/provenance to `meta.json`. Scoring reads them
without generation, retrieval, protected actions, payment, or receipt signing.
Re-run only `score` after changing checker code to evaluate the same outputs.
Raw outputs and metadata are never rewritten by scoring.

The fixture manifest above is reused directly. Its producer is labelled
`bundled_synthetic_fixtures`, with no model invocation. These results measure
structural regression expectations on our own examples, not factual truth,
model quality, independent reliability or customer demand.

## Capture other saved model outputs

A capture manifest is a JSON object with `provenance` and a nonempty `cases`
array. Example shape:

```json
{
  "provenance": {
    "producer": "local-experiment",
    "model": "record-the-actual-model-or-unavailable",
    "prompt_revision": "record-the-actual-revision-or-unavailable"
  },
  "cases": [
    {
      "case_id": "missing-source",
      "sample_id": 0,
      "raw_output_path": "saved-output.txt",
      "status": "completed",
      "expected_schema_valid": true,
      "expected_quality_ok": false
    }
  ]
}
```

Output paths are resolved against the manifest directory. `sample_id` must be a
nonnegative integer; booleans are rejected. Each `(case_id, sample_id)` must be
unique. Status is `completed`, `truncated`, `refused` or `error`; it defaults to
`completed`. Noncompleted cases can omit the output path when no output was
received. Record failures explicitly rather than dropping them. Capture only
reads existing files; it does not execute prompts or scripts.

`meta.json` contract version 1 records expected keys and schema/manifest/raw
SHA-256 digests, producer-supplied provenance, package version and capture scorer
source fingerprint. Summaries record the current scorer fingerprint and schema
digest separately. Digests detect accidental changes, not authenticity; the
local manifest remains the operator's declared expectations.

Coverage is complete only when raw integrity matches and the exact expected
key set occurs once, with no unexpected keys or invalid records. Missing,
duplicate and unexpected keys and malformed line numbers remain visible.
Incomplete coverage makes `expectation_match_pct` and `all_expectations_met`
null. For complete coverage, technical failures count as mismatches even if
their expected schema/quality flags are false. A complete run with all expected
rejections correctly detected can pass; that is not a model-success rate.

CLI exit codes: `0` complete and all expectations match; `1` incomplete or
mismatched results (summary written); `2` invalid configuration or I/O failure.
Artifacts contain raw output and may contain confidential material; keep them
in a private local directory. The CLI does not publish or upload them.

Design references: [DeepInfer eval](https://github.com/deepseek-ai/DeepInfer/tree/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/eval),
[recipe request contracts](https://github.com/deepseek-ai/deepseek-recipe/blob/935817c66f5d6e64838f419692545f06787e485f/deepseek-recipe/src/request/mod.rs),
[Anthropic structured output contract](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
No DeepSeek runtime or source code is bundled.
