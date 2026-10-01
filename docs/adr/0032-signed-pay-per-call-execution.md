# ADR 0032: Signed payment per exact hosted execution

Date: 2026-10-01. Accepted. Hosted contract version: 2 (package 1.14.0).

## Decision

A public Base transaction hash is not an access credential. The shared hosted
execution boundary requires an EIP-191 signature from the transfer's funding EOA.
The challenge binds the transaction to a SHA-256 digest of method, full serving
URL, canonical JSON body, task-token digest and protocol headers. REST, MCP and
A2A preserve endpoint and tool names; unsigned payment integrations must upgrade.
Body-only `x402_payment_tx` no longer establishes payment proof.

Non-Pro `/v1/settle` requires a distinct payer signature binding its requested
tier and reserves one execution. It does not consume that execution. Alternatively
a client can submit the signed exact request directly. Validate the operation's
input and minimum price before reserving money. Do not interpret overpayment as
multiple credits, a Pro purchase or a different service.

The shared D1 ledger arbitrates request binding and a 120-second execution lease.
Only the lease owner can complete an execution. Permanent claims prevent a new
operation from using a completed transaction. Identical retries return the saved
response without another evaluation. A transient failure or expired running lease
allows retry of that identical request. These endpoints evaluate evidence; this
lease mechanism is not authorization for an external transfer or settlement.

Completed responses are encrypted using AES-GCM and a key derived from the exact
validated request signature. Keep that signature: a different valid signature
cannot decrypt the original response. Responses expire after 24 hours and an
hourly scheduled cleanup clears ciphertext, leaving the replay/claim record.
Cached A2A responses can include encrypted continuation capabilities; the task
status store still stores only capability hashes. The cache never stores input
documents, private wallet keys or plaintext request signatures.

Production `BILLING_MODE=pay_per_call` requires payment or a valid Pro entitlement
for evaluation. Discovery, the actual fleet-directory/policy-list capabilities,
empty Assistant MCP orientation and the bankability preview are free. Local or
explicit freemium deployments retain the old free quota. Access keys still apply;
`X-Production-Key` allows a deployment key alongside a Pro Bearer credential.

## Consequences

Apply migration 0002 to the same fleet D1 database before releasing. Do not remove
old claims, bypass replay protection, or fabricate a ledger result during outages.
Legacy consumed payments and expired results require operator reconciliation.
Pro credential activation retains its existing signature, quota, expiry and
manual recovery flow; this change does not make Pro issuance and delivery atomic.

This is a signed transaction-hash integration, not certified standard x402
interoperability. Smart-contract wallet EIP-1271 signatures are not supported.
Tests use independent synthetic signatures and mocked receipts; a real Base USDC
transfer remains a separate acceptance check requiring the wallet owner's action.

See [payment contract](../deployment/payment-execution.md).
