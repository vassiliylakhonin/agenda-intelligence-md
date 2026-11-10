import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBankabilityScreen } from '../src/corridor_bankability.js';
import { outputTrialEnabled, outputTrialTerms } from '../src/output-trial.js';
import { handleRequest } from '../src/index.js';

const origin = 'https://teaser.example';
const fixture = { project_name: 'Synthetic trial guidance', corridor_leg: 'Aktau-Baku', capex_usd_m: 10, ifi_debt_usd_m: 5, dscr_min: 1.4 };

test('teaser challenge carries runtime-derived trial guidance when the deployment enables a trial', () => {
  const trial = outputTrialTerms('agenda');
  const data = generateBankabilityScreen(fixture, false, origin, origin, trial);
  assert.equal(data.unlocked_full_dossier, false);
  const free = data.free_trial;
  assert.equal(free.available, true);
  assert.equal(free.payment_required, false);
  // The trial never covers this dossier; the block must say so.
  assert.equal(free.covers_full_dossier, false);
  assert.equal(free.tool, trial.tool);
  assert.equal(free.attempts_per_network, trial.attempts_per_network);
  assert.equal(free.mcp_tool, 'free_trial');
  assert.equal(free.mcp_status_tool, 'free_trial_status');
  assert.equal(free.terms_request.url, origin + trial.endpoint);
  assert.equal(free.availability_request.url, origin + trial.availability_endpoint);
  assert.equal(free.worked_example_url, origin + trial.worked_example_url);
  assert.match(free.instruction, /full dossier has no free evaluation/);
  assert.match(free.instruction, /corridor_bankability_screen and other tools are not included/);
  // Payment instructions stay intact alongside the free alternative.
  assert.match(data.x402_unlock.how_to_unlock, /X-Payment-Tx/);
  assert.equal(data.x402_unlock.amount_usdc, 25);
});

test('teaser challenge asserts no trial when the deployment has none enabled', () => {
  const data = generateBankabilityScreen(fixture, false, origin, origin);
  assert.equal('free_trial' in data, false);
  assert.match(data.x402_unlock.how_to_unlock, /X-Payment-Tx/);
});

test('teaser omits trial guidance once the dossier is unlocked', () => {
  const data = generateBankabilityScreen(fixture, true, origin, origin, outputTrialTerms('agenda'));
  assert.equal(data.unlocked_full_dossier, true);
  assert.equal('free_trial' in data, false);
});

test('live REST teaser wiring passes trial terms only when the deployment enables the trial', async () => {
  for (const [env, expected] of [
    [{ AGENT_PROFILE: 'agenda', BILLING_MODE: 'pay_per_call', WORKER_FREE_TRIAL: '1', VIZIER_DISABLED: '1' }, true],
    [{ AGENT_PROFILE: 'agenda', BILLING_MODE: 'pay_per_call', VIZIER_DISABLED: '1' }, false]
  ]) {
    const response = await handleRequest(new Request(origin + '/v1/corridor-bankability/screen', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fixture)
    }), env);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.unlocked_full_dossier, false);
    assert.equal('free_trial' in data, expected);
    if (expected) {
      assert.equal(data.free_trial.tool, outputTrialTerms('agenda').tool);
      assert.equal(data.free_trial.covers_full_dossier, false);
      assert.equal(data.free_trial.terms_request.url, origin + outputTrialTerms('agenda').endpoint);
    }
  }
});

test('live MCP teaser wiring derives the same trial guidance from runtime config', async () => {
  for (const [env, expected] of [
    [{ AGENT_PROFILE: 'agenda', BILLING_MODE: 'pay_per_call', WORKER_FREE_TRIAL: '1', VIZIER_DISABLED: '1' }, true],
    [{ AGENT_PROFILE: 'agenda', BILLING_MODE: 'pay_per_call', VIZIER_DISABLED: '1' }, false]
  ]) {
    const response = await handleRequest(new Request(origin + '/mcp/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'corridor_bankability_screen', arguments: fixture } })
    }), env);
    assert.equal(response.status, 200);
    const body = await response.json();
    const data = body.result.structuredContent
      || JSON.parse(body.result.content.find(part => part.mediaType === 'application/json' || part.type === 'resource')?.text
        || body.result.content.map(part => part.text).find(text => text && text.includes('free_preview_completed')));
    assert.equal('free_trial' in data, expected);
    if (expected) {
      assert.equal(data.free_trial.tool, outputTrialTerms('agenda').tool);
      assert.equal(data.free_trial.covers_full_dossier, false);
    }
  }
});
