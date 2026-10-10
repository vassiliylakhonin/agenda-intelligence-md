import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleRequest } from '../src/index.js';
import { executePaidRequest } from '../src/paid-execution.js';
import { paymentActivationChallenge } from '../src/settlement.js';
import { readPayment } from '../src/payment-ledger.js';
import { provisionProBearerToken } from '../src/settlement.js';
import { claimPayment } from '../src/payment-ledger.js';
import { PAYMENT_CLIENT_SCRIPT } from '../src/payment-client.js';
import { memoryD1 } from './helpers/d1.js';
import { signedRequest, sign, payer, mockRpc } from './helpers/payments.js';

const origin = 'https://example.test';
const tx = '0x' + 'a'.repeat(64);
const fixture = { claims: [{ claim_id: 'c1', claim: 'Example supplied text', support_level: 'direct', evidence_ids: ['e1'] }],
  evidence: [{ evidence_id: 'e1', source_id: 'synthetic', text: 'Example supplied text' }] };
const endpoint = origin + '/v1/agent-output/verification';
function environment() { return { AGENT_PROFILE: 'agent_output_verification', PAYMENT_LEDGER: memoryD1(), BILLING_MODE: 'pay_per_call', VIZIER_DISABLED: '1' }; }
async function mocked(amount, action) {
  const original = globalThis.fetch;
  globalThis.fetch = mockRpc(amount);
  try { await action(); } finally { globalThis.fetch = original; }
}

test('activation preserves one signed call; lost response recovers identical encrypted result', async () => mocked(0.05, async () => {
  const env = environment();
  const activate = () => handleRequest(new Request(origin + '/v1/settle', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tx_hash: tx, tier: 'tier_micro_check', payer_signature: sign(paymentActivationChallenge(tx, payer, 'tier_micro_check')) }) }), env);
  assert.equal((await activate()).status, 200);
  assert.equal((await activate()).status, 200);
  const request = await signedRequest(endpoint, fixture, tx);
  const first = await handleRequest(request.clone(), env);
  assert.equal(first.status, 200);
  const firstText = await first.text();
  const retry = await handleRequest(request.clone(), env);
  assert.equal(retry.status, 200);
  assert.equal(retry.headers.get('x-payment-replayed'), '1');
  assert.equal(await retry.text(), firstText);
  const stored = await env.PAYMENT_LEDGER.prepare('SELECT * FROM paid_executions WHERE tx_hash = ?1').bind(tx).first();
  assert.ok(!stored.response_ciphertext.includes('Example supplied text'));
  assert.ok(!stored.response_ciphertext.includes(request.headers.get('x-payment-signature')));
  const changed = await handleRequest(await signedRequest(endpoint, { ...fixture, note: 'other operation' }, tx), env);
  assert.equal(changed.status, 409);
  assert.equal((await changed.json()).code, 'payment_request_mismatch');
}));

test('public hashes and stranger signatures grant no entitlement, including body aliases', async () => mocked(0.05, async () => {
  const env = environment();
  const unsigned = await handleRequest(new Request(endpoint, { method: 'POST', headers: { 'x-payment-tx': tx }, body: JSON.stringify(fixture) }), env);
  assert.equal(unsigned.status, 401);
  const bad = await handleRequest(await signedRequest(endpoint, fixture, tx, {}, '2'), env);
  assert.equal(bad.status, 403);
  const inline = await handleRequest(new Request(endpoint, { method: 'POST', body: JSON.stringify({ ...fixture, request: { x402_payment_tx: tx } }) }), env);
  assert.equal(inline.status, 400);
  assert.equal(await readPayment(env, tx), null);
}));

