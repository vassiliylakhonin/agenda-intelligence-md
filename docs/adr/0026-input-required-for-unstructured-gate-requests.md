# ADR 0026 — Answer an unstructured gate request with TASK_STATE_INPUT_REQUIRED

Status: accepted
Date: 2026-08-29

## Context

The eight structured gates in the Worker fleet reject a request in two
different situations, and until now both produced the same A2A task state:

1. The caller sent no structured request at all — a plain-language question, an
   empty message, a short liveness ping, or a JSON object of some unrelated
   shape. The gate has nothing to validate.
2. The caller sent a structured request that does not validate — an unknown
   enum value, a missing required field. The gate has something, and it is
   wrong.

Both returned `TASK_STATE_FAILED`. ADR-adjacent work on 2026-08-18 already
improved what the refusal *says*: `GATE_REQUEST_GUIDES` gives every gate a
required-field list, a worked example, and a route to a human. The status it
says it in was left alone.

Measured 2026-08-29 against Workers Logs for the preceding 72 hours, that is
the more consequential half. The Agenstry listing probe
(`AgenstryBot/0.3.0 (+https://agenstry.com/bot)`) calls all ten hosted agents
on a rolling schedule with the same four-character text message. The three
free-text profiles — `agenda`, `kazakhstan`, `corridor_sanctions_assistant` —
answer `TASK_STATE_COMPLETED`. The seven structured gates answer
`TASK_STATE_FAILED`, the same seven every time, 14 of 38 probe calls in the
window. Nothing was failing: each gate was describing its input contract
through a status that means the opposite, on the one external channel that
shows this fleet to strangers who did not build it.

The same conflation degraded `/stats`. `invalid_request` counted 271 calls on
2026-08-27, of which 211 were a single local test script and 14 were the
marketplace probe asking, in effect, what the gate needs. A metric that mixes
"the caller sent a broken request" with "the caller sent no request" cannot
answer either question.

## Decision

Split the two cases at the status line, keeping the existing artifact and
metadata identical.

- A caller who sent **no structured request** receives
  `TASK_STATE_INPUT_REQUIRED`, carrying the same `GATE_REQUEST_GUIDES` artifact:
  required fields, a worked example, the canonical endpoint, the schema path,
  the front door, and the support contact. The new `requestGuidanceResult()`
  wraps `invalidRequestResult()` and overrides only the state.
- A caller who sent a **structured request that does not validate** continues to
  receive `TASK_STATE_FAILED` with the field errors. That request did fail.

`callOutcome()` maps the new state to a distinct outcome, `input_required`,
which `/stats` reports alongside `invalid_request` rather than merged into it.
Both still count toward `empty_handed`: the gate could not act either way, and
that ratio is the one the operator reads.

`TASK_STATE_INPUT_REQUIRED` is the A2A state for an agent that needs input the
client has not supplied. It is the accurate name for what these eight call
sites do.

## Consequences

A consumer that branches only on `COMPLETED` versus `FAILED` sees a state it
does not enumerate. For the probe traffic this ADR is about, that is the
intended improvement — not-failed is the truthful answer. A consumer that
treats any non-`COMPLETED` state as an error is no worse off than before.

The eight affected call sites are the `Missing structured …` paths in
`agentic_interaction_trust`, `agent_output_verification` (pre-action check and
verification), `gulf_maritime_exposure`, `kazakhstan_market_entry_readiness`,
`critical_minerals_due_diligence`, `dual_use_technology_export`, and
`cis_secondary_sanctions`. The thirteen validation-error call sites are
unchanged.

The Python A2A adapter in `src/agenda_intelligence/a2a_adapter.py` is **not**
changed. It is the local compatibility shell, it never carried
`GATE_REQUEST_GUIDES`, and its rejection path does not distinguish the two
cases — it tests a single `valid` flag. Splitting it there would mean porting
the guide mechanism first, which is a separate change and is not what the
marketplace sees.

No schema under `schemas/v1/` changes, no MCP tool is removed, and no HTTP
endpoint or A2A profile is renamed. The v1.0.x contract freeze (ADR 0003) is
not touched.

## Verification

`deploy/cloudflare-worker/test/worker.test.js` covers both branches: the seven
`asks for input on …` tests assert `TASK_STATE_INPUT_REQUIRED` on an
unstructured request, and the `rejects a bad … enum` tests assert
`TASK_STATE_FAILED` on a structured one. `npm test` in the Worker package runs
276 tests.
