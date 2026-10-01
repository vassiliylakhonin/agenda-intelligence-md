# Hosted payment execution v2

## One payment, one exact request

Check `/.well-known/x402` and its `x_agenda_access` on the serving host. Deployed
evaluation uses `pay_per_call`; discovery is free. Normal evaluation is 0.05 USDC,
escrow evidence evaluation is 0.50 USDC, and the bankability full dossier is 25
USDC. Pro is a separate signed 490 USDC activation. Fees purchase evaluation, not
a favourable verdict, factual guarantee, transaction authorization or payout.

1. Validate your input and serving URL before transferring. Transfer the native
   USDC amount on Base (chain 8453) to the published recipient. The server verifies
   the receipt, token contract, recipient, amount and block time (within 7 days).
2. POST your original JSON with `X-Payment-Tx`. HTTP 401
   `payer_signature_required` returns `challenge_message` and `request_hash`.
   This challenge request does not claim or consume payment.
3. The funding EOA signs that exact message with EIP-191 `personal_sign`. Submit
   the original request with `X-Payment-Tx` and `X-Payment-Signature`.
4. Save the transaction hash, original URL/body/protocol/task headers and exact
   signature privately. HTTP 200 returns the evaluation. An identical retry
   returns the same saved response for 24 hours with `X-Payment-Replayed: 1`.
   A retry must also retain its original JSON-RPC ID. Changed request/URL/task
   context returns `payment_request_mismatch` and cannot reuse completed credit.

The signed digest is SHA-256 of RFC 8785 canonical JSON:
`{method, url, body, task_token_hash, a2a_version, mcp_protocol_version}`. Empty
protocol headers are empty strings; the empty task header is also hashed.
The challenge is exactly:

```text
Agenda Intelligence MD paid request v2
tx_hash: <lowercase transaction hash>
request_sha256: <lowercase SHA-256 hex>
```

Optional non-Pro `/v1/settle` takes `tx_hash`, explicit `tier` and
`payer_signature`. First obtain the returned activation challenge and sign it.
Success returns `{status: "activated", execution_credit: 1, tier, receipt,
instructions}`. Activation is idempotent for that payer and tier and does not
replace the later exact-request signature. Direct signed execution needs no
separate activation call.

## Errors and recovery

| HTTP | Code | Action |
|---|---|---|
| 400 | invalid_paid_request / payment_headers_required | Correct input before paying; no new claim created. |
| 401 | payer_signature_required | Sign the returned exact-request challenge. |
| 403 | payer_signature_invalid | Use the funding EOA; strangers cannot claim a public hash. |
| 402 | payment_required / insufficient_payment | Inspect the actual operation price; underpayment is not consumed. |
| 409 | payment_execution_pending | Retry the original request after the indicated interval. |
| 409 | payment_request_mismatch | Completed payment belongs to another request; inspect your original input. |
| 409 | original_payment_signature_required | Recover with the original signature, not a newly generated one. |
| 410 | paid_result_expired | Contact support; do not automatically send another transfer. |
| 503 | paid_execution_unavailable | Retry the original payment/request/signature; no second transfer. |

Browser checkout asks for explicit payment confirmation and wallet approval. A
pending checkout retains the original input, hash and signature in page memory;
keep them before closing or refreshing. It will reuse that pending request even
if the form is edited. Closing the page does not schedule automatic recovery.

Payment claims are permanent. Completed encrypted response payloads have a
24-hour recovery window; hourly cleanup removes expired ciphertext. At most 1
MiB of response bytes are cached. Invalid requests are checked before reserving
payment; execution errors retain the exact binding for retry. This service
does not execute the user's transfer, refund or escrow settlement. Expired or
legacy consumed claims and Pro activation delivery failures need manual support.

Configured deployment access keys still apply. Send `X-Production-Key` when a
Pro token occupies `Authorization`. A Pro entitlement and a transaction header
cannot be used together. Protocol discovery and task retrieval need no new
payment, while task capabilities and deployment access remain required.

## Payment stage observability

A separate `agenda_intelligence_payment` Workers Logs event records valid operation attempts, payment-required 402 and signature-required 401 responses, bounded verification failures, verified request admission, execution start/completion/failure, and encrypted-response replay. Events carry an opaque random attempt ID, transport, profile, minimum price, code version and actual deployment ID. They never contain payment hashes, wallet addresses, signatures, tokens, query strings, or input/output documents. Logging failures cannot change payment authorization.

Stage events are HTTP-attempt measurements, not unique customers or settled revenue. Reverification/replay must not count as a new purchase. Discovery and free previews are outside this paid-operation funnel; deployment authorization rejects before operation admission and Pro calls outside this signed-payment path remain separate. The telemetry archive preserves source quality and actual deployment IDs.

Declared `Agenda-urllib-client/` and `Agenda-Plugin-Client-Path/` clients are classified as verification probes based on their declared integration-check convention, not authenticated owner identity. Other generic clients retain unverified external status.
