# ADR 0025 — Add a signed readiness receipt to the existing pre-action gate

Status: accepted
Date: 2026-08-24

## Context

The repository already ships the reusable decision primitive that the Worker
fleet needs: `pre_action_check` binds caller-supplied claims and evidence to a
specific actor, target, requested action, risk tier, policy-check set, and
external approval reference. It deterministically returns `continue`,
`request_evidence`, `require_approval`, or `stop`.

That result is not yet portable across a machine workflow. `decision_id` is a
correlation identifier only; the response explicitly says it is unsigned. A
downstream executor therefore cannot distinguish the response it received from
one that was changed after the call, cannot prove that it belongs to the exact
request being executed, and cannot reject a stale response.

This is an additive hardening of an existing decision primitive, not a new
control-plane service or vertical Worker. The implementation therefore stays
stateless and exposes one bounded policy rather than creating a policy platform.

## Decision

Extend the hosted MCP surface of the existing `agent_output_verification`
profile with three additive tools:

- `decision_policies_list` publishes the available policy and hash-binding
  contract as machine-readable data. The first and only policy is
  `pre-action-check.v1`.
- `decision_check` runs the existing `pre_action_check` logic and attaches a
  five-minute ES256 compact-JWS readiness receipt.
- `decision_verify` verifies the JWS, expiry, decision, and caller-supplied
  request/action hashes. It returns `gate_passed: true` only for a valid,
  unexpired `continue` receipt bound to both expected hashes and the current
  Worker origin. An enforcing caller must compute the expected hashes from its
  own request copy rather than blindly echoing the values returned by
  `decision_check`.

The signed payload contains no claim or evidence text. It carries only the
receipt and decision identifiers, policy version, decision and reason code,
issuer, issued/expiry timestamps, and SHA-256 hashes of:

1. the complete canonical pre-action request; and
2. the action identity (`actor`, `requested_action`, `target`, and `risk_tier`).

The receipt uses the profile's existing P-256 Agent Card signing key and public
JWKS. A distinct protected-header type (`agenda-readiness-receipt+jws`) provides
cryptographic domain separation from Agent Card signatures. Reusing the key is
accepted for this initial bounded scope: the receipt expires after five minutes,
no new secret has to be provisioned, and repeated external use is the trigger
for a dedicated receipt-signing key and rotation plan.

`pre_action_check` remains unchanged and unsigned for compatibility. The new
`decision_check` tool is deliberately non-idempotent because receipt identifiers
and timestamps change on every call. All tools remain read-only and
non-destructive.

## Boundaries

- A valid receipt proves what this Worker signed; it does not authenticate the
  actor, establish delegated authority, validate external approval, verify
  factual truth, or legally authorize the action.
- `gate_passed` means only that the configured readiness policy returned
  `continue` for the exact hashed request and that the receipt is valid and
  current. The consuming system remains responsible for enforcement and the
  action itself.
- No Durable Object, D1, KV receipt store, revocation list, payment rail,
  dashboard, new Worker, new vertical policy, or external action adapter is
  added.
- Because the Gate is stateless, an exactly bound receipt can be presented more
  than once during its five-minute lifetime. Callers that require one-time use
  must enforce replay prevention in their own execution boundary.
- A receipt whose signature cannot be produced or verified fails closed for the
  signed Gate path. The older unsigned tool remains available as a readiness
  diagnostic.

## Consequences and expansion criterion

- One Worker endpoint now exposes one stable machine path from supplied evidence
  to a verifiable readiness result without changing any existing tool or A2A
  response.
- A downstream executor can require `gate_passed: true` before acting, while the
  product continues to state that this is not authorization or factual
  verification.
- The receipt is intentionally stateless. Short expiry avoids storage and makes
  signing-key rotation invalidate only a bounded window.
- Do not add another policy pack, storage, a dedicated key, or an execution
  integration until at least one external workflow completes `decision_check →
  decision_verify` for a real action and repeats the behavior. No repeat means
  keep this as portfolio proof rather than expanding it.
