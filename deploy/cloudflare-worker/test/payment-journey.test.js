import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.js';
import { PAYMENT_CLIENT_SCRIPT } from '../src/payment-client.js';
import { memoryD1 } from './helpers/d1.js';
import { signedRequest, mockRpc } from './helpers/payments.js';

const origin = 'https://example.test';
const tx = '0x' + 'a'.repeat(64);
const fixture = { claims: [{ claim_id: 'c1', claim: 'Example supplied text', support_level: 'direct', evidence_ids: ['e1'] }],
  evidence: [{ evidence_id: 'e1', source_id: 'synthetic', text: 'Example supplied text' }] };
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

test('REST MCP A2A correlate 402, signature challenge, execution and replay across HTTP attempts', async () => {
  const oldFetch = globalThis.fetch, oldLog = console.log, events = [];
  globalThis.fetch = mockRpc(0.05);
  console.log = value => { if (value?.event === 'agenda_intelligence_payment') events.push(value); };
  try {
    for (const [path, body] of [
      ['/v1/agent-output/verification', fixture],
      ['/mcp/agent', { jsonrpc: '2.0', id: 'm-agent', method: 'tools/call', params: { name: 'agent_output_verification', arguments: fixture } }],
      ['/mcp', { jsonrpc: '2.0', id: 'm1', method: 'tools/call', params: { name: 'agent_output_verification', arguments: fixture } }],
      ['/message/send', { jsonrpc: '2.0', id: 'a1', method: 'message/send', params: { request: fixture } }]
    ]) {
      const env = { AGENT_PROFILE: 'agent_output_verification', PAYMENT_LEDGER: memoryD1(), BILLING_MODE: 'pay_per_call', VIZIER_DISABLED: '1' };
      const url = origin + path;
      const plain = await handleRequest(new Request(url, { method: 'POST', body: JSON.stringify(body) }), env);
      assert.equal(plain.status, path === '/mcp/agent' ? 200 : 402);
      const trace = plain.headers.get('x-payment-trace-id');
      assert.match(trace || '', UUID);
      assert.match(plain.headers.get('access-control-expose-headers'), /X-Payment-Trace-Id/i);
      if (body.id) {
        const payload = await plain.json();
        assert.equal(payload.id, body.id);
        if (path === '/mcp/agent') {
          assert.equal(payload.result.isError, true);
          assert.equal(payload.result.structuredContent, undefined);
          const admission = JSON.parse(payload.result.content[0].text);
          assert.equal(admission.evaluated, false);
          assert.equal(admission.admission_status, 402);
          assert.equal(admission.payment_trace_id, trace);
          assert.ok(admission.details.x402);
        }
      }
      const headers = { 'x-payment-trace-id': trace };
      const challenge = await handleRequest(new Request(url, { method: 'POST', headers: { ...headers, 'x-payment-tx': tx }, body: JSON.stringify(body) }), env);
      assert.equal(challenge.status, path === '/mcp/agent' ? 200 : 401);
      assert.equal(challenge.headers.get('x-payment-trace-id'), trace);
      const challengeBody = await challenge.json();
      const challengeDetails = path === '/mcp/agent' ? JSON.parse(challengeBody.result.content[0].text).details : challengeBody;
      assert.ok(challengeDetails.challenge_message);
      const signed = await signedRequest(url, body, tx, headers);
      const completed = await handleRequest(signed.clone(), env);
      assert.equal(completed.status, 200);
      const text = await completed.text();
      const replay = await handleRequest(signed.clone(), env);
      assert.equal(replay.status, 200);
      assert.equal(replay.headers.get('x-payment-replayed'), '1');
      assert.equal(replay.headers.get('x-payment-trace-id'), trace);
      assert.equal(await replay.text(), text);
      const chain = events.filter(e => e.payment_trace_id === trace);
      assert.equal(new Set(chain.map(e => e.attempt_id)).size, 4);
      for (const stage of ['payment_required', 'signature_required', 'execution_completed', 'execution_replayed'])
        assert.equal(chain.filter(e => e.stage === stage).length, 1, stage);
      assert.ok(!JSON.stringify(chain).includes(tx));
      assert.ok(!JSON.stringify(chain).includes(signed.headers.get('x-payment-signature')));
    }
  } finally { globalThis.fetch = oldFetch; console.log = oldLog; }
});

