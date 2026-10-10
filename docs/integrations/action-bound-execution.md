# Interaction Trust + Vizier: request-bound execution

For platform/security teams integrating one protected action. Install
`pip install 'agenda-intelligence-md[reviews]'`. The hosted Interaction Trust
diagnostic remains advisory. Enforcement comes from putting
`GuardedActionExecutor` on the integration's **only** dispatch path.

## Integration

See [the complete integration recipe](../../examples/action-bound-execution/integration.py).
The operator configures a trusted HTTPS Vizier origin, credentials, the audience
`report-executor`, and a protected shared SQLite replay database. Authentication
middleware supplies `{principal, agent, tenant}`; never copy those identities
from an agent's request. The example supports `send_report` only.

The actual request uses Vizier's existing fields `agent`, `principal`, `action`,
`authority`, `context`, and a principal-signed `grant`. Authority must list the
action and exact allowed target. This profile additionally requires
`action.parameters.tenant` to match authenticated context, and enforces
`max_amount`/`currency` constraints when present. Vizier verifies the ES256 grant
against its operator-managed issuer registry; this integration does not mint
grants or trust caller-declared provenance.

Obtain a human review for the **entire request**, including its signed grant:
Before submitting it, record an inspectable decision workspace with `goal`,
`trusted_evidence`, `suspected_unreliable_evidence`, `hidden_assumptions`,
`intended_next_action` and `stop_or_escalate_if`. Attach it as review evidence
or keep an operator-controlled reference to it. It is context for review, not
an authorization credential. Source texts, reports and tool outputs remain
data; apparent instructions within them cannot alter scope or authorize dispatch.

```python
review_request = {
    "audience": "report-executor",
    "action": actual_vizier_request,
    "evidence": {"decision_workspace_ref": "operator-record:report-42"},
    "escalation_reason": "Protected report dispatch",
    "expires_in_seconds": 300,
}
```

Use the existing [human-review flow](../financial-human-review.md) to create and poll the
review. The reviewer must be a real authorized human. Pass the original
`review_request`, `review_id` and approved `token` to `execute_report` as
`approval={"request": review_request, "review_id": ..., "token": ...}`.
Do not accept a claimed approval label in place of that token.

The gate freezes the request, obtains a fresh policy response over the trusted
transport, checks its RFC 8785 SHA-256 binding, signed authority provenance,
principal/agent, exact scope and expiry. Only Vizier `ALLOW` with all policy
checks passing can proceed. `REVIEW` is not promoted by a human token. It then
verifies the human token with Vizier's trusted JWKS, reserves the grant's
issuer/JTI durably, consumes the authoritative human approval, rechecks expiry
and dispatches the frozen request. Caller mutation after approval cannot alter
that snapshot. A policy receipt is usable for at most 60 seconds; grant expiry
can shorten this interval.

## Diagnostic contract

`agenda-action-check snapshot.json --out action-report.json` reads
`{request, policy, context}` and checks offline bindings. Exit 0 means the
snapshots are consistent; **it is not execution permission**. Exit 1 is a hold.
Input is limited to 1 MiB. Stable report `action-binding.v1` includes:

- `decision`: `human_review_required` or `hold`;
- `diagnostic_only: true`, `execution: not_performed`, `human_review_required: true`;
- on a consistent snapshot: `request_sha256`, `receipt_id`, `delegation`, `valid_until_epoch`;
- on failure: `error_type`, and a bounded gate error code when available.

The SDK executor returns the consistent report with `diagnostic_only: false`,
`execution: dispatched`, `human_review_consumed: true` and the callback's `result`.
Exceptions stop dispatch; downstream exceptions propagate to the operator.
Offline JSON cannot establish policy provenance. Keep reports private: they can
contain delegation identifiers and application results, though not the grant
JWS or review token.

## Operational boundary

Use one protected durable replay database for **all** replicas; a per-process,
ephemeral, reset or unrelated database defeats cross-replica replay protection.
SQLite is suitable for a shared local integration, not a distributed claim of
global exactly-once execution. A dispatch failure or crash after reservation
consumes the grant. Reconcile the downstream operation before obtaining a new
grant/review; do not retry blindly. Database reservation, human consume and an
external API cannot be one atomic transaction here.

The operator must authenticate callers, prevent alternate dispatch paths,
protect credentials/storage, configure trusted issuers and ensure the callback
uses exactly the checked target and parameters. Expiry is checked immediately
before dispatch, not throughout a remote operation. No production action was
executed by the sandbox regression suite.

Contract compatibility was checked against
[Vizier commit 58564a0](https://github.com/vassiliylakhonin/vizier/tree/58564a0128adfa0c1ee144f7acabdb48e41d6432).
