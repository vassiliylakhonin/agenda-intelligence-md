# Free first Output Verification evaluation

The opt-in `OUTPUT_VERIFICATION_TRIAL=1` setting enables a separate REST trial
on the Output Verification deployment only. Paid REST/MCP/A2A paths retain
their admission rules and prices. Other profiles do not serve the trial.

`GET /v1/agent-output/trial` returns terms, a request-schema link and an
illustrative request. `POST /v1/agent-output/trial` accepts the same structured
claims, evidence and source excerpts as `/v1/agent-output/verification`, using
the exact same extractor, validator, evaluator and upstream provenance.
The trial performs a live evaluation of submitted redacted evidence. The
separate worked example remains a precomputed synthetic fixture.

## Response contract

- **200:** the normal verification response plus `trial`: terms,
  `attempt_consumed: true` and an explicit free-evaluation notice. Human review
  remains required. A result is not factual verification or permission to act.
- **400/413:** malformed, oversized or invalid input; no quota reservation.
  Payment or authorization headers and inline payment credentials are refused.
- **429:** `code: trial_exhausted`, explanatory `error`, and trial terms with the
  optional paid endpoint and price. This is a refusal, not a payment challenge.
- **503:** `trial_unavailable` for missing address/storage, or
  `trial_evaluation_failed` after a reserved evaluation fails. An evaluation
  failure consumes its reservation and never automatically requests payment.

Every POST response carries the existing UUID-only payment trace and attempt
headers. Responses are not cached. The existing 1 MiB JSON body limit applies.

## Limits and data

Two attempts are reserved per hashed Cloudflare connecting address for this
trial campaign. Changing User-Agent, client labels, cookies or trace IDs does
not reset the allowance. Shared networks share the allowance; changing network
can change the quota identity. This is abuse control, not identity verification.
There is also a 1,000-attempt global UTC-day limit. One conditional D1 INSERT
checks both counts and reserves the attempt atomically. Missing or failed
storage never grants a free execution. Input validation precedes reservation.

The additive D1 table contains server-generated attempt UUIDs as reservation IDs, a SHA-256 network key
(using CALLER_HASH_SALT when configured), day and timestamp. It contains no
request text, source excerpts, wallet or raw IP. Unsalted or guessable address
hashes are not anonymization; this is private operational metadata. Reservations
persist to enforce the campaign allowance. Existing request telemetry and the
published privacy boundaries still apply. No new browser cookie or persistent
client identifier is introduced.

The free form never invokes checkout. An explicit separate paid action keeps
the existing payment confirmation and exact-request recovery. A page-local
trace links trial and optional paid attempts; it is neither a verified user
nor evidence of purchase.

## Measurement and experiment

Existing `request_received` and `request_validated` events use reason
`free_trial`. Successful free evaluations emit `preview_completed/free_trial`;
failures use bounded `preview_failed` reasons. They never emit payment_verified,
execution_completed, or a server paid execution ID. Normal usage and KV counters
record the completed domain check, with owner/probe exclusions preserved.
Vault already retains these existing preview stages and payment trace fields.

Review trial completion, within-window repeated domain fingerprints and
subsequent confirmed paid executions separately. Missing delivery, customer
identity and human usefulness remain unknown. The free-first cohort can test a
paid-entry barrier, but does not isolate price from wallet friction. No
conversion or usefulness improvement is established by shipping the trial.

## Release and rollback

Apply the additive migration to the existing payment database before enabling
the Worker setting; do not reset or modify existing payment records:

```sh
npx --yes wrangler@4.122.0 d1 execute agenda-fleet-payments \
  --env agent-output-verification --remote \
  --file migrations/0003_output_verification_trials.sql
```

Deploy the tested main commit through the existing protected Vizier gate.
Verify the live terms, two marked owner trial calls, exhausted third call,
unchanged paid 402, and free-versus-paid telemetry. Remove
only the two known owner reservation IDs from the trial table after this release
check, using the server-issued `x-payment-attempt-id` response headers, to restore
the owner's network allowance. Do not reset other trial reservations or payment
records. This operator cleanup is not a public quota-reset endpoint. Remove
`OUTPUT_VERIFICATION_TRIAL` or set it to `0` through the same deployment path
to disable the trial; preserve the table and existing paid records.

```sh
node --test test/output-trial.test.js
make verify-local
```
