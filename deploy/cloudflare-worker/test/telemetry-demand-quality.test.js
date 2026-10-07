import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, GATE_REQUEST_GUIDES } from '../src/index.js';
import { createTelemetry } from '../src/telemetry.js';
import { TELEMETRY_CLIENT_SCRIPT } from '../src/payment-client.js';
import vm from 'node:vm';

const origin = 'https://example.test';
const env = { AGENT_PROFILE: 'agent_output_verification', BILLING_MODE: 'pay_per_call', VIZIER_DISABLED: '1' };
async function captured(path, body, headers = {}, configured = env) {
  const events = [], old = console.log;
  console.log = e => { if (e?.event) events.push(e); };
  try {
    const response = await handleRequest(new Request(origin+path, {method:'POST', headers, body}), configured);
    return {response, events};
  } finally { console.log = old; }
}

test('invalid paid request has bounded diagnostics and a usable REST example', async () => {
  const {response, events} = await captured('/v1/agent-output/verification', JSON.stringify({secret:'do-not-log'}));
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.validation.category, 'missing_structured_request');
  assert.deepEqual(data.request_hint.example_request, GATE_REQUEST_GUIDES.agent_output_verification.example);
  const good = await captured('/v1/agent-output/verification', JSON.stringify(data.request_hint.example_request));
  assert.equal(good.response.status, 402);
  assert.ok(good.events.some(e => e.stage === 'request_validated'));
  const rejected = events.find(e => e.stage === 'payment_rejected');
  assert.equal(rejected.failure_family, 'input_validation');
  assert.equal(response.headers.get('x-payment-attempt-id'), rejected.attempt_id);
  assert.ok(!JSON.stringify(events).includes('do-not-log'));
});

test('MCP invalid request contains matching JSON-RPC hint that passes admission', async () => {
  const body = {jsonrpc:'2.0', id:'bad', method:'tools/call', params:{name:'agent_output_verification', arguments:{}}};
  const {response} = await captured('/mcp', JSON.stringify(body));
  const data = await response.json();
  assert.equal(data.error.code, -32602);
  const next = await captured('/mcp', JSON.stringify(data.request_hint.example_request));
  assert.equal(next.response.status, 402);
});

test('Financial Guard, Escrow and specialized MCP hints match each input contract', async () => {
  for (const [profile, path] of [
    ['agent_financial_guard','/v1/agent-financial/pre-sign-check'],
    ['m2m_escrow_arbiter','/v1/m2m-escrow/evaluate-dispute']]) {
    const configured = {...env, AGENT_PROFILE:profile};
    const invalid = await captured(path, '{}', {}, configured);
    assert.equal(invalid.response.status, 400);
    const hint = (await invalid.response.json()).request_hint;
    const corrected = await captured(path, JSON.stringify(hint.example_request), {}, configured);
    assert.equal(corrected.response.status, 402);
  }
  for (const [profile, name] of [
    ['agent_financial_guard','agent_financial_pre_sign_check'],
    ['m2m_escrow_arbiter','m2m_escrow_arbitration_ruling'],
    ['agent_output_verification','decision_check'],
    ['cis_secondary_sanctions','cis_secondary_sanctions_batch'],
    ['agenda','corridor_bankability_screen']]) {
    const configured = {...env, AGENT_PROFILE:profile};
    const invalid = await captured('/mcp', JSON.stringify({jsonrpc:'2.0', id:'bad', method:'tools/call', params:{name, arguments:{}}}), {}, configured);
    assert.equal(invalid.response.status, 400, name);
    const hint = (await invalid.response.json()).request_hint;
    const corrected = await captured('/mcp', JSON.stringify(hint.example_request), hint.headers, configured);
    assert.ok([200,402].includes(corrected.response.status), name);
    assert.ok(corrected.events.some(e => e.stage === 'request_validated'), name);
  }
});

test('malformed JSON is measured before evaluation, without body data, and has correlation headers', async () => {
  const {response, events} = await captured('/mcp', '{"secret":"do-not-log"');
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.error.code, -32700);
  assert.equal(data.validation.category, 'invalid_json');
  assert.equal(events.filter(e => e.stage === 'request_received').length, 1);
  const rejected = events.find(e => e.stage === 'payment_rejected');
  assert.equal(rejected.failure_family, 'input_validation');
  assert.equal(rejected.attempt_id, response.headers.get('x-payment-attempt-id'));
  assert.ok(!JSON.stringify(events).includes('do-not-log'));
});

test('owner named clients remain paid tests while generic clients retain unverified origin', async () => {
  const body = JSON.stringify(GATE_REQUEST_GUIDES.agent_output_verification.example);
  for (const ua of ['owner-feedback-synthetic/1.0','Agenda-Fleet-Site-Verification/1.0','python-httpx/1.0']) {
    const {response, events} = await captured('/v1/agent-output/verification', body, {'user-agent':ua});
    assert.equal(response.status, 402);
    assert.equal(events[0].caller_kind, ua.startsWith('python') ? 'external' : 'owner_synthetic');
    assert.equal(events[0].origin_verification, 'unverified');
    assert.equal(events[0].authentication_status, 'unverified');
  }
});

