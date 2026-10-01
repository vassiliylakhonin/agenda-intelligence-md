# ADR 0031: Shared settlement ledger and task capabilities

Date: 2026-10-01. Accepted.

## Decision

The Cloudflare deployment layer uses one shared D1 `PAYMENT_LEDGER` for permanent transaction claims and hashed Pro credentials. SQL uniqueness arbitrates settlement claims; a conditional UPDATE consumes each Pro request atomically. KV remains a telemetry, soft free-rate and status-only task store. Financial entitlement failures deny paid access. Payment evaluation does not execute wallet transfers.

Configured production authorization follows the deployment profile across REST aliases, MCP and A2A. Request bodies are bounded while streaming.

A2A tasks in deployed capability mode issue an unpredictable 256-bit continuation token, require `X-Task-Token` on continuation and retrieval, and store only its hash. Caller-chosen `X-Client-Id` is a telemetry label. This intentionally tightens continuation behavior; recreate existing tasks after deployment. Public request schemas, endpoint names and profile identities are preserved.

## Consequences

All fleet environments must bind the same ledger. Apply migrations before gate-deploying. Claims have no expiration. The existing funding-wallet signature is still required for Pro issuance. New receipt claims must be within seven days. A claim followed by credential provisioning or response failure requires operator reconciliation: these steps are not one database transaction, and replay denial must never be bypassed automatically. No real payment is needed for regression tests.

Journal v2 preserves full input distinctions and compares only one execution context. User agents and client labels cannot establish customer identity. Snapshot dependency health is separate from HTTP liveness and domain readiness.
