import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.js';
import { readFileSync } from 'node:fs';

const env = { AGENT_PROFILE: 'agent_output_verification', BILLING_MODE: 'pay_per_call', WORKER_FREE_TRIAL: '1', VIZIER_DISABLED: '1' };
async function invoke(method, { path = '/mcp/agent', configured = env, params = {}, headers = {}, jsonrpc = '2.0' } = {}) {
  const events = [], original = console.log;
  console.log = value => { if (value?.event) events.push(value); };
  try {
    const response = await handleRequest(new Request('https://example.test' + path, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ jsonrpc, id: 'private-request-id', method, params })
    }), configured);
    return { response, body: await response.json(), events };
  } finally { console.log = original; }
}

test('actual MCP discovery records successful connection steps without request content', async () => {
  for (const [method, step] of [['initialize', 'mcp_initialize'], ['server/discover', 'mcp_server_discover'], ['tools/list', 'mcp_tools_list']]) {
    const { response, body, events } = await invoke(method, { params: { clientInfo: { name: 'private-client-secret' } } });
    assert.equal(response.status, 200);
    assert.ok(body.result);
    const funnel = events.filter(e => e.event === 'agenda_intelligence_a2a_funnel');
    assert.equal(funnel.length, 1, method);
    assert.equal(funnel[0].step, step);
    assert.equal(funnel[0].request_kind, 'mcp_discovery');
    assert.equal(funnel[0].mcp_method, method);
    assert.equal(funnel[0].rpc_outcome, 'success');
    assert.equal(funnel[0].agent_profile, env.AGENT_PROFILE);
    assert.equal(funnel[0].event_version, 5);
    if (method === 'tools/list') assert.equal(funnel[0].tool_count, body.result.tools.length);
    assert.ok(!JSON.stringify(events).includes('private-client-secret'));
    assert.ok(!JSON.stringify(events).includes('private-request-id'));
    assert.ok(!events.some(e => e.event === 'agenda_intelligence_a2a_usage' || e.stage));
  }
});

test('protocol refusal remains a refusal and does not become a successful connection', async () => {
  const { body, events } = await invoke('tools/list', { jsonrpc: 'wrong-private-version' });
  assert.ok(body.error);
  const row = events.find(e => e.step === 'mcp_tools_list');
  assert.ok(row);
  assert.equal(row.rpc_outcome, 'protocol_error');
  assert.equal(row.tool_count, null);
  assert.ok(!JSON.stringify(events).includes('wrong-private-version'));
});

test('all hosted discovery endpoints stay open and owner checks retain exclusion', async () => {
  for (const path of ['/mcp', '/mcp/agent', '/mcp/output-verification']) {
    const { response, events } = await invoke('tools/list', { path, configured: { ...env, AGENT_OUTPUT_VERIFICATION_API_KEY: 'private-access-key' }, headers: { 'x-client-id': 'agenda-owner-manual' } });
    assert.equal(response.status, 200);
    assert.equal(events.find(e => e.step === 'mcp_tools_list')?.caller_kind, 'owner_synthetic');
    assert.ok(!JSON.stringify(events).includes('private-access-key'));
  }
});

test('arbitrary methods and tools/call do not masquerade as discovery', async () => {
  for (const method of ['private-method-secret', 'tools/call', ['tools/list'], '__proto__']) {
    const { events } = await invoke(method);
    assert.ok(!events.some(e => String(e.step).startsWith('mcp_')));
    assert.ok(!JSON.stringify(events).includes('private-method-secret'));
  }
});

test('each published profile records its own open MCP tool listing', async () => {
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const profiles = [...new Set([...toml.matchAll(/^AGENT_PROFILE\s*=\s*"([^"]+)"/gm)].map(match => match[1]))];
  assert.equal(profiles.length, 12);
  for (const profile of profiles) {
    const { response, body, events } = await invoke('tools/list', { configured: { ...env, AGENT_PROFILE: profile } });
    assert.equal(response.status, 200, profile);
    assert.ok(body.result.tools.length, profile);
    const row = events.find(e => e.step === 'mcp_tools_list');
    assert.ok(row, profile);
    assert.equal(row.agent_profile, profile);
    assert.equal(row.tool_count, body.result.tools.length, profile);
  }
});

test('failed telemetry never changes a valid discovery response', async () => {
  const digest = crypto.subtle.digest, warn = console.warn;
  crypto.subtle.digest = async () => { throw new Error('synthetic telemetry failure'); };
  console.warn = () => {};
  try {
    const { response, body, events } = await invoke('tools/list', { headers: { 'user-agent': 'Agenda-Ecosystem-Verification/1.0' } });
    assert.equal(response.status, 200);
    assert.ok(body.result.tools.length);
    assert.equal(events.length, 0);
  } finally { crypto.subtle.digest = digest; console.warn = warn; }
});

test('advertised x402 free allowance agrees with the actual product policy', async () => {
  for (const [profile, allowance] of [['agent_output_verification', 5], ['agentic_interaction_trust', 2]]) {
    const response = await handleRequest(new Request('https://example.test/.well-known/x402'), { ...env, AGENT_PROFILE: profile });
    const body = await response.json();
    assert.ok(body.pricing_scope.includes(`${allowance} free trial attempts`));
  }
});