test('catalog usage is separated without asserting success or trusting origin headers', () => {
  const telemetry = createTelemetry({agentProfile:()=> 'agenda', jsonResponse:Response.json,
    AGENSTRY_VERIFICATION_PATHS:[], directRoutes:()=>({})});
  const request = new Request(origin+'/mcp', {headers:{'x-origin-verification':'verified'}});
  assert.equal(telemetry.buildUsageEvent(request, {modules_used:['fleet_directory']}).usage_category, 'catalog');
  assert.equal(telemetry.buildUsageEvent(request, {modules_used:['agent_output_verification']}).usage_category, 'domain');
  assert.equal(telemetry.buildUsageEvent(request, {}).usage_category, 'unclassified');
  assert.equal(telemetry.buildUsageEvent(request, {}).origin_verification, 'unverified');
});

test('only a configured and matched deployment key establishes authentication', async () => {
  const configured = {...env, AGENT_PROFILE:'agentic_interaction_trust', AGENTIC_INTERACTION_TRUST_API_KEY:'private-test-key'};
  const body = JSON.stringify(GATE_REQUEST_GUIDES.agentic_interaction_trust.example);
  for (const headers of [{authorization:'Bearer private-test-key'}, {'x-production-key':'private-test-key'}]) {
    const {response, events} = await captured('/v1/agentic-interaction/trust', body, headers, configured);
    assert.equal(response.status, 402);
    assert.ok(events.length);
    assert.ok(events.every(e => e.authentication_status === 'deployment_key_validated'));
    assert.ok(!JSON.stringify(events).includes('private-test-key'));
  }
  const denied = await captured('/v1/agentic-interaction/trust', body, {'x-origin-verification':'verified'}, configured);
  assert.equal(denied.response.status, 401);
  assert.ok(!denied.events.some(e => e.authentication_status === 'deployment_key_validated'));
});

test('A2A diagnostics supply a protocol-specific example that passes input admission', async () => {
  const invalid = {jsonrpc:'2.0', id:'bad', method:'SendMessage', params:{}};
  const {response} = await captured('/message/send', JSON.stringify(invalid), {'A2A-Version':'1.0'});
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.request_hint.transport, 'a2a');
  const next = await captured('/message/send', JSON.stringify(data.request_hint.example_request), data.request_hint.headers);
  assert.equal(next.response.status, 402);
});

test('oversized bodies are counted as input refusals without logging body data', async () => {
  const {response, events} = await captured('/mcp', 'x'.repeat(1024*1024+1));
  assert.equal(response.status, 413);
  assert.equal((await response.json()).validation.category, 'body_too_large');
  assert.equal(events.find(e => e.stage === 'payment_rejected').failure_family, 'input_validation');
});

test('direct REST console propagates owner purpose and retains trace on correction', async () => {
  const response = await handleRequest(new Request(origin+'/v1/agent-output/verification', {headers:{accept:'text/html'}}), env);
  const html = await response.text();
  assert.ok(html.includes('headers: agendaTelemetryHeaders('));
  assert.ok(html.includes('agendaConsolePaymentTraceId = trace'));
  const context = {URL, window:{location:{href:origin+'/v1/test?owner_test=1', origin}}};
  vm.runInNewContext(TELEMETRY_CLIENT_SCRIPT, context);
  assert.equal(context.agendaTelemetryHeaders('/v1/test', {})['x-client-id'], 'agenda-owner-manual');
  assert.equal(context.agendaTelemetryHeaders('https://elsewhere.test/v1/test', {})['x-client-id'], undefined);
  const calls = [], trace = 'aaaaaaaa-1234-4567-89ab-123456789abc';
  const elements = Object.fromEntries(['btnSend','testStatus','resultBox','jsonPayload'].map(id => [id,{style:{},value:'{}'}]));
  context.document = {getElementById:id => elements[id]};
  context.fetch = async (url, options) => {
    calls.push(options);
    return {ok:false, status:400, headers:new Headers({'x-payment-trace-id':trace}), json:async () => ({code:'invalid_paid_request'})};
  };
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(s => s.includes('async function sendTest'));
  vm.runInNewContext(script, context);
  await context.sendTest({preventDefault(){}});
  elements.jsonPayload.value = JSON.stringify(GATE_REQUEST_GUIDES.agent_output_verification.example);
  await context.sendTest({preventDefault(){}});
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers['x-client-id'], 'agenda-owner-manual');
  assert.equal(calls[0].headers['x-payment-trace-id'], undefined);
  assert.equal(calls[1].headers['x-payment-trace-id'], trace);
  assert.equal(calls[1].body, elements.jsonPayload.value);
});