test('invalid client trace is replaced, a reused valid trace cannot grant payment access, CORS admits it', async () => {
  const oldLog = console.log; console.log = () => {};
  try {
    const env = { AGENT_PROFILE: 'agent_output_verification', BILLING_MODE: 'pay_per_call' };
    const valid = 'aabbccdd-1234-4567-89ab-123456789abc';
    for (const value of ['private-wallet-or-prompt', valid.toUpperCase()]) {
      const response = await handleRequest(new Request(origin + '/v1/agent-output/verification', {
        method: 'POST', headers: { 'x-payment-trace-id': value }, body: JSON.stringify(fixture) }), env);
      assert.equal(response.status, 402);
      assert.match(response.headers.get('x-payment-trace-id'), UUID);
      if (value === valid.toUpperCase()) assert.equal(response.headers.get('x-payment-trace-id'), valid);
      else assert.notEqual(response.headers.get('x-payment-trace-id'), value);
    }
    const options = await handleRequest(new Request(origin + '/mcp', { method: 'OPTIONS' }), env);
    assert.match(options.headers.get('access-control-allow-headers'), /x-payment-trace-id/i);
  } finally { console.log = oldLog; }
});

test('browser retains the server trace throughout checkout and lost-response recovery', async () => {
  const trace = 'aabbccdd-1234-4567-89ab-123456789abc', seen = [];
  let calls = 0;
  const wallet = { confirm: () => true, ethereum: { request: async ({method}) =>
    method === 'eth_requestAccounts' ? ['synthetic-payer'] : method === 'eth_chainId' ? '0x2105' : method === 'personal_sign' ? 'synthetic-proof' : tx } };
  const fetch = async (_url, options) => {
    seen.push(JSON.parse(JSON.stringify(options)));
    calls++;
    if (calls === 1) return Response.json({ x402: { amount_usdc: 0.05 } }, { status: 402, headers: { 'x-payment-trace-id': trace } });
    if (calls === 2) return Response.json({ challenge_message: 'synthetic challenge' }, { status: 401 });
    if (calls === 3) throw new Error('lost response');
    return Response.json({ result: 'recovered' });
  };
  const paidFetch = new Function('window', 'fetch', PAYMENT_CLIENT_SCRIPT + '; return agendaPaidFetch;')(wallet, fetch);
  const options = { method: 'POST', headers: {}, body: JSON.stringify(fixture) };
  await assert.rejects(paidFetch(origin + '/v1/agent-output/verification', options, .05), /lost response/);
  assert.equal((await paidFetch(origin + '/v1/agent-output/verification', { ...options, body: '{}' }, .05)).status, 200);
  assert.ok(seen.slice(1).every(r => r.headers['x-payment-trace-id'] === trace));
  assert.deepEqual(seen[2], seen[3]);
});


test('agent facade preserves bearer authentication and malformed protocol refusals', async () => {
  const env = { AGENT_PROFILE: 'kazakhstan', BILLING_MODE: 'pay_per_call', MIDDLE_CORRIDOR_API_KEY: 'private' };
  const response = await handleRequest(new Request(origin + '/mcp/agent', { method: 'POST',
    body: JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'middle_corridor_deal_risk',arguments:{}}}) }), env);
  assert.equal(response.status, 401);
  assert.ok((await response.json()).error);
  const malformed = await handleRequest(new Request(origin + '/mcp/agent', {method:'POST',body:'{' }),
    { AGENT_PROFILE:'agenda', BILLING_MODE:'pay_per_call' });
  assert.equal(malformed.status, 400);
});
