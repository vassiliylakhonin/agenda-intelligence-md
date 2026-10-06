# Signed production deployment

The protected `agent-output-verification-production` GitHub Environment stores
`VIZIER_DELEGATION_SIGNING_KEY` (an ES256 private JWK). The owner public key is
registered in Vizier's `VIZIER_PRINCIPAL_KEYS`; Vizier never receives the private key.
Production Vizier uses `VIZIER_SIGNED_GRANT_MODE=required`.

After a clean immutable main checkout and successful tests, a separate signer
step issues a ten-minute grant for `vassiliy-lakhonin` to
`agent-output-verification-deployer`. Its only action is `deploy_worker`, and
its only target is `worker:agent-output-verification-a2a`. The deployment step
receives the grant file, Vizier API credential, and Cloudflare credentials.
The private signing key is supplied only to the signer step.

The gate requires a grant and verifies the response hash, decision and receipt.
An ALLOW must attest `principal_signed`, the expected issuer and subject, and
an unexpired grant. Missing, expired or mismatched grants stop deployment.
REVIEW/BLOCK, timeouts and malformed receipts also stop it. The token file is
removed on success or failure and is never uploaded as an artifact or logged.

The owner backup is in macOS Keychain, service `com.vizier.delegation-principal`,
account `vassiliy-lakhonin:agenda-deploy-2026-09-30`. Rotate by adding a new public key to the registry,
updating the Environment secret, validating a deployment, and retiring the old
public key. Preserve other principals when updating the registry.

This protects the repository deployment workflow. Cloudflare administrators
still control direct deployment credentials. Other fleet targets need their own
scoped grant. Required mode applies globally to Vizier authorization entrypoints;
unsigned callers, including legacy covenant authorization, are blocked.

## Daily fleet health check

The health-check workflow uses the existing production Environment's
`VIZIER_API_KEY` for its API-key lifecycle probe. It has no signing-key input.
The Vizier probe requires `/docs` to advertise required mode, then verifies
that an authenticated tenant request without a grant returns HTTP 200 with
`BLOCK / GRANT_REQUIRED`. HTTP 401 is an authentication failure, and an
unsigned ALLOW or optional mode is a health-check failure. The signed ALLOW
path is exercised by the protected production deployment workflow.

Every created probe key is revoked in a `finally` block, including when a
verification assertion fails. On success the probe also checks that the
revoked key is rejected with HTTP 401. Local runs must supply `VIZIER_API_KEY`
from protected storage; there is no embedded credential fallback.

## Initialize missing AgentCard keys on the two newest Workers

Dispatch `deploy-existing-fleet.yml` on `main` with
`initialize_card_signing=true`. This opt-in selects only Financial Guard and
M2M Escrow from the existing fleet. Normal dispatch remains the full fleet.
The protected Environment and separate owner-grant signer are reused; no new
credential, paid resource or broader delegation is required.

Each target's Vizier request includes `initialize_agent_card_signing: true`.
Only after the matching signed ALLOW does the operator process inspect the
live card, JWKS and Worker secret names. Existing valid signatures are retained.
An existing signing secret with a broken/missing signature stops initialization;
this operation does not rotate or overwrite it. A missing key is generated as
an independent ES256 pair for that Worker and passed through stdin to
`wrangler secret put AGENT_CARD_SIGNING_KEY`. Private key material is never
written to disk, command arguments, Actions logs or artifacts. It remains in
the Cloudflare Worker secret store for future releases.

`secret put` updates the current deployment's binding before the subsequent
normal gated deployment. Both happen inside the validated ALLOW execution.
A failure after the binding write may leave a correctly configured key on the
previous deployment; rerunning retains it rather than replacing it. Success
requires verification of the served card's JWS against its served public JWKS.

This verifies card provenance, not transaction safety, evidence truth or revenue.
Skills, publisher identity and public access declarations are not altered.

Wrangler's JSON secret inventory is emitted at its normal `log` level. The
subprocess captures that output privately; setting `WRANGLER_LOG=error` suppresses
the inventory even on exit 0 and is therefore not used. Log sanitization remains
forced on, CLI metrics off, and raw subprocess errors/output are never forwarded.
The bootstrap's own public probes carry `agenda-owner-card-signing` attribution.
