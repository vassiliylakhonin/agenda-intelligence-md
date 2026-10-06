# @agenda-intelligence/guard-mobile

Financial Guard and Escrow review clients for hosted Agenda Workers. No wallet
adapter, automatic funding, current sanctions clearance or automatic settlement.
Local heuristics are limited risk flags; a service result is not permission to
sign or transfer. No latency guarantee is established by the examples.

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
import { AgentFinancialGuardClient, PaymentAdmissionError } from './dist/index.js';
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
rejection. Whenever human review is required, it throws
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