test('strict mode charges evaluation across REST MCP A2A while discovery stays free', async () => {
  const env = environment();
  const post = (path, body) => handleRequest(new Request(origin + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), env);
  assert.equal((await post('/v1/agent-output/verification', fixture)).status, 402);
  assert.equal((await post('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'agent_output_verification', arguments: fixture } })).status, 402);
  assert.equal((await post('/message/send', { jsonrpc: '2.0', id: 1, method: 'message/send', params: { request: fixture } })).status, 402);
  assert.equal((await post('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' })).status, 200);
  const emptyEnv = { ...env, PAYMENT_LEDGER: undefined };
  assert.equal((await handleRequest(new Request(endpoint, { method: 'POST', body: JSON.stringify(fixture) }), emptyEnv)).status, 402);
});

test('invalid requests and bankability underpayment do not consume a payment', async () => mocked(0.05, async () => {
  const env = environment();
  assert.equal((await handleRequest(await signedRequest(endpoint, {}, tx), env)).status, 400);
  const bank = { project_name: 'Synthetic', corridor_leg: 'Aktau-Baku', capex_usd_m: 10, ifi_debt_usd_m: 0, dscr_min: 1.5 };
  assert.equal((await handleRequest(await signedRequest(origin + '/v1/corridor-bankability/screen', bank, tx), env)).status, 402);
  assert.equal(await readPayment(env, tx), null);
}));

test('concurrent identical calls execute once and transient evaluation failures retry without another transfer', async () => mocked(0.05, async () => {
  const env = environment();
  const request = await signedRequest(endpoint, fixture, tx);
  let count = 0;
  let release;
  const barrier = new Promise(r => { release = r; });
  const run = r => executePaidRequest(r, fixture, env, 0.05, async () => { count++; await barrier; return Response.json({ result: 'once' }); });
  const first = run(request.clone());
  await new Promise(r => setTimeout(r, 20));
  const second = await run(request.clone());
  assert.equal(second.status, 409);
  release();
  assert.equal((await first).status, 200);
  assert.equal(count, 1);
  assert.equal((await run(request.clone())).headers.get('x-payment-replayed'), '1');
  assert.equal(count, 1);
  const otherTx = '0x' + 'b'.repeat(64);
  const other = await signedRequest(endpoint, fixture, otherTx);
  const failed = await executePaidRequest(other.clone(), fixture, env, 0.05, async () => { throw new Error('upstream failure'); });
  assert.equal(failed.status, 503);
  const recovered = await executePaidRequest(other.clone(), fixture, env, 0.05, async () => Response.json({ recovered: true }));
  assert.equal(recovered.status, 200);
}));

test('paid MCP and A2A retries preserve their JSON-RPC IDs and original result', async () => mocked(0.05, async () => {
  for (const [path, body] of [
    ['/mcp', { jsonrpc: '2.0', id: 'm1', method: 'tools/call', params: { name: 'agent_output_verification', arguments: fixture } }],
    ['/message/send', { jsonrpc: '2.0', id: 'a1', method: 'message/send', params: { request: fixture } }]
  ]) {
    const env = environment();
    const req = await signedRequest(origin + path, body, tx);
    const first = await handleRequest(req.clone(), env);
    assert.equal(first.status, 200);
    const text = await first.text();
    assert.equal(JSON.parse(text).id, body.id);
    assert.equal(await (await handleRequest(req.clone(), env)).text(), text);
  }
}));

test('caller capability fields cannot exempt REST or discount another deployed profile', async () => mocked(0.05, async () => {
  for (const capability of ['fleet_directory', 'decision_policies_list']) {
    const response = await handleRequest(new Request(endpoint, { method: 'POST', body: JSON.stringify({ ...fixture, capability }) }), environment());
    assert.equal(response.status, 402);
  }
  const body = { jsonrpc: '2.0', id: 1, method: 'message/send', params: {
    capability: 'decision_verify', request: { receipt: 'a.b.c', expected_request_hash: 'sha256:' + 'a'.repeat(64), expected_action_hash: 'sha256:' + 'a'.repeat(64) },
    escrow_request: { escrow_id: 'synthetic', deal_terms: { buyer_id: 'b', seller_id: 's', amount_usd: 100, currency: 'USDC', deadline_utc: '2026-10-01T00:00:00Z', arbitration_policy: 'all_or_nothing' },
      specification: { deliverable_type: 'json_data', expected_schema: { type: 'object', required: ['name'] } },
      delivery_submission: { submitted_at: '2026-09-19T00:00:00Z', artifact_data: { name: 'example' } } }
  } };
  const env = { ...environment(), AGENT_PROFILE: 'm2m_escrow_arbiter' };
  assert.equal((await handleRequest(await signedRequest(origin + '/message/send', body, tx), env)).status, 402);
  assert.equal(await readPayment(env, tx), null);
}));

test('evidence helper aliases validate Pro credentials and consume quota', async () => {
  const env = environment();
  for (const path of ['/v1/evidence-packet/check', '/v1/evidence-packet/repair-prompt']) {
    const response = await handleRequest(new Request(origin + path, { method: 'POST', headers: { authorization: 'Bearer agy_pro_fake' }, body: JSON.stringify(fixture) }), env);
    assert.equal(response.status, 402);
  }
  await claimPayment(env, 'synthetic-pro', {});
  const { token } = await provisionProBearerToken(payer, 'synthetic-pro', env);
  const call = path => handleRequest(new Request(origin + path, { method: 'POST', headers: { authorization: 'Bearer ' + token }, body: JSON.stringify(fixture) }), env);
  assert.equal((await call('/v1/evidence-packet/check')).status, 200);
  assert.equal((await call('/v1/evidence-packet/repair-prompt')).status, 200);
  const rows = await env.PAYMENT_LEDGER.prepare('SELECT used FROM pro_tokens WHERE tx_hash = ?1').bind('synthetic-pro').first();
  assert.equal(rows.used, 2);
});

test('browser checkout retains original signature/input after lost response and never sends another transfer', async () => {
  const methods = [], requests = [];
  let step = 0;
  const wallet = { ethereum: { request: async ({ method }) => {
    methods.push(method);
    return method === 'eth_requestAccounts' ? [payer] : method === 'eth_chainId' ? '0x2105' : method === 'personal_sign' ? 'synthetic-proof' : tx;
  } }, confirm: () => true };
  const fetch = async (url, options) => {
    requests.push({ url, options: JSON.parse(JSON.stringify(options)) });
    step++;
    if (step === 1) return Response.json({ x402: { amount_usdc: 0.05 } }, { status: 402 });
    if (step === 2) return Response.json({ challenge_message: 'exact request challenge' }, { status: 401 });
    if (step === 3) throw new Error('response lost');
    return Response.json({ evaluation: 'original' });
  };
  const paidFetch = new Function('window', 'fetch', PAYMENT_CLIENT_SCRIPT + '; return agendaPaidFetch;')(wallet, fetch);
  const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fixture) };
  await assert.rejects(paidFetch(endpoint, options, 0.05), /response lost/);
  assert.equal((await paidFetch(endpoint, { ...options, body: '{}' }, 0.05)).status, 200);
  assert.equal(methods.filter(m => m === 'eth_sendTransaction').length, 1);
  assert.equal(methods.filter(m => m === 'personal_sign').length, 1);
  assert.deepEqual(requests[2], requests[3]);
});

