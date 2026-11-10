import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.js';

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

test('REST schema rejection carries field-level repair hints and a free recheck', async () => {
  const { response, events } = await capture('/v1/agent-output/verification', { private_text: 'do-not-log' });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.code, 'invalid_paid_request');
  assert.equal(data.validation.category, 'schema_validation_failed');
  assert.ok(Array.isArray(data.remediation.issues) && data.remediation.issues.length > 0);
  for (const issue of data.remediation.issues) {
    assert.ok(issue.field && issue.problem);
    assert.equal(issue.repair.action, 'supply_or_correct_input');
  }
  assert.equal(data.remediation.evaluation_unchanged, true);
  assert.equal(data.free_recheck.mcp_tool, 'validate_input');
  assert.equal(data.free_recheck.endpoint, '/v1/validate-input');
  assert.equal(data.free_recheck.evaluation_performed, false);
  assert.equal(data.free_recheck.attempt_consumed, false);
  assert.equal(data.free_recheck.payment_required, false);
  assert.ok(data.request_hint);
  // Guidance names published fields, never caller-supplied values.
  assert.ok(!JSON.stringify(data).includes('do-not-log'));
  assert.ok(!JSON.stringify(events).includes('do-not-log'));
});

test('MCP tools/call schema rejection exposes the same repair hints inside the JSON-RPC error', async () => {
  const { response } = await capture('/mcp', { jsonrpc: '2.0', id: 7, method: 'tools/call',
    params: { name: 'agent_output_verification', arguments: { bogus_field: 1 } } });
  assert.equal(response.status, 400);
  const envelope = await response.json();
  assert.equal(envelope.error.code, -32602);
  const data = envelope.error.data;
  assert.equal(data.code, 'invalid_paid_request');
  assert.equal(data.validation.category, 'schema_validation_failed');
  assert.ok(data.remediation.issues.length > 0);
  assert.equal(data.remediation.issues[0].code, 'unknown_field');
  assert.equal(data.remediation.issues[0].machine_key, 'bogus_field');
  assert.equal(data.remediation.issues[0].repair.example.op, 'remove');
  assert.equal(data.free_recheck.attempt_consumed, false);
});

test('protocol-version refusals keep request_hint without an inapplicable schema recheck', async () => {
  const { response } = await capture('/message/send', { jsonrpc: '2.0', id: 1, method: 'SendMessage', params: {} },
    { 'a2a-version': '0.3.0' });
  assert.equal(response.status, 400);
  const data = (await response.json()).error.data;
  assert.equal(data.validation.category, 'unsupported_protocol');
  assert.equal('free_recheck' in data, false);
  assert.ok(data.request_hint);
});
