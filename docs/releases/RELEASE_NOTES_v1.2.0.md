# v1.2.0 — Grounding and bounded factual Claim Verdict

v1.2.0 separates two verification questions that must not share one score:
whether a claim is represented in a supplied corpus, and whether a supplied
evidence set meets an explicit factual-verification threshold as of a declared
date.

## What changed

- Added `grounded_check` and the `grounded-check` CLI command for deterministic
  lexical claim-to-corpus consistency checks.
- Added `verify_claims` and the `verify-claims` CLI command for bounded Claim
  Verdicts over caller-supplied evidence records.
- Added request and response schemas for both capabilities, MCP manifest
  entries, examples, contract tests, and ADR 0023.
- Added checks for source freshness, authority, independent source groups,
  conflicts, jurisdiction, and exact subject identifiers.
- Added `verified`, `contradicted`, `partially_supported`, `unresolved`, and
  `not_verifiable` verdicts without changing existing evidence-audit or
  grounding vocabulary.

## Boundaries

No source discovery or live retrieval. No fuzzy entity resolution. A
`verified` verdict means the supplied evidence meets the caller's declared
threshold as of the declared date. It is not absolute truth or a legal,
compliance, sanctions, financial, investment, insurance, or trading
determination. Human review remains required before any commercial action.

## Install

```text
pip install agenda-intelligence-md==1.2.0
```
