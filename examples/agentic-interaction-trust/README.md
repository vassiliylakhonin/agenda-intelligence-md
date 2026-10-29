# Agent interaction review before invocation

Use this example before an external agent asks to invoke an A2A capability, call an MCP tool, or initiate checkout or payment. It is an **evidence review and a hold**, not an identity verifier, authorization service, or a complete middleware enforcement boundary. No action or message is executed by these helpers.

Node.js 20+; no package or wallet is needed for the example. Import these files from a checkout. The free-trial evaluator sends the request to the hosted service only when explicitly called. A completed check consumes one shared network/product attempt; no payment or automatic retry is performed. Shared networks and capacity limits apply. Do not send secrets or confidential evidence to the public endpoint.

## Minimal input

```js
import { createInteractionGate, evaluateTrustTrial } from './examples/agentic-interaction-trust/before-invoke.mjs';

const gate = createInteractionGate({evaluate: request => evaluateTrustTrial(request)});
const outcome = await gate.invoke({
  actor_name: 'ProcurementBot-X',
  action: 'settle_payment',
  surface: 'a2a_endpoint',
  resource: 'order-42',
  evidence: []
});
// outcome.outcome is block, step_up or human_review.
// outcome.executed and outcome.authorization_granted are always false.
// Route the result to a responsible reviewer; do not invoke the external action.
```

`liteRequest` converts only the named actor, action and surface into the existing strict request. Actor type is explicitly `unknown`; an omitted evidence list becomes `[]`; the stage is `pre_execution`. No identity, operator, principal, permission, authentication, signature or actual evidence is inferred. The optional evidence records require caller-supplied IDs, recognized types, titles and valid dates. URL values are labels, not fetched or authenticated. `gate.beforeInvoke(strictRequest, {mode:'strict'})` forwards an existing structured request to the selected evaluator; it does not silently fill or change its fields. This is a client adapter, not a new hosted input schema.

Unknown results, invalid input, admission refusal, exhaustion, network errors and mismatched response subjects yield `block`. The helper never issues `allow`, even for a high score or zero reported gaps. The service checks source-reference metadata only: it does not read and validate the underlying records, authenticate the actor or authorize the request. Record the goal, source ownership, missing evidence, assumptions, requested action and human-escalation conditions before any consequential action.

To let a real operation proceed, the host must implement its own separate, trusted authorization boundary. It must authenticate the actor and principal, independently verify the evidence, authorize the exact action and target, bind the approval to the actual request and its arguments, handle expiry and revocation, prevent replay, and enforce the decision at the point of use. A caller-provided card, `signed` flag, source title, high score, `review_ready`, or a readiness receipt is not such an authorization. Do not assume a prior check is still valid after an action, actor, target, evidence or policy changes. Obtain a new review and authorization as appropriate.

## Three explicit review stages

[`security-chain.mjs`](./security-chain.mjs) offers three named entry points with explicitly supplied service callbacks. They do not execute an operation or advance automatically:

1. `interaction(input)` prepares the inbound interaction for human/step-up review. A hold is not an allow.
2. **Only after the application independently authorizes an invocation**, `output(answer, sources)` reviews the resulting text using the separately configured Output Verification adapter. A clean structure routes to a human; it does not establish semantic support or permit relay.
3. `preAction(request)` reviews a specific proposed external action using a separately configured `pre_action_check` callback. `continue` means readiness only. The application still needs independent, action-bound authorization and enforcement before execution. If using `decision_check`/`decision_verify`, verify the receipt against the exact action and request hashes; that signed readiness result is also not authority.

Failures and malformed results return `block`, and the stages never automatically relay or pay. Calls to other services are never implicit; the application must configure each endpoint, admission and credentials explicitly. For the Output trial callback, use [`reviewAnswerBeforeRelay`](../output-verification/review-answer-client.mjs). Its cited-source review and the pre-action contract are separate checks, not interchangeable.

## Evidence request templates

`EVIDENCE_TEMPLATES` lists suggested source types for `payment`, `external_mcp`, and `delegated_checkout`. They help a reviewer request material, but are not assertions that a source exists, policy presets, calibrated thresholds or minimum legal requirements. The hosted gate has its own [source taxonomy](../../source-requirements/agentic-interaction-trust.json); the template neither closes nor changes its gaps. The caller's verified policy must classify the actual action and principal. Declaring an action `read_only` or a caller `internal` does not prove either claim and never bypasses authorization.

## Saved demonstration

On the Interaction Trust product page, choose **Run a worked example** and expand **Adding fake records: gaps remain**. The first case is a synthetic sparse request; the second adds explicitly fictional source records. The actual gate rejects those placeholders, so the gaps remain. Both results are precomputed, consume no trial attempt and require human review. This demonstrates the boundary; it does not demonstrate a complete real evidence pack or an `allow` outcome.

Run the local real-handler tests without network, quota or payment:

```sh
node --test deploy/cloudflare-worker/test/interaction-gate-helper.test.js
```
