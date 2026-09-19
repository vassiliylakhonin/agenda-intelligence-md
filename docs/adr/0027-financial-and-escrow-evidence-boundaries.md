# ADR 0027: Financial and escrow evidence boundaries

Status: Accepted

## Problem

The financial and escrow Workers treated any successful response from Vizier's
`/v1/quorum/propose` as cryptographic clearance and fabricated receipt strings
when no receipt existed. That endpoint creates a pending quorum proposal, not a
clearance. Escrow also accepted any object as schema-valid, and Financial Guard
could authorize spending using caller-controlled policy and velocity values.
Python fallbacks repeated those assumptions. A wallet adapter accepted human
step-up because it blocked only explicit rejection, and the escrow relayer
mapped unknown or escalated rulings to partial settlement.

## Decision

- Neither evaluator creates quorum proposals as an evaluation side effect.
  Both return `vizier_status: attestation_unavailable` and a null clearance
  receipt. No verified status is available until an authenticated, signed,
  request-bound attestation protocol is implemented and validated.
- Financial Guard remains an evidence-review tool. Local denylist and heuristic
  violations can reject a request. Otherwise it returns the existing
  `step_up_human_required` / `not_decision_ready` values. Non-membership in a
  local denylist is not current sanctions clearance; reported spending is not
  an authoritative wallet ledger. The boolean sanctions and velocity checks
  remain false when unverified, with evidence gaps explaining the distinction.
- Python fallbacks and wallet integrations preserve this boundary. Legacy
  remote `allow` results cannot restore permission to execute.
- Escrow validates an offline, bounded JSON Schema subset. An instance mismatch
  retains the existing refund calculation. Missing artifacts, unsupported or
  invalid schemas, unresolved references and invalid timestamps require human
  review with zero proposed payouts and fees. A hash cannot replace the JSON
  instance. No caller-provided schema triggers network retrieval or evaluation
  of generated code.
- The relayer refuses escalated, unknown or non-ready rulings before preparing
  settlement calldata. Existing supported evidence and payout arithmetic remain
  available as calculations, not authorization or actual transfers.

These are safety corrections within existing request fields and response enums;
no endpoint or tool is removed. Integrations must handle review, not assume that
absence of a detected violation means permission. No v1 schema is narrowed.

## Schema support

Object schemas or JSON-encoded schemas support `type`, `required`, `properties`,
`additionalProperties`, `items`, `enum`, `const`, `allOf`, `anyOf`, `oneOf`, `not`,
`minLength`, `maxLength`, `minItems`, `maxItems`, `uniqueItems`, `minProperties`,
`maxProperties`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`.
Boolean subschemas are supported. The dialects are draft 2020-12 and draft-07
within this common subset. `title`, `description`, `$comment`, `$id`, `default`
and `examples` are annotations only; defaults do not alter evidence.

Other keywords, including `$ref`, `$defs`, `format`, `pattern` and `multipleOf`,
require human review rather than being ignored. Schema complexity is bounded.
Integers/numbers outside the interoperable ±(2^53−1) range also require review,
preventing JSON parsers from silently rounding a different commitment into a match.
The shared fixture `tests/fixtures/escrow-schema-cases.json` exercises the Worker
and Python implementations, including empty/falsey instances and schema strings.

## Runtime ownership and fleet coverage

`landing-ui.js` owns browser presentation; `telemetry.js` owns usage classification
and the decision journal; `escrow-schema.js` owns artifact schema validation.
`index.js` composes these modules without circular imports or changed public
routes. Request-specific state is not retained in the module factories.

Fleet monitoring derives deployed names from `wrangler.toml`, retains specialized
legacy proofs and supplies a baseline health probe for future profiles. Financial
Guard and Escrow additionally exercise these negative safety cases. Vizier remains
an explicitly included external dependency.
