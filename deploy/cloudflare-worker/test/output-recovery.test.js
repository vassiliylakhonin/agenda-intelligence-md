import test from 'node:test';
import assert from 'node:assert/strict';
import * as client from '../../../examples/output-verification/client.mjs';
import { handleRequest } from '../src/index.js';
const trace = 'aabbccdd-1234-4567-89ab-123456789abc';
const input = { claims: [{ claim_id: 'c1', claim: 'Example supplied text', support_level: 'direct', evidence_ids: ['e1'] }],
  evidence: [{ evidence_id: 'e1', source_id: 'synthetic', text: 'Example supplied text' }] };
const endpoint = 'https://example.test/mcp';

test('one-shot admission exposes payment setup and trace instead of discarding the 402', async () => {
  const answer = await client.callOutputVerification(input, { endpoint,
    fetchImpl: (url, options) => handleRequest(new Request(url, options), {
      AGENT_PROFILE: 'agent_output_verification', BILLING_MODE: 'pay_per_call', VIZIER_DISABLED: '1'
    }) });
  assert.equal(answer.evaluated, false);
  assert.match(answer.paymentTraceId || '', /^[0-9a-f-]{36}$/);
  assert.equal(answer.payment.required_usdc, 0.05);
  assert.equal(answer.nextAction, 'inspect_price_and_configure_payment');
});

test('retained call keeps exact body, ID, headers, trace and original proof after lost response', async () => {
  const seen = []; let count = 0;
  const source = structuredClone(input);
  const headers = { 'x-client-id': 'agenda-owner-output-example' };
  const call = client.createOutputVerificationCall(source, { endpoint, headers, fetchImpl: async (url, options) => {
    seen.push({ url, ...structuredClone(options) }); count++;
    if (count === 1) return Response.json({ jsonrpc: '2.0', id: 'output-review-1', error: { code: -32002,
      data: { x402: { amount_usdc: 0.05 }, required_usdc: 0.05 } } }, { status: 402, headers: { 'x-payment-trace-id': trace } });
    if (count === 2) return Response.json({ jsonrpc: '2.0', id: 'output-review-1', error: { code: -32001 },
      challenge_message: 'synthetic exact-request challenge' }, { status: 401 });
    if (count === 3) throw new Error('lost response');
    return Response.json({ jsonrpc: '2.0', id: 'output-review-1', result: { structuredContent: {
      verdict: 'verify_before_relay', human_review_required: true } } });
  } });
  source.claims[0].claim = 'Changed after preparation'; headers['MCP-Protocol-Version'] = 'changed';
  await call.evaluate();
  const tx = '0x' + 'a'.repeat(64), signature = '0x' + 'b'.repeat(130);
  const challenge = await call.retryWithPayment({ transactionHash: tx });
  assert.equal(challenge.status, 'signature_required'); assert.equal(challenge.evaluated, false);
  assert.equal(challenge.challengeMessage, 'synthetic exact-request challenge');
  await assert.rejects(call.retryWithPayment({ transactionHash: tx, signature }), /lost response/);
  await assert.rejects(call.retryWithPayment({ transactionHash: '0x' + 'c'.repeat(64), signature }), /original payment/);
  const answer = await call.retryWithPayment();
  assert.equal(answer.evaluated, true);
  assert.ok(seen.every(r => r.body === seen[0].body && r.url === endpoint));
  assert.equal(JSON.parse(seen[0].body).params.arguments.claims[0].claim, input.claims[0].claim);
  assert.ok(seen.slice(1).every(r => r.headers['x-payment-trace-id'] === trace));
  assert.ok(seen.every(r => r.headers['mcp-protocol-version'] === '2025-11-25'));
  assert.deepEqual(seen[2], seen[3]);
});

test('retained Node client obtains the real exact-request signature challenge without funding', async () => {
  const { memoryD1 } = await import('./helpers/d1.js');
  const events = [], oldLog = console.log;
  console.log = value => { if (value?.event === 'agenda_intelligence_payment') events.push(value); };
  try {
    const env = { AGENT_PROFILE: 'agent_output_verification', BILLING_MODE: 'pay_per_call',
      VIZIER_DISABLED: '1', PAYMENT_LEDGER: memoryD1() };
    const call = client.createOutputVerificationCall(input, { endpoint,
      headers: { 'x-client-id': 'agenda-owner-output-example' },
      fetchImpl: (url, options) => handleRequest(new Request(url, options), env) });
    const admission = await call.evaluate();
    const challenge = await call.retryWithPayment({ transactionHash: '0x' + 'a'.repeat(64) });
    assert.equal(challenge.status, 'signature_required');
    assert.equal(challenge.paymentTraceId, admission.paymentTraceId);
    assert.match(challenge.challengeMessage, /^Agenda Intelligence MD paid request v2\n/);
    assert.ok(events.every(e => e.payment_trace_id === admission.paymentTraceId));
    assert.ok(!events.some(e => e.stage === 'payment_verified' || e.stage === 'execution_completed'));
  } finally { console.log = oldLog; }
});
