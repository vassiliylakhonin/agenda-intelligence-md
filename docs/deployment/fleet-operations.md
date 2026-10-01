# Cloudflare fleet operations

## Deployment

Run `make verify-local`, then validate every Wrangler environment with `wrangler deploy --dry-run`. Apply `deploy/cloudflare-worker/migrations/0001_payment_ledger.sql` to the shared `agenda-fleet-payments` D1 database before release. All environments bind it as `PAYMENT_LEDGER`.

From a clean committed tree, run `npm run deploy:all` in `deploy/cloudflare-worker`. This requests a signed Vizier ALLOW receipt for every environment. The sanctioned deploy credential is `VIZIER_API_KEY` or macOS Keychain service `com.vizier.gated-deploy`, account `VIZIER_API_KEY`. Never embed or print it. Signed-grant mode also requires a separate ten-minute owner grant for each target (see [signed deployment](signed-deploy.md)). Prefer the protected `Deploy existing Worker fleet through Vizier` workflow on immutable main: its isolated signer step supplies the existing owner key without exposing it locally. Run `npm run deploy:all -- --check` after release to compare receipt stamps and bundle digests. Direct deployment would omit the required gate.

## Dependency health

`GET /health` is liveness. `GET /health/dependencies` reports snapshot availability, age, digest and whether the ledger binding exists; it is not a database connectivity test. A stale or unavailable configured snapshot returns 503. A disabled snapshot is reported explicitly; 200 does not mean screening ran. Published-index CI and runtime both use a 72-hour limit. The isolate cache refreshes at most every six hours. A fresh deployment resets its cache.

## Payment and quota

D1 transaction uniqueness is permanent. Pro tokens are stored as SHA-256 fingerprints with a 30-day expiry and a 10,000-request quota. Each paid evaluation attempt consumes quota; validation failures may consume a request. Free per-IP hourly limits use eventually consistent KV and are only an abuse deterrent. All paid paths require an available authoritative ledger. The bankability helper consumes one Pro request; MCP/A2A reuse that request's already-consumed entitlement.

An inline payment header claims one evaluation. A replay cannot unlock another evaluation. Pro activation requires the paying wallet signature. New claims require a receipt block timestamp within seven days and reject dates more than five minutes ahead. This does not establish confirmation depth or immunity to chain reorganizations.

If a ledger claim succeeds but token provisioning, KV mirroring or response delivery fails, retain the claim and reconcile manually against the receipt, tier, payer and ledger records. Do not delete a claim to retry automatically. No credential recovery endpoint is supplied. D1 claims and credential issuance are separate operations; claim exclusivity does not guarantee successful delivery of every paid result.

## Task continuation

With `TASK_SCOPE_AUTH_REQUIRED=1`, retain `task.metadata.continuation.token` privately and send it in `X-Task-Token` for `GetTask` and continuation. KV stores its hash and task status, without inputs or artifacts, for 24 hours. A matching caller label alone grants no access. Existing tasks created before this setting must be recreated. Do not put tokens in URLs, public examples or logs.

## Reading telemetry

Usage v9/classification v2 excludes `Agenda-Ecosystem-Verification/` and owner synthetic traffic from candidate demand. These tags are spoofable and never authenticate callers. Daily report coverage can be partial or outside retention; an absent event is not a confirmed zero.

Decision journal v2 includes full canonical business inputs, profile, capability, contract version, engine deployment and source snapshot. Compare changes only within one execution context. Legacy partial input hashes cannot support an instability conclusion. Candidate external calls alone do not prove customer demand, recurring use or revenue. Keep raw telemetry in the private vault; publish only reviewed aggregate conclusions.
