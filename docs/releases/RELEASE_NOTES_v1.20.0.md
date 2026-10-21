# Agenda Intelligence MD 1.20.0

Optional memo generation now sends an explicit output schema and retains the
original local schema and evidence-readiness checks. Provider refusal,
truncation, ambiguous JSON and budget overflow remain explicit failed outcomes.
The optional Anthropic SDK floor is 0.84; the core checker still needs no model
key or SDK. Input byte limits, token-count preflight, reserved output and disabled
SDK retries bound generation without silently truncating evidence.

Saved memo outputs can be captured once and rescored with the installed module:

```sh
python -m agenda_intelligence.memo_replay --help
```

The private raw/meta artifacts retain source fingerprints, schema hashes and
declared provenance. Exact case/sample coverage is required for aggregate
scores: missing, duplicate, unexpected, invalid or altered records cannot appear
as a complete result. Technical failures count as mismatches. The checkout
wrapper remains available. CI and post-release smoke install the actual wheel,
replay the 13 existing synthetic cases, and verify incomplete-coverage refusal.

This release also includes content-free preflight outcome observations, stricter
operational card signature monitoring, and source-only audit preparation already
merged since 1.19.0. Versioned package metadata, current install documentation,
SDK pins and saved synthetic Worker examples are synchronized.

Validation is offline and synthetic. A live model API call was explicitly
omitted at the maintainer's request; provider schema acceptance and live output
quality have not been established. Structural checks do not prove factual
accuracy, action authorization, customer usefulness or independent reliability.
There are no real payment or new external adoption claims. No DeepSeek runtime
or source code is bundled. Existing v1 schemas, prices, quotas and authorization
rules are preserved.
