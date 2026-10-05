import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { callOutputVerification } from '../../../examples/output-verification/client.mjs';
import { handleRequest } from '../src/index.js';
const input = JSON.parse(readFileSync(new URL('../../../examples/output-verification/request.json', import.meta.url)));
function localClient(billingMode) {
  return { endpoint: 'https://example.test/mcp', headers: { 'x-client-id': 'agenda-owner-output-example' },
    fetchImpl: (url, options) => handleRequest(new Request(url, options), {
      AGENT_PROFILE: 'agent_output_verification', BILLING_MODE: billingMode, VIZIER_DISABLED: '1'
    }) };
}
test('runnable example detects fabricated support through the real MCP handler', async () => {
  const answer = await callOutputVerification(input, localClient('freemium'));
  assert.equal(answer.status, 'evaluated');
  assert.equal(answer.result.verdict, 'block_unsafe_claims');
  assert.equal(answer.result.grounded_claim_count, 1);
  assert.ok(answer.result.unsafe_claims.some(c => c.claim_id === 'customer-count'));
  const corrected = structuredClone(input); corrected.claims.pop();
  const review = await callOutputVerification(corrected, localClient('freemium'));
  assert.equal(review.result.verdict, 'verify_before_relay');
  assert.equal(review.result.human_review_required, true);
});
test('hosted payment refusal and malformed inputs never masquerade as evaluation', async () => {
  const answer = await callOutputVerification(input, localClient('pay_per_call'));
  assert.deepEqual(answer, { status: 'payment_required', evaluated: false });
  await assert.rejects(callOutputVerification({}, localClient('pay_per_call')), /Evaluation refused/);
});
