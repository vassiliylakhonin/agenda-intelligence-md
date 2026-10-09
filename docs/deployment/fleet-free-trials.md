# Free first attempts across the existing fleet

`WORKER_FREE_TRIAL=1` enables a live trial on each of the twelve configured
products. It selects a fixed operation for the serving profile; callers cannot
choose a different profile, tool, batch, bankability dossier or decision action.
Agenda and Corridor Assistant return routing/triage results. The other ten
products evaluate their supplied evidence or action records. No trial authorizes
a transaction, executes an escrow payout or establishes factual truth.

## Public contract

`GET /v1/trial` returns terms, `agent_profile`, the fixed `tool`,
`evaluation_kind`, `input_schema`, an illustrative `example_request`, an optional
`request_schema` link, `paid_endpoint`, `paid_transport` and `paid_price_usdc`.
`POST /v1/trial` takes the product's bare request fields as JSON, rather than a
JSON-RPC envelope. Follow the serving example and input schema. Financial Guard
and Escrow trials take bare records; their existing paid MCP contracts may use
request wrappers. The paid button uses the matching existing REST route, or a
fixed `tools/call` envelope for Agenda, Corridor Assistant and Middle Corridor.

The existing `/v1/agent-output/trial` URL remains available on Output Verification
with its existing opt-in flag and shares the allowance with `/v1/trial`. It is
not served on other profiles. Existing Output campaign identities remain valid.

- **200:** the product's existing result plus `trial` terms and
  `attempt_consumed: true` and `completion_recorded: true`. Financial Guard omits its optional payment challenge;
  the verdict and evidence limits are unchanged. Human review remains required.
- **400/413:** invalid or oversized JSON, missing product inputs, credentials or
  caller-selected operations; no quota reservation. Maximum JSON size is 1 MiB.
- **429:** `code: trial_exhausted`, explanatory error and matching trial terms.
  The input remains in the editor. This is not an automatic payment request.
- **503:** storage unavailable or evaluator failure/refusal; no payment is made.
  An evaluator failure consumes its already reserved attempt.
  `trial_recording_unavailable` means the completed computation could not be
  recorded reliably; the reserved attempt is consumed and no successful result
  is returned. The evaluator may have run, so this is not a payment failure.

POST responses carry server-issued `X-Payment-Attempt-Id`, optional caller
correlation `X-Payment-Trace-Id`, and `Cache-Control: no-store`. Neither ID grants
entitlement. Existing configured production authorization gates still apply;
the trial refuses payment and access credentials rather than bypassing a gate.
Public unauthenticated trials are intended for deployments without such keys.

## Quotas, privacy and cost

Each Cloudflare connecting address receives two attempts **per product** for
this campaign. Shared networks share allowances; caller labels, cookies, trace
IDs and browser identities do not reset them. Network changes can change quota
identity; this is abuse control, not verified user identity.

One atomic conditional INSERT checks both the product's network quota and a
**shared 1,000-attempt UTC-day fleet ceiling**. The legacy
`output_verification_trials` table remains the single reservation store. Output
retains its `output-trial-v1:` hash namespace; other products use
`worker-trial-v1:<fixed-profile>:`. No new migration or schema reset is required
after `0003_output_verification_trials.sql`. Reservations contain server UUIDs,
hashed network keys and dates, with no request text or raw IP. Address hashes are
linkable operational metadata, not anonymization. Reservations persist across
days to enforce the campaign limit; only the service-wide ceiling resets daily.

Trial CIS evaluations disable the paid hosted OpenSanctions fallback. Existing
configured snapshot, Watchman and Vizier adapters keep their availability,
freshness and provenance boundaries. Missing/stale screening is never clearance.
Paid REST/MCP/A2A routes retain their prices and payment admission, including
0.50 USDC for Escrow and 0.05 USDC for other evaluations. The free editor never
calls checkout; the optional paid action remains explicit.

## Measurement and release

All free attempts use the existing payment-stage telemetry with reason
`free_trial`. Success emits `preview_completed/free_trial`, not
`payment_verified` or `execution_completed`. Failures have bounded reasons;
input failures retain the existing validation diagnostics. Normal usage and KV
counters record the product operation with owner/probe exclusions. Correlation
is page-local and does not establish a customer. Compare trial completion,
repeat use and later confirmed paid executions per product. Routing activity
must be interpreted as routing, not a completed specialist evidence review.

Run `make verify-local`, merge the checked PR, and deploy through the protected
existing-fleet workflow. The existing Output workflow also runs on main changes.
For every profile verify the live terms, example validation, two marked owner
200s, exhausted 429 and the unchanged paid 402/price. After the check remove only
the known owner reservation UUIDs returned in the successful response headers;
preserve all other trial and payment records. Collect the signed telemetry
archive and check free/paid separation and owner exclusions.

## Durable completion and feedback

Apply additive migration `0004_trial_completion_receipts.sql` to the existing
`agenda-fleet-payments` database before deployment. It adds a completion table
and a singleton rollout boundary; it does not modify reservations or payments.
Each completion has only its server attempt UUID, fixed profile, UTC day/time
and origin group. The insert must reference an existing reserved attempt and
must succeed before HTTP 200. Receipts remain distinct from best-effort usage,
provider payment-stage logs, purchases and customer usefulness. Owner/probe
classification is a purpose label, not an authenticated identity.

After every existing Worker deployment finishes, set
`trial_receipt_coverage.complete_from` for `id='fleet'` to the actual latest
completion timestamp. Do not set it during rollout. Until then the source is
`rollout_in_progress`. Historical dates before that boundary are
`not_instrumented` with null totals, not measured zeros. Reset the boundary to
null before a rollback to code without the receipt writer; preserve receipts.

Authenticated `GET /stats?date=YYYY-MM-DD` adds `trial_completions`:

```json
{
  "contract_version": 1,
  "status": "partial_window",
  "date": "2026-10-09",
  "total_completed": 0,
  "groups": {"excluded": 0, "external_candidate": 0, "unknown_origin": 0},
  "rows": [],
  "coverage": "instrumented_completions_only",
  "window_start": "2026-10-09T10:00:00.000Z",
  "window_end": "2026-10-09T11:00:00.000Z",
  "fleet_complete_from": "2026-10-09T10:00:00.000Z"
}
```

The timestamps above illustrate the shape, not an actual deployment. Rows are
`{agent_profile, origin_group, completed}` aggregates across the shared fleet.
Closed whole days after rollout use `complete`; current or rollout-day windows
use `partial_window`. Unavailable or unconfigured storage has null totals and
groups. The existing stats token is required before querying D1; no receipt
UUID, caller hash, request input or result appears in this surface.

Every free page includes an optional feedback email draft with the product,
bounded check status and unanswered questions about the user's task, useful
parts, confusing/missing parts, changed next step and voluntary repeat intent.
The user reviews and sends the draft. Nothing is sent automatically and inputs,
results, traces, payment details and credentials are not attached. Actual
sessions and replies still require human participation; prepared prompts do
not establish usefulness or customer adoption.

Rollback through the same protected deployment path: set `WORKER_FREE_TRIAL=0`.
For Output also set `OUTPUT_VERIFICATION_TRIAL=0` to disable its older opt-in.
Preserve the reservation table and campaign history. Shipping the entry path
establishes no customer usefulness, willingness to pay or conversion improvement.
