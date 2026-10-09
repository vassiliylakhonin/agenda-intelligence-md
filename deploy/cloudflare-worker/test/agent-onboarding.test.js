import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, verificationStatus } from '../src/index.js';
import { PROFILE_REGISTRY } from '../src/profiles.js';
const origin = 'https://example.test';
const get = async (path, env) => (await handleRequest(new Request(origin + path), env)).json();
const rpc = async (env) => (await handleRequest(new Request(origin + '/mcp/agent', {
  method:'POST', body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'}) }), env)).json();

test('every profile advertises its serving catalog and compatible endpoint with factual retention', async () => {
  for (const profile of Object.keys(PROFILE_REGISTRY)) {
    const env = { AGENT_PROFILE:profile, BILLING_MODE:'pay_per_call' };
    const listed = await rpc(env);
    assert.ok(listed.result, profile);
    const card = await get('/.well-known/mcp/server-card.json', env);
    assert.deepEqual(card.tools, listed.result.tools);
    assert.equal(card.transports.find(t=>t.type==='streamable-http').url, origin+'/mcp/agent');
    assert.equal(card.security_posture.zero_retention_guarantee, false);
    assert.equal(card.security_posture.pricing_url, origin+'/.well-known/x402');
    assert.equal(card.security_posture.engagement_tiers, undefined);
    assert.equal(card.related.fleet_directory, origin+'/.well-known/fleet.json');
  }
});

test('free directory has accurate billing metadata and is reachable without calling a paid tool', async () => {
  const env = { AGENT_PROFILE:'agenda', BILLING_MODE:'pay_per_call' };
  const tools = (await rpc(env)).result.tools;
  const free = tools.find(t=>t.name==='fleet_directory');
  assert.equal(free._meta['com.agenda/readiness'].access.base_call_price, 'free');
  assert.doesNotMatch(free.description, /Calls require.*payment/);
  assert.equal(tools.find(t=>t.name==='strategic_risk_triage')._meta['com.agenda/readiness'].access.base_call_price, 'paid');
  const fleet = await get('/.well-known/fleet.json', env);
  assert.equal(fleet.total_gates, 12);
  assert.equal(new Set(fleet.gates.map(g=>g.mcp_endpoint)).size, 12);
  assert.ok(fleet.gates.every(g=>g.mcp_endpoint===g.canonical_endpoint+'/mcp/agent'));
  const agents = await get('/.well-known/agents.json', env);
  assert.equal(agents.fleet_directory, origin+'/.well-known/fleet.json');
});

test('secondary discovery and verifier handoff lead to the compatible MCP endpoint', async () => {
  const env={AGENT_PROFILE:'agenda',BILLING_MODE:'pay_per_call'};
  const brick=await get('/.well-known/brick-blue.json',env);
  assert.equal(brick.endpoints.mcp,origin+'/mcp/agent');
  const api=await get('/api/openapi.json',env);
  assert.match(api.paths['/mcp/agent'].post.responses[200].description,/unevaluated/);
  assert.ok(api.paths['/.well-known/fleet.json'].get);
  const pricing=await get('/.well-known/x402',env);
  assert.ok(pricing);
  assert.equal(verificationStatus('agenda').verifier.mcp_endpoint, 'https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev/mcp/agent');
});
