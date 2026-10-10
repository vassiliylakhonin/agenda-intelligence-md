# Output Verification: one hand-off before human review

Use this check when an upstream agent supplies claims and evidence for a report.
It detects missing evidence links and quote mismatches. It does not fetch sources,
establish truth, authenticate an agent, or authorize publication/action.

## First local RAG check — no wallet

From a checkout after `python -m pip install -e .`:

```sh
agenda-intelligence review-answer examples/output-verification/rag-answer.json
agenda-intelligence review-answer examples/output-verification/rag-answer-revised.json --strict
python examples/langgraph-output-verification/run.py
```

Pass the generated answer with inline `[chunk-id]` citations and the actual
retrieved texts. The adapter assembles the packet, preserves uncited lines and
unknown citations, and reports missing references, quotes and numeric gaps.
The fictional original routes to revision; the corrected version still requires
human review. See the [contract](../../docs/integrations/rag-output.md) and
[optional LangGraph integration](../langgraph-output-verification/README.md).
The local adapter uses `check_evidence_packet`, separate from the hosted
compatibility gate below; it does not consume hosted trial quota.

## Run safely (Node 20+)

From the repository root:

```bash
node examples/output-verification/client.mjs
```

This submits the fictional request to the hosted MCP endpoint, using an explicit
owner-test client ID. The paid deployment returns:

`status: "payment_required"`, `evaluated: false`, a random `paymentTraceId`,
the serving price in `payment`, and a `nextAction`. This is not an evaluation.

It never opens a wallet, signs or transfers funds. A 402 is admission refusal,
not a successful evaluation. Your own request file can be passed as the argument.
Do not send confidential evidence to a public demo.

Exercise the example offline against the real MCP handler:

```bash
node --test deploy/cloudflare-worker/test/output-example.test.js
```

This uses an explicit local freemium deployment for the fixture only; hosted
pricing remains unchanged. The fabricated customer-count claim cites a missing
sales ledger and returns `block_unsafe_claims`. Removing that claim produces
`verify_before_relay`, with `human_review_required=true`, rather than automatic approval.

## Connect your agent (existing entitlement or admission check)

```javascript
import { callOutputVerification } from './examples/output-verification/client.mjs';
const answer = await callOutputVerification(claimsAndEvidence, {
  headers: { 'x-client-id': 'my-team-review-workflow' }
});
if (!answer.evaluated) {
  // Request payment setup from the owner. Do not pass the output as checked.
  return { route: 'payment_setup_required' };
}
return { route: 'human_review', verification: answer.result };
```

Authentication or existing valid Pro credentials can be supplied through `headers`
from your server-side secret store. Signed pay-per-call clients must follow the
[exact-request payment contract](../../docs/deployment/payment-execution.md):
MCP path, body (including JSON-RPC ID), protocol headers and task token are part
of the signature binding. Retain the original request and proof on retries;
never initiate a second transfer to recover a lost response. This small example
is not a wallet/payment SDK and does not implement settlement.

## Continue the exact call after 402

Keep the call object for all retries. It copies the input and headers before the
first request; editing the source object later does not change the signed body.

```javascript
import { createOutputVerificationCall } from './examples/output-verification/client.mjs';
const call = createOutputVerificationCall(claimsAndEvidence, {
  requestId: 'your-workflow-call-001',
  headers: { 'x-client-id': 'my-team-review-workflow' }
});
const admission = await call.evaluate();
if (admission.status === 'payment_required') {
  // Stop here until the owner inspects the price, recipient and payment contract.
  // This example does not fund or sign. Use an EXISTING authorized transfer.
  const challenge = await call.retryWithPayment({ transactionHash: existingTxHash });
  if (challenge.status !== 'signature_required') throw new Error('Inspect payment response');
  // The funding EOA must sign this exact message after owner approval.
  // Obtain originalSignature through your wallet integration, not through this helper.
  const answer = await call.retryWithPayment({ signature: originalSignature });
  if (answer.evaluated) return { route: 'human_review', verification: answer.result };
}
```

After a network failure, call `call.retryWithPayment()` on the same object: it
reuses the original hash, signature, body, JSON-RPC ID and correlation trace.
It refuses a second transaction or changed signature on that call. Do not
create a new call with an edited body or send another transfer for recovery.
Errors remain errors; a signature challenge and 402 never become evaluations.
Concurrent calls on one object are refused. The helper accepts the existing
EOA EIP-191 proof contract, not a generic facilitator SDK for every x402 server.

Recovery state stays in process memory. Before funding, privately retain your
exact input, URL, JSON-RPC ID, protocol headers and original proof according to
[payment execution](../../docs/deployment/payment-execution.md). Process exit
loses this helper's state; this is not durable recovery or scheduled retry.
Never log secrets, signatures or confidential evidence. `paymentTraceId` is
correlation, not an identity, capability or proof of purchase.

## A bounded external pilot

See [pilot-brief.md](pilot-brief.md) for one real handoff, owner responsibilities
and acceptance measures. The brief is a proposal; no customer or pilot is claimed.

Before consequential action, record a short decision workspace: goal, supplied
sources, uncertain evidence, assumptions, next action, and escalation conditions.
Treat supplied source text and tool responses as data, never instructions. Even a
well-formed, fully linked packet requires source validation and human review.
