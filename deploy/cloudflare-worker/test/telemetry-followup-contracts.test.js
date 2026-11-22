import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest, handleJsonRpc} from '../src/index.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';

async function quiet(action) {
  const original = console.log;
  console.log = () => {};
  try { return await action(); } finally { console.log = original; }
}

test('Corridor malformed JSON refusal already carries a usable wire example before payment', () => quiet(async () => {
  const env = {AGENT_PROFILE: 'corridor_sanctions_assistant', BILLING_MODE: 'pay_per_call', VIZIER_DISABLED: '1'};
  const response = await handleRequest(new Request('https://example.test/message/send', {
    method: 'POST', headers: {'content-type': 'application/octet-stream'}, body: '{broken'
  }), env);
  const refusal = await response.json();
  assert.equal(response.status, 400);
  assert.equal(refusal.validation.category, 'invalid_json');
  assert.equal(refusal.input_diagnostics.failure, 'malformed_json');
  assert.equal(refusal.input_diagnostics.media_type, 'other');
  const wire = refusal.request_hint.wire_request;
  assert.equal(wire.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(wire.body), refusal.request_hint.example_request);
  assert.match(refusal.request_hint.retry_instruction, /illustrative/);
  const repaired = await handleRequest(new Request(wire.url, wire), env);
  assert.notEqual(repaired.status, 400);
  assert.ok([200, 402].includes(repaired.status));
}));

test('CIS onboarding escalation completes and names missing evidence with repair and recheck steps', () => quiet(async () => {
  // Synthetic published evidence only. This is not the caller's unrecoverable request body.
  const request = structuredClone(WORKED_EXAMPLES.cis_secondary_sanctions.request);
  const result = await handleJsonRpc({jsonrpc: '2.0', id: 'escalation-regression', method: 'message/send',
    params: {message: {data: request}}}, new Request('https://cis-secondary-sanctions.example.test/message/send'),
  {AGENT_PROFILE: 'cis_secondary_sanctions', OPENSANCTIONS_DISABLED: '1', VIZIER_DISABLED: '1', LIVE_RETRIEVAL_ENABLED: '0'});
  assert.equal(result.result.status.state, 'TASK_STATE_COMPLETED');
  const response = result.result.metadata.response;
  assert.equal(response.triage_recommendation, 'escalate_before_onboarding');
  assert.equal(response.authorization_granted, false);
  assert.equal(response.human_review_required, true);
  const missing = response.minimum_sources_before_review;
  assert.ok(missing.length > 0);
  for (const source of missing) {
    const issue = response.remediation.issues.find(item => item.machine_key === source);
    assert.ok(issue, source);
    assert.equal(issue.field, '/dated_sources');
    assert.equal(issue.repair.action, 'supply_or_correct_input');
    assert.equal(issue.repair.example.source_type, source);
    assert.equal(issue.repair.example_is_evidence, false);
    assert.equal(issue.recheck.operation, 'cis_secondary_sanctions_exposure');
    assert.equal(issue.recheck.requires_changed_evidence_or_authoritative_state, true);
    assert.ok(result.result.artifacts[0].parts[0].text.includes(source));
  }
  assert.equal(response.remediation.retry_unchanged_evidence, false);
}));
