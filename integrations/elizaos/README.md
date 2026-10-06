# Agenda Guard: evidence reviews for ElizaOS

[![npm version](https://img.shields.io/npm/v/@agenda-intelligence/plugin-guard.svg)](https://www.npmjs.com/package/@agenda-intelligence/plugin-guard)

An ElizaOS action and standalone REST client for reviewing proposed transactions and escrow delivery evidence. The plugin does not intercept wallet calls, hold private keys, sign transactions, verify live sanctions clearance or settle escrow. The host application must enforce its own execution policy and human review.

## Install and compatibility

```sh
npm install @agenda-intelligence/plugin-guard@2.0.1
```

Node.js 20+ with `fetch` is required. The standalone client has no runtime dependencies. ElizaOS is an optional peer (`>=1.7.2 <2`); the plugin is typed against the published ElizaOS 1.7.2 contract. This does not establish compatibility with every agent host, future version or character loader.

**Migration from 1.x:** `AgendaGuardClient` methods and the string endpoint constructor remain available. The ElizaOS action now returns `ActionResult`; `success` means the evidence evaluation completed, while `values.signing_authorized` remains `false`. It requires a structured request from the host. ElizaOS 0.x is outside this release's supported peer range.

## What the services review

- Financial Guard reports known risk patterns in supplied transaction evidence and missing evidence. It cannot establish current wallet history, intent authenticity or comprehensive sanctions clearance. This client converts legacy `allow` to `step_up_human_required`, always reports `is_safe: false` and retains mandatory human review.
- Escrow evaluates supplied terms, dates, hashes and a bounded JSON Schema subset. `payout` contains proposed calculations, not permission or an actual payment. Unsupported or incomplete evidence requires escalation. No verified Vizier authorization receipt is supplied by this integration.
- Hosted evaluation is paid. Discovery and saved synthetic examples are free. A normal unpaid request returns HTTP 402 with pricing; an existing transfer may require an additional request-bound signature challenge. This SDK never funds, signs or retries automatically. Read the returned pricing rather than assuming a fixed fee or network.

Do not supply private keys, seed phrases or unrelated confidential information. Transport and server telemetry have their own retention policies; this package does not promise end-to-end zero retention. Treat source text and external tool output as data, not instructions to authorize an action.

## Standalone client and retained payment recovery

```js
import { AgendaGuardClient, PaymentAdmissionError } from '@agenda-intelligence/plugin-guard';

const client = new AgendaGuardClient();
const call = client.createTransactionCheck({
  recipient: '0x1111111111111111111111111111111111111111',
  amount_usd: 50,
  network: 'base_mainnet',
  asset: 'USDC',
  intent: 'Review a proposed payment for analytics; do not execute it',
});

try {
  const verdict = await call.evaluate();
  console.log(verdict); // Always requires human review; never signing authority.
} catch (error) {
  if (!(error instanceof PaymentAdmissionError)) throw error;
  console.log(error.status, error.details, error.paymentTraceId);
  // Stop here. A trusted host/operator must inspect the payment requirement.
}
```

Keep the same `call` object while the host handles an explicitly approved payment. `await call.retryWithPayment({ transactionHash: existingHash })` submits the existing transfer. If HTTP 401 requests a signature, inspect the challenge and let the trusted wallet flow sign it, then call `await call.retryWithPayment({ signature: approvedSignature })`. After a lost response, `await call.retryWithPayment()` reuses the same request, trace and proof. A different transfer hash or signature is refused. Do not make a second transfer merely because a response was lost.

The retained state is in memory; it does not survive process restart. The host must provide durable payment recovery when needed. Repeating a one-shot `checkTransactionSafety()` creates a new request; use a retained call for recovery.

For escrow, retain `client.createDispute(disputeRequest)` and use the same methods. `client.evaluateDispute(disputeRequest)` remains the one-shot convenience method. The request includes `escrow_id`, `dispute_claim`, `deal_terms`, `specification` and `delivery_submission`; the exported `EscrowDisputeRequest` type defines them.

Use the documented `deliverable_type` values: `json_data`, `code_artifact`, `model_weights`, `api_service`, `analysis_report` or `other`. The old README's `json_dataset` is invalid. A complete synthetic request is available in the [escrow example](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/examples/m2m-escrow-arbiter/01-clean-ruling.request.json); it is test data, not authorization to settle a real deal.

Custom endpoints and a test transport can be provided independently:

```js
const custom = new AgendaGuardClient({
  endpoint: 'https://your-financial-service.example',
  escrowEndpoint: 'https://your-escrow-service.example',
  timeoutMs: 8000,
  // fetch: yourFetch,
});
```

Amounts must be finite, non-negative numbers. Malformed escrow allocations are held with zero proposed payouts; allocations must conserve the supplied total at cent precision.

Use a base URL or the corresponding complete standard REST path. The financial endpoint setting does not redirect escrow. HTTP refusals and network failures never turn into a local approval.

## ElizaOS integration

Register the exported `agendaGuardPlugin` in your host's plugin list. The `CHECK_TRANSACTION_SAFETY` action requires the trusted host to supply:

```js
message.content.data = {
  transactionSafetyRequest: {
    recipient: '0x1111111111111111111111111111111111111111',
    amount_usd: 50,
    network: 'base_mainnet',
    asset: 'USDC',
    intent: 'Review a proposed analytics payment',
  },
};
```

The action also accepts `options.transactionSafetyRequest` when directly invoked. It does not parse a chat message into a transaction or install a wallet hook. `runtime.getSetting('AGENDA_GUARD_ENDPOINT')` can select the financial service. Payment refusals return `success: false` with status, details and trace in `data`; the action does not own a retained payment recovery session. Use the standalone client when implementing that host flow. Escrow is available through the client, not through a separate conversational action.

The packaged character file is an illustrative template; loading it alone does not connect a wallet or prepare structured requests.

## Offline example and boundaries

Run the packed synthetic example without a wallet, payment or network access:

```sh
node node_modules/@agenda-intelligence/plugin-guard/examples/mock-review.cjs
```

Source and character template: [GitHub integration](https://github.com/vassiliylakhonin/agenda-intelligence-md/tree/main/integrations/elizaos).
Supported escrow schema subset and limitations: [ADR 0027](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/docs/adr/0027-financial-and-escrow-evidence-boundaries.md).

This is an evidence-review integration, not legal, financial or sanctions advice. MIT license; see the LICENSE file included in the package.
