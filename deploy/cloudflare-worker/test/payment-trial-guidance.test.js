import test from 'node:test';
import assert from 'node:assert/strict';
import { generateX402PaymentResponse } from '../src/settlement.js';
import { x402RequiredResponse } from '../src/x402-v2.js';
import { outputTrialTerms } from '../src/output-trial.js';
import { handleRequest } from '../src/index.js';

const origin = 'https://example.test';
const profile = 'agent_output_verification';
const fixture = {
  claims: [{ claim_id: 'c1', claim: 'Supplied text', support_level: 'direct', evidence_ids: ['e1'] }],
  evidence: [{ evidence_id: 'e1', source_id: 'synthetic', text: 'Supplied text' }]
};

test('402 body carries runtime-derived free trial guidance when the trial is enabled', async () => {
  const trial = outputTrialTerms(profile);
  const request = new Request(origin + '/v1/agent-output/verification', { method: 'POST' });
  const response = generateX402PaymentResponse(profile, request, {}, 'payment_required', trial);
  assert.equal(response.status, 402);
  const body = await response.json();
  assert.equal(body.error, 'payment_required');
  assert.match(body.message, /free_trial/);
  assert.equal(body.free_trial.available, true);
  assert.equal(body.free_trial.payment_required, false);
  assert.equal(body.free_trial.tool, trial.tool);
  assert.equal(body.free_trial.attempts_per_network, trial.attempts_per_network);
  assert.equal(body.free_trial.mcp_tool, 'free_trial');
  assert.equal(body.free_trial.mcp_status_tool, 'free_trial_status');
  assert.equal(body.free_trial.terms_request.url, origin + trial.endpoint);
  assert.equal(body.free_trial.availability_request.url, origin + trial.availability_endpoint);
  assert.equal(body.free_trial.input_preflight.endpoint, '/v1/validate-input');
  // Payment instructions stay intact alongside the free alternative.
  assert.match(body.x402.how_to_pay, /X-Payment-Tx/);
});

test('402 body asserts no trial when the deployment has none enabled', async () => {
  const request = new Request(origin + '/v1/agent-output/verification', { method: 'POST' });
  const response = generateX402PaymentResponse(profile, request, {}, 'payment_required');
  const body = await response.json();
  assert.equal('free_trial' in body, false);
  assert.equal(body.message, 'Autonomous M2M settlement required for direct execution.');
});

test('standard x402 MCP admission derives trial guidance from the passed terms only', async () => {
  const request = new Request(origin + '/mcp/agent', { method: 'POST' });
  const body = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'agent_output_verification', arguments: {} } };
  const legacy = Response.json({ code: 'payment_required' }, { status: 402 });

  const withTrial = x402RequiredResponse(request, body, 0.05, legacy, outputTrialTerms(profile));
  const admission = (await withTrial.json()).result._meta['com.agenda/admission'];
  assert.match(admission.next_step, /free_trial_status/);
  assert.equal(admission.free_trial.tool, 'agent_output_verification');

  const withoutTrial = x402RequiredResponse(request, body, 0.05, legacy);
  const refused = (await withoutTrial.json()).result._meta['com.agenda/admission'];
  assert.match(refused.next_step, /does not advertise a free trial/);
  assert.equal('free_trial' in refused, false);
});

test('live 402 wiring passes trial terms only when the deployment enables the trial', async () => {
  for (const [env, expected] of [
    [{ AGENT_PROFILE: profile, BILLING_MODE: 'pay_per_call', OUTPUT_VERIFICATION_TRIAL: '1', VIZIER_DISABLED: '1' }, true],
    [{ AGENT_PROFILE: profile, BILLING_MODE: 'pay_per_call', VIZIER_DISABLED: '1' }, false]
  ]) {
    const response = await handleRequest(new Request(origin + '/v1/agent-output/verification',
      { method: 'POST', body: JSON.stringify(fixture) }), env);
    assert.equal(response.status, 402);
    const body = await response.json();
    assert.equal(Boolean(body.free_trial), expected);
    if (expected) {
      assert.equal(body.free_trial.tool, 'agent_output_verification');
      assert.equal(body.first_call.free_trial.tool, 'agent_output_verification');
    }
  }
});
