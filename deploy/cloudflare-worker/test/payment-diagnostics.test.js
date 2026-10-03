import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, agentCard, GATE_REQUEST_GUIDES, DIRECT_V1_ROUTES } from '../src/index.js';
import { PAYMENT_CLIENT_SCRIPT } from '../src/payment-client.js';

const origin = 'https://example.test';
const env = { AGENT_PROFILE: 'agent_output_verification', BILLING_MODE: 'pay_per_call', VIZIER_DISABLED: '1' };
async function capture(path, body, headers = {}) {
  const events = [], old = console.log;
  console.log = value => { if (value?.event === 'agenda_intelligence_payment') events.push(value); };
  try {
    const response = await handleRequest(new Request(origin + path, { method: 'POST', headers, body: JSON.stringify(body) }), env);
    return { response, events };
  } finally { console.log = old; }
}

test('early protocol refusal retains deployment profile and bounded validation category', async () => {
  const { response, events } = await capture('/message/send', { jsonrpc: '2.0', id: 1, method: 'SendMessage', params: {} }, { 'a2a-version': '0.3.0' });
  assert.equal(response.status, 400);
  assert.ok(events.every(e => e.agent_profile === env.AGENT_PROFILE));
  const rejected = events.find(e => e.stage === 'payment_rejected');
  assert.deepEqual(rejected.validation, { category: 'unsupported_protocol', error_count: 1 });
  assert.equal(rejected.minimum_usdc, null);
});

test('browser owner opt-in marks same-origin evaluation and example headers only', () => {
  const window = { location: { href: origin + '/?owner_test=1', origin }, agendaExampleTraceId: 'example' };
  const headers = new Function('window', PAYMENT_CLIENT_SCRIPT + '; return agendaTelemetryHeaders;')(window);
  assert.equal(headers('/v1/agent-output/verification', {})['x-client-id'], 'agenda-owner-manual');
  assert.equal(headers('/telemetry/worked-example', {})['x-client-id'], 'agenda-owner-manual');
  assert.deepEqual(headers('https://other.test/', {}), {});
  window.location.href = origin + '/';
  assert.equal(headers('/mcp', {})['x-client-id'], undefined);
});

test('owner landing marker is telemetry only and does not grant free evaluation', async () => {
  const { response, events } = await capture('/v1/agent-output/verification?owner_test=1', {});
  assert.equal(response.status, 400);
  assert.equal(events[0].caller_kind, 'owner_synthetic');
});

test('invalid structured input has diagnostics without body, validator messages or secrets', async () => {
  const { response, events } = await capture('/v1/agent-output/verification?secret=query', { private_text: 'do-not-log' });
  assert.equal(response.status, 400);
  const rejected = events.find(e => e.stage === 'payment_rejected');
  assert.equal(rejected.validation.category, 'missing_structured_request');
  assert.ok(rejected.validation.error_count > 0);
  assert.ok(!JSON.stringify(events).includes('do-not-log'));
  assert.ok(!JSON.stringify(events).includes('secret'));
});

test('explicit owner marker excludes manual browser tests without changing payment admission', async () => {
  const fixture = { claims: [{ claim_id: 'c1', claim: 'Supplied text', support_level: 'direct', evidence_ids: ['e1'] }], evidence: [{ evidence_id: 'e1', source_id: 'synthetic', text: 'Supplied text' }] };
  for (const headers of [{ 'x-client-id': 'agenda-owner-manual', 'user-agent': 'Mozilla/5.0' }, { 'user-agent': 'curl/8' }]) {
    const { response, events } = await capture('/v1/agent-output/verification', fixture, headers);
    assert.equal(response.status, 402);
    assert.equal(events[0].caller_kind, headers['x-client-id'] ? 'owner_synthetic' : 'external');
  }
});

test('all fleet public A2A examples and landing REST inputs pass paid admission validation', async () => {
  const profiles = ['agenda', 'kazakhstan', 'cis_secondary_sanctions', 'agentic_interaction_trust',
    'agent_output_verification', 'agent_financial_guard', 'm2m_escrow_arbiter', 'gulf_maritime_exposure',
    'market_entry_readiness', 'critical_minerals_due_diligence', 'dual_use_technology_export', 'corridor_sanctions_assistant'];
  const old = console.log; console.log = () => {};
  try {
    for (const profile of profiles) {
      const configured = { ...env, AGENT_PROFILE: profile };
      const example = agentCard(new Request(origin + '/'), configured).x_agenda_intelligence.a2a_send_message_example;
      const response = await handleRequest(new Request(example.endpoint, { method: 'POST', headers: example.headers, body: JSON.stringify(example.request) }), configured);
      assert.ok([200, 402].includes(response.status), `${profile} A2A: ${response.status} ${await response.text()}`);
    }
    for (const [path, route] of Object.entries(DIRECT_V1_ROUTES)) {
      if (path.endsWith('/batch') || path.endsWith('/pre-action-check')) continue;
      const guide = GATE_REQUEST_GUIDES[route.guideProfile];
      const profile = route.guideProfile === 'kazakhstan_market_entry_readiness' ? 'market_entry_readiness' : route.guideProfile;
      const response = await handleRequest(new Request(origin + path, { method: 'POST', body: JSON.stringify(guide.example) }), { ...env, AGENT_PROFILE: profile });
      assert.equal(response.status, 402, `${path}: ${response.status} ${await response.text()}`);
    }
  } finally { console.log = old; }
});