test('expired result recovery and scheduled purge never reopen the permanent claim', async () => mocked(0.05, async () => {
  const env = environment();
  const req = await signedRequest(endpoint, fixture, tx);
  assert.equal((await handleRequest(req.clone(), env)).status, 200);
  await env.PAYMENT_LEDGER.prepare('UPDATE paid_executions SET response_expires_ms = ?1 WHERE tx_hash = ?2').bind(Date.now() - 1, tx).run();
  await worker.scheduled({}, env);
  const row = await env.PAYMENT_LEDGER.prepare('SELECT response_ciphertext FROM paid_executions WHERE tx_hash = ?1').bind(tx).first();
  assert.equal(row.response_ciphertext, null);
  assert.equal((await handleRequest(req.clone(), env)).status, 410);
  assert.equal((await readPayment(env, tx)).settled_via, 'signed_call');
}));

test('payment stages expose refusals, verification and replay without retaining secrets', async () => mocked(0.05, async () => {
  const env = environment();
  const events = [];
  const originalLog = console.log;
  console.log = value => { if (value?.event === 'agenda_intelligence_payment') events.push(value); };
  try {
    const headers = { 'user-agent': 'Agenda-Plugin-Client-Path/1.0' };
    const plain = () => new Request(endpoint + '?private=secret-query', { method: 'POST', headers, body: JSON.stringify(fixture) });
    assert.equal((await handleRequest(plain(), env)).status, 402);
    assert.equal((await handleRequest(new Request(endpoint, { method: 'POST', headers: { ...headers, 'x-payment-tx': tx }, body: JSON.stringify(fixture) }), env)).status, 401);
    const signed = await signedRequest(endpoint, fixture, tx, { 'user-agent': 'PartnerRuntime/2.0' });
    assert.equal((await handleRequest(signed.clone(), env)).status, 200);
    assert.equal((await handleRequest(signed.clone(), env)).status, 200);
    for (const stage of ['request_received', 'payment_required', 'signature_required', 'payment_verified', 'execution_started', 'execution_completed', 'execution_replayed']) assert.ok(events.some(e => e.stage === stage), stage);
    assert.equal(events.filter(e => e.stage === 'execution_completed').length, 1);
    assert.equal(events.filter(e => e.stage === 'execution_replayed').length, 1);
    assert.ok(events.filter(e => e.stage === 'payment_required').every(e => e.caller_kind === 'verification_probe'));
    const completed = events.find(e => e.stage === 'execution_completed');
    const replayed = events.find(e => e.stage === 'execution_replayed');
    assert.match(completed.execution_id, /^[0-9a-f-]{36}$/);
    assert.equal(replayed.execution_id, completed.execution_id);
    assert.match(completed.caller_hash, /^[0-9a-f]{16}$/);
    assert.equal(replayed.caller_hash, completed.caller_hash);
    assert.equal(events.find(e => e.stage === 'payment_required').execution_id, null);
    const serialized = JSON.stringify(events);
    for (const secret of [tx, signed.headers.get('x-payment-signature'), payer, 'Example supplied text', 'secret-query']) assert.ok(!serialized.includes(secret), secret);
    assert.ok(events.every(e => e.attempt_id && e.code_version === '1.15.0' && e.engine_version));
  } finally { console.log = originalLog; }
}));
