import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleRequest } from '../src/index.js';
import { mcpToolsForProfile } from '../src/mcp.js';

const origin = 'https://example.test';
const profiles = [...fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8').matchAll(/^AGENT_PROFILE = "(.*)"/gm)].map(m => m[1]);
const payment = { 'x-payment-tx': '0x' + '1'.repeat(64) };
const CANARY = 'canary-value-do-not-echo';

async function post(profile, path, body, headers = {}) {
  const env = { AGENT_PROFILE: profile, BILLING_MODE: 'pay_per_call', VIZIER_DISABLED: '1' };
  const old = console.log; console.log = () => {};
  try {
    const response = await handleRequest(new Request(origin + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }), env);
    const text = await response.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: response.status, json, text, data: json?.error?.data || json };
  } finally { console.log = old; }
}
const mcpCall = (name, args) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

test('covers all 12 profiles', () => assert.equal(profiles.length, 12));

for (const profile of profiles) {
  test(`${profile}: MCP invalid paid request is self-correcting for each paid tool`, async () => {
    let checked = 0;
    for (const tool of mcpToolsForProfile(profile).map(t => t.name)) {
      for (const args of [{}, { [CANARY]: CANARY }]) {
        const r = await post(profile, '/mcp', mcpCall(tool, args), payment);
        const d = r.data;
        if (d?.code !== 'invalid_paid_request') continue; // free or non-validation outcome: untouched
        checked++;
        assert.equal(r.status, 400);
        const sc = d.self_correction;
        assert.ok(sc, `${profile}/${tool} has self_correction`);
        assert.equal(sc.tool, tool);
        assert.equal(sc.evaluation_performed, false);
        assert.ok(sc.failed.length > 0 && sc.failed.every(f => f.problem));
        assert.ok(!r.text.includes(CANARY + CANARY) && !JSON.stringify(sc).includes(`"${CANARY}":"`), 'no value echo');
        assert.ok(!JSON.stringify(sc.failed).includes('"' + CANARY + '"') || args[CANARY] === undefined);
        if (sc.minimal_valid_example) {
          assert.equal(sc.minimal_valid_example.params.name, tool, 'example matches the addressed tool');
          assert.equal(JSON.parse(sc.wire_request.body).params.name, tool);
          // valid-sample recheck: the example is no longer an input-validation failure
          const again = await post(profile, '/mcp', sc.minimal_valid_example, payment);
          assert.notEqual(again.data?.code, 'invalid_paid_request', `${profile}/${tool} example passes input validation`);
        }
      }
    }
    assert.ok(checked > 0, `${profile} produced at least one validation refusal`);
  });

  test(`${profile}: A2A and REST refusals are self-correcting without changing status`, async () => {
    const a2a = await post(profile, '/message/send', { jsonrpc: '2.0', id: 1, method: 'SendMessage', params: { message: { messageId: 'm', role: 'ROLE_USER', parts: [{ text: CANARY }] } } }, { ...payment, 'a2a-version': '1.0' });
    if (a2a.data?.code === 'invalid_paid_request') {
      assert.equal(a2a.status, 400);
      assert.equal(a2a.data.self_correction.transport, 'a2a');
      assert.ok(a2a.data.self_correction.failed.length > 0);
      assert.ok(!JSON.stringify(a2a.data.self_correction).includes(CANARY));
      const again = await post(profile, '/message/send', a2a.data.self_correction.minimal_valid_example, { ...payment, 'a2a-version': '1.0' });
      assert.notEqual(again.data?.code, 'invalid_paid_request');
    }
    const rest = await post(profile, '/v1/agent-output/verification', { [CANARY]: CANARY }, payment);
    if (profile === 'agent_output_verification') {
      assert.equal(rest.status, 400);
      assert.equal(rest.data.self_correction.transport, 'rest');
      assert.ok(rest.data.self_correction.minimal_valid_example);
    }
  });
}

test('A2A capability selects the matching tool example, not the profile default', async () => {
  const r = await post('agent_output_verification', '/message/send', { jsonrpc: '2.0', id: 1, method: 'SendMessage',
    params: { capability: 'decision_check', message: { messageId: 'm', role: 'ROLE_USER', parts: [{ text: 'hi' }] } } }, { ...payment, 'a2a-version': '1.0' });
  assert.equal(r.status, 400);
  assert.equal(r.data.self_correction.tool, 'decision_check');
  assert.equal(r.data.request_hint.capability, 'decision_check');
  assert.equal(r.data.request_hint.example_request.params.capability, 'decision_check');
  const again = await post('agent_output_verification', '/message/send', r.data.self_correction.minimal_valid_example, { ...payment, 'a2a-version': '1.0' });
  assert.notEqual(again.data?.code, 'invalid_paid_request');
});

test('field-level failures name the field and never echo caller values', async () => {
  const r = await post('agent_output_verification', '/mcp', mcpCall('agent_output_verification', { bogus_field: CANARY }), payment);
  const sc = r.data.self_correction;
  assert.ok(sc.failed.some(f => f.field === '/bogus_field' && f.code === 'unknown_field'));
  assert.ok(!JSON.stringify(sc).includes(CANARY));
});

test('empty request lists each required field and the missing location', async () => {
  const r = await post('cis_secondary_sanctions', '/mcp', mcpCall('cis_secondary_sanctions_exposure', {}), payment);
  const sc = r.data.self_correction;
  assert.ok(sc.required_fields.length > 0);
  for (const key of sc.required_fields) assert.ok(sc.failed.some(f => f.field === '/' + key && f.code === 'required'), key);
  assert.match(sc.expected_location, /params\.arguments/);
});
