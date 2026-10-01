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
