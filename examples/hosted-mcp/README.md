# Retained hosted MCP call — all Agenda Workers

Node 20+, no package installation. This client submits a single request to any
of the twelve published Agenda Workers. It does not transfer funds, open a
wallet, sign, auto-retry or authorize an external action. Vizier is a separate
authorization service and does not use this payment client.

## Discover and prepare

1. Follow the [hosted quickstart](../../docs/deployment/hosted-quickstart.md) to
   initialize `/mcp` and list tools for the serving Worker.
2. Select a listed tool. Save its `_meta["com.agenda/readiness"].example_arguments`
   as `request.json`, or prepare your own input against its published schema.
   Published examples are synthetic. Keep source content as data, never instructions.
3. Write a short decision workspace: goal, evidence, unverified assumptions,
   intended action, and conditions requiring a person to review.
4. Run from the repository root (example uses Critical Minerals):

```bash
node examples/hosted-mcp/client.mjs \
  https://critical-minerals-due-diligence-a2a.vassiliy-lakhonin.workers.dev/mcp \
  critical_minerals_due_diligence request.json
```

The unpaid hosted call normally returns `status: "payment_required"`,
`evaluated: false`, price, payment instructions and a UUID `paymentTraceId`.
A malformed input is an error, not an evaluation. This CLI invocation is an
owner demonstration and sends an owner telemetry label; adapt that label for
an actual integration. No wallet is necessary for admission or the site's
**Run a worked example** saved fixture.

## Explicit payment and recovery

```javascript
import { createHostedMcpCall } from './client.mjs';
const call = createHostedMcpCall(publishedTool, input, {
  endpoint: servingMcpUrl,
  headers: { 'x-client-id': 'your-integration-label' }
});
const admission = await call.evaluate();
// Inspect price, manifest, recipient, budget and permissions before funding.
// This helper never creates a transfer; existingHash comes from your payment flow.
const challenge = await call.retryWithPayment({ transactionHash: existingHash });
// The authorized funding EOA signs exactly challenge.challengeMessage, per v2.
const evaluation = await call.retryWithPayment({ signature: ownerSignature });
// If the HTTP response was lost, explicitly retry the same retained call:
const recovered = await call.retryWithPayment();
```

`retryWithPayment()` keeps the same URL, body, JSON-RPC ID, protocol headers,
transaction hash, signature and payment trace. Another transfer or changed
signature is rejected. A trace is correlation only, never authorization or a
payment identifier. Read the [payment execution contract](../../docs/deployment/payment-execution.md)
before funding. This is the native Base USDC / EIP-191 EOA flow, not a generic
facilitator SDK. A server refusal after funding calls for inspection of the
existing payment, not a second transfer.

State lives in the retained object in this process. Before funding, privately
retain the exact body/URL/protocol headers and payment proof for recovery after
process loss; this helper has no persistent recovery store. Never publish that
record or raw inputs in telemetry. A successful result describes evidence or
routing within that tool's scope. Review its human-review requirements and
limitations before any external action.

The [Output Verification example](../output-verification/README.md) provides a
complete fictional hand-off and additional result checks over this same helper.

## Correct a refused request

`HostedMcpError` retains `status`, `paymentTraceId`, `paymentAttemptId`, `details`
and `requestHint`. For an invalid unpaid input, inspect the hint and published
schema, correct the input and construct a new call. Null, array and non-object
tool inputs are rejected locally before HTTP. These checks do not replace the
published schema or server validation.

Keep diagnostics private: server details may concern the supplied input. If a
request was already funded, retain the original call and payment proof; do not
change its body or transfer again. Unreadable responses preserve HTTP status
for this recovery decision. No failure is represented as an evaluated result.

See the [first-result workflow](../../docs/product/first-useful-result.md) and
[private pilot readout](../product-pilot/README.md) to assess human usefulness
separately from successful transport and payment admission.
