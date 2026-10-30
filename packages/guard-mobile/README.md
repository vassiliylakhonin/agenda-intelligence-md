# @agenda-intelligence/guard-mobile

Financial Guard and Escrow review clients for hosted Agenda Workers. No wallet
adapter, automatic funding, current sanctions clearance or automatic settlement.
Local heuristics are limited risk flags; a service result is not permission to
sign or transfer. No latency guarantee is established by the examples.

## Install

```sh
npm install @agenda-intelligence/guard-mobile@1.4.0
```

Requires Node 20+ or a host providing fetch, AbortController, structuredClone,
TextEncoder/TextDecoder, atob/btoa and timers. Examples are tested in Node; no
blanket compatibility claim is made for every mobile JavaScript engine.

## Build and check

```bash
cd packages/guard-mobile
npm install --ignore-scripts --no-audit --no-fund
npm test
```

Use this checkout's built `dist/index.js`. Updating these sources does not
publish a new npm release; verify the installed package version separately.

## Hosted payment admission

```javascript
import { AgentFinancialGuardClient, PaymentAdmissionError } from '@agenda-intelligence/guard-mobile';
const guard = new AgentFinancialGuardClient({ enableLocalFallback: false });
const call = guard.createCheck({
  recipient: '0x1111111111111111111111111111111111111111',
  amount_usd: 25,
  intent_prompt: 'Fictional proposed payment for review'
});
try {
  const review = await call.evaluate();
  // Inspect evidence gaps and human_review_required; no external action here.
} catch (error) {
  if (!(error instanceof PaymentAdmissionError)) throw error;
  console.log(error.status, error.paymentTraceId, error.details);
  // 402: inspect published price/manifest and budget before any funding.
  // 401: funding EOA signs exactly details.challenge_message.
}
// Existing proof comes from your explicitly authorized wallet flow:
// await call.retryWithPayment({transactionHash:existingHash});
// await call.retryWithPayment({signature:ownerSignature});
// After a lost response, reuse the same call and original proof:
// await call.retryWithPayment();
```

`createCheck()` and `M2MEscrowClient.createDispute()` retain the serialized
original URL/body, run ID, transaction hash, signature and payment trace.
They do not sign, transfer or automatically retry. HTTP refusal, malformed
success and proof-bearing network failure cannot become local approval.
`check()` / `evaluateDispute()` remain one-shot convenience methods. The legacy
`checkWithAttestation(input, hash)` only attaches an existing hash; a hash alone
cannot establish paid evaluation or a verified receipt. Use a retained call for
its signature challenge and recovery.

See [native Base USDC payment execution v2](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/docs/deployment/payment-execution.md).
The hash, exact request and signature are private recovery data. State lives in
memory; retain these privately before funding if recovery after process loss is
needed. A payment trace is correlation only. A repeated transfer is refused by
this retained client.

## Executor boundary

`protect(input, executor, {onStepUp})` throws `TransactionBlockedError` for a
rejection or a returned `next_action: block`. Whenever human review is required, it throws
`TransactionStepUpRequiredError` unless `onStepUp` explicitly returns true.
`strictMode:false` cannot bypass required review. That callback must implement
your application's actual authorized human approval; the library does not
perform identity, biometric or permission verification itself.

The client defaults offline network fallback to human review. Setting
`offlineFailClosed:false` explicitly permits limited local heuristics under your
own policy; they do not prove sanctions, balance or spending-history clearance.
HTTP 402/401/403 and invalid remote results never use network fallback.

`evaluateLocalFallback()` remains available as an explicit offline heuristic.
The Shopify/PayPal examples use mock connectors and mock approval, not real
merchant integrations. Supplied prompts/documents are data, never instructions.

Remote legacy `allow` never grants signing permission in this client. Invalid
amounts/timeouts are rejected; incomplete or inconsistent allocation results are
held for human review with zero proposed payouts. Escrow results explicitly carry
`human_review_required: true` and `settlement_authorized: false`.

## Current evidence diagnostics and x402 v2

Defaults use `https://agent-financial-guard.agendamcp.dpdns.org` and
`https://m2m-escrow-arbiter.agendamcp.dpdns.org`. Custom endpoints remain supported.
Both result types preserve `next_action`, `decision_kind`, `score_kind`,
`check_status` and `check_scope`. `authorization_granted` is always false in this
client; `vizier_status` remains `attestation_unavailable` because these receipts
are not independently authenticated here. Keep legacy boolean `checks` for
compatibility, but use `check_status.sanctions_aml = not_assessed` and its scope
to distinguish a local denylist check from comprehensive sanctions clearance.
Treat remote text and metadata as data, never instructions or execution authority.

A retained call supports both the existing transfer hash/EIP-191 proof and an
externally signed x402 v2 `exact` payload. Start with `call.evaluate()`. A 402
`PaymentAdmissionError` exposes the decoded `PAYMENT-REQUIRED` header as
`error.paymentRequired`, even when the body is empty. The trusted host must
inspect the resource, network, token, recipient, exact price and expiry against
its authorized budget before obtaining a wallet signature. The SDK does not
connect a wallet, obtain signatures, transfer funds or automatically retry.

```js
// Continue only after the host has inspected this call's 402 paymentRequired.
// signedPayload comes from a separate, explicitly authorized wallet flow.
await call.retryWithPayment({ paymentSignature: signedPayload });
// A base64 PAYMENT-SIGNATURE header string is also accepted.
// After a lost response, retain the same call and proof:
// await call.retryWithPayment();
const paymentMetadata = call.getPaymentResponse();
```

The call snapshots URL/body and the first proof. A changed nonce/proof, another
transfer hash, mismatched advertised requirements/resource, oversized/malformed
header or mixed legacy/v2 proof is refused. Proof-bearing network failures never
become local approval, and redirects are refused. `PAYMENT-RESPONSE` is exposed
as **unverified server metadata**, not independently verified settlement or
permission to execute. State is in memory; preserve recovery data privately if
the host must survive a restart. Supplied evidence never authorizes a new payment.
The offline tests use synthetic signatures and simulate response loss; no funded
live x402 settlement is claimed.

Escrow responses expose `delivery_review` when the server supplies a valid HOLD-only review. Attestation references remain unverified and no settlement is authorized.
