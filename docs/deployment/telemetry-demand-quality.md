# Demand measurement and request diagnostics

This additive update preserves endpoints, required inputs, prices, payment
proof/binding rules, execution/replay behavior and JSON-RPC error codes. It
improves measurement and recovery from malformed inputs; it grants no new
payment or execution privileges. The vault companion documents aggregate rules
in `docs/demand-quality.md`.

## Worker event contract

| Source | Version | Additions |
| --- | --- | --- |
| Usage (`agenda_intelligence_a2a_usage`) | 10 | `usage_category`, `authentication_status`, classification v5. |
| Payment (`agenda_intelligence_payment`) | 4 | `request_validated`, `failure_family`, `authentication_status`, classification v5. |
| Funnel (`agenda_intelligence_a2a_funnel`) | 4 | Additive classification v5; event shape otherwise retained. |

`usage_category` is `catalog` for a nonempty normalized module list containing
only `fleet_directory` / `decision_policies_list`, `domain` for other nonempty
lists, or `unclassified` for no modules. Categories do not assert outcome or
usefulness. Raw module names and existing outcomes remain available.

`authentication_status` is `deployment_key_validated` only when a configured
production key for the serving profile matches the existing Bearer or
X-Production-Key gate. Open deployments, user agents and claimed origin headers
remain `unverified`. `origin_verification` remains unverified: a shared access
key establishes access, not independent customer identity. No key is logged.

`request_validated` is emitted after the existing paid-operation input checks
and before payment admission. Free catalog calls and heartbeats do not become
paid attempts. Free bankability previews may validate but are still previews,
not paid executions. Payment/header refusals and quota behavior are unchanged.

`failure_family` is bounded to input validation, payment admission, trial admission or execution
failure; non-failure stages carry null. Input categories also include
`invalid_json` and `body_too_large`. Malformed/over-limit paid-candidate bodies
now emit `request_received` and `payment_rejected` with one server attempt UUID.
Request bodies, outputs, wallet data, signatures and validator error text are
not added to telemetry. No customer/revenue assertion is inferred from stages.

Free-trial refusals before evaluation (`trial_exhausted`, `trial_unavailable`,
`trial_credentials_not_applicable`) use `trial_admission`; evaluator and receipt
write failures remain `execution`. Additive v4 `trial_limit_reason` is non-null
only for exhausted admission and is bounded to `network_allowance_exhausted`
or `daily_capacity_exhausted`. Reports classify old refusals from stage/reason
without changing raw events; missing historical quota detail stays unmeasured.

HTTP 429 preserves `code: trial_exhausted` and adds `trial.limit_reason` and
`trial.attempt_consumed: false`. Network allowance is two attempts per product
for the campaign, shared by a network, with no daily reset or Retry-After.
Daily capacity adds `trial.retry_after_seconds` and the matching `Retry-After`
header until the next UTC midnight. Quotas, prices and explicit paid actions
are unchanged; one transactional D1 batch identifies the reason and reserves.

## Error and correlation contract

HTTP 400 `invalid_paid_request` retains existing fields and adds bounded
`validation: {category, error_count}` and a `request_hint`:

- REST: schema path, required fields and the endpoint's illustrative example.
- MCP: the published `tools/list` inputSchema, required fields, protocol header
  and its illustrative example arguments wrapped in `tools/call`. Tools needing
  a real receipt have no fabricated example.
- A2A: the serving profile's AgentCard example and matching version headers.

Hints describe input shape; illustrative evidence must be replaced by actual
supplied evidence. Following a valid hint may yield 402. It does not bypass
payment or validate downstream usefulness. Malformed JSON keeps JSON-RPC
`-32700`; structured MCP input refusals keep `-32602`.

Responses for observed paid attempts expose both `X-Payment-Trace-Id` and
`X-Payment-Attempt-Id` through CORS. The former can be client-declared and reused
for correction/retry; the latter is server-generated for each HTTP attempt.
Neither is a customer or paid execution ID. Server `execution_id` remains tied
to the payment binding and is retained on replay.

The REST test console propagates `?owner_test=1` as the existing owner-manual
header, reuses the response trace while correcting input, and clears it after
success. This browser trace is page-local, with no cookie or persistent store.
Shared telemetry headers are sent only to the same origin. Named
`owner-feedback-synthetic/` and `Agenda-Fleet-Site-Verification/` clients are
consistently excluded as owner synthetic tests. Labels are spoofable purpose
signals and never waive payment.

## Five-session pilot protocol (prepared, not run)

Use one real workflow: review an agent's proposed reporting answer against its
actual supplied excerpts with Output Verification, before a human publishes it.
Recruitment, consent and actual sessions must be performed separately; no
messages, real payments or pilot participants are created by this code change.

1. Before starting, select five sessions over seven days and fix the task type,
   rubric and comparison method. Use distinct consenting participants or mark
   repeats explicitly; do not infer identities from fingerprints.
2. For each task, have the reviewer first assess the original answer using the
   same evidence. Record review minutes and confirmed issues before inspecting
   the service response. Counterbalance order or use a second reviewer when
   comparing assisted/unassisted review to reduce learning bias.
3. Send that exact request using the published input contract. Preserve the
   error, correction, trace and attempt sequence privately. For paid operation,
   use the existing explicit payment and recovery client; a 402 is an admission
   result, not a failed wallet purchase. Owner practice sessions use owner_test
   and are excluded from candidate adoption.
4. Have a human mark each finding as useful, false hold or unresolved, and record
   the corrected answer, review time and whether any finding changed the work.
   Keep private input/outputs outside public telemetry aggregates.
5. Revisit the same task with the participant on a later day; record voluntary
   repeat use directly. Count request shape correction, known domain outcomes
   and server-witnessed paid completion separately from human-assessed benefit.

Use this record per session; absent values stay null, not zero:

```json
{
  "session_label": null,
  "consent_recorded": null,
  "utc_date": null,
  "workflow": "report-answer-evidence-review",
  "owner_practice": null,
  "input_admitted": null,
  "domain_outcome_observed": null,
  "paid_completion_observed": null,
  "human_confirmed_useful_findings": null,
  "human_confirmed_false_holds": null,
  "review_minutes_before": null,
  "review_minutes_assisted": null,
  "finding_changed_output": null,
  "voluntary_repeat_session": null
}
```

After five sessions, inspect cases, not a statistical conversion estimate. If
input recovery fails, fix onboarding first. If admitted results do not improve
the human-reviewed task, revise the workflow/value proposition before buying
traffic. These are prospective decision rules, not measured traction.

## Verification and rollout

`make verify-local` covers existing Python/runtime contracts and Worker tests.
New fixtures cover malformed/oversized JSON, REST/MCP/A2A correction hints,
configured authentication, owner exclusion and browser correction traces. The
vault accepts payment v3/v4 together; missing old authentication and validation
measurements stay unmeasured. Deploy via the existing fleet deployment gate and
then inspect version coverage in the next archive. Production deploy and the
real-user pilot are separate from creating this tested patch.
