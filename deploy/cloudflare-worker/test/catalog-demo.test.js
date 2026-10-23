import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, agentCard, toSpecWireCard } from '../src/index.js';
import { CATALOG_DEMO_PROMPT, isCatalogDemo } from '../src/catalog-demo.js';
import { WORKED_EXAMPLES } from '../src/worked-examples.js';
import { validateAgentCard } from '../scripts/verify-agent-card.js';

const origin = 'https://example.test';
const headers = {'content-type': 'application/json', 'a2a-version': '1.0', 'x-client-id': 'agenda-owner-catalog-demo-test'};
const requestBody = () => ({jsonrpc: '2.0', id: 'saved-example', method: 'SendMessage', params: {
  message: {messageId: 'saved-example-message', role: 'user', parts: [{text: CATALOG_DEMO_PROMPT}]}
}});
const send = (body, env, extraHeaders = {}) => handleRequest(new Request(origin + '/message/send', {
  method: 'POST', headers: {...headers, ...extraHeaders}, body: JSON.stringify(body)
}), env);
const baseEnv = {BILLING_MODE: 'pay_per_call', WORKER_FREE_TRIAL: '1', X402_STANDARD: '1'};

test('all twelve catalog previews return actual saved fixtures without evaluation, storage, payment or upstream calls', async () => {
  const log = console.log, fetch = globalThis.fetch, events = [];
  console.log = event => events.push(event);
  globalThis.fetch = () => { throw new Error('A saved example must not fetch'); };
  const forbiddenStore = new Proxy({}, {get() {throw new Error('A saved example must not use allowance or task storage');}});
  try {
    for (const profile of Object.keys(WORKED_EXAMPLES)) {
      const env = {...baseEnv, AGENT_PROFILE: profile, PAYMENT_LEDGER: forbiddenStore, AGENDA_USAGE: forbiddenStore};
      const card = agentCard(new Request(origin), env);
      assert.deepEqual(validateAgentCard(toSpecWireCard(card)), [], profile);
      assert.equal(card.skills[0].examples[0], CATALOG_DEMO_PROMPT);
      const response = await send(requestBody(), env);
      assert.equal(response.status, 200, profile);
      assert.equal(response.headers.get('payment-required'), null);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json(), task = body.result.task;
      assert.equal(body.id, 'saved-example');
      assert.equal(task.status.state, 'TASK_STATE_COMPLETED');
      assert.equal(task.metadata.operation, 'worked_example');
      assert.equal(task.metadata.evaluation_performed, false);
      assert.equal(task.metadata.attempt_consumed, false);
      assert.equal(task.metadata.authorization_granted, false);
      assert.equal(task.metadata.task_persisted, false);
      const parts = task.artifacts[0].parts;
      const data = parts.find(part => part.data).data;
      assert.deepEqual(data.example, WORKED_EXAMPLES[profile]);
      assert.equal(data.next.review_url, origin + '/');
      assert.match(parts[0].text, /Precomputed synthetic example/);
      assert.match(parts[0].text, /Human review is required/);
      assert.ok(data.next.trial_terms_url.startsWith(origin + '/v1/'));
      if (profile === 'agent_output_verification') {
        assert.match(parts[0].text, /missing-sales-ledger/);
        assert.match(parts[0].text, /verify_before_relay/);
      }
    }
    assert.equal(events.filter(event => event?.step === 'worked_example').length, 12);
    assert.ok(!events.some(event => ['agenda_intelligence_a2a_usage', 'agenda_intelligence_payment'].includes(event?.event)));
  } finally {console.log = log; globalThis.fetch = fetch;}
});

test('saved previews preserve configured authentication, protocol checks and payment-material refusal', async () => {
  const env = {...baseEnv, AGENT_PROFILE: 'kazakhstan', MIDDLE_CORRIDOR_API_KEY: 'synthetic-local-key'};
  assert.equal((await send(requestBody(), env)).status, 401);
  assert.equal((await send(requestBody(), env, {authorization: 'Bearer synthetic-local-key'})).status, 200);
  const publicEnv = {...baseEnv, AGENT_PROFILE: 'kazakhstan'};
  for (const header of ['x-payment-tx', 'x-payment-signature', 'payment-signature', 'x-payment']) {
    const response = await send(requestBody(), publicEnv, {[header]: 'synthetic-invalid-proof'});
    assert.equal(response.status, 400, header);
    assert.ok(!(await response.json()).result);
  }
  assert.equal((await send(requestBody(), publicEnv, {'a2a-version': '0.3'})).status, 400);
  const missingId = requestBody(); delete missingId.params.message.messageId;
  assert.equal((await send(missingId, publicEnv)).status, 400);
});

test('case data, metadata, continuations, attachments and prompt suffixes never select a saved preview', async () => {
  const mutations = [
    body => {body.params.message.parts[0].text += ' for this confidential customer file';},
    body => {body.params.message.parts[0].data = {claims: ['a supplied claim']};},
    body => {body.params.message.parts.push({data: {claims: ['a supplied claim']}});},
    body => {body.params.message.parts[0].file = {uri: 'https://example.test/private'};},
    body => {body.params.message.contextId = 'existing-context';},
    body => {body.params.message.taskId = 'existing-task';},
    body => {body.params.message.metadata = {capability: 'evaluate'};},
    body => {body.params.request = {claims: ['a supplied claim']};},
    body => {body.params.capability = 'audit_claims';},
    body => {body.params.message.role = 'ROLE_AGENT';},
    body => {body.id = null;}
  ];
  for (const mutate of mutations) {
    const body = requestBody(); mutate(body);
    assert.equal(isCatalogDemo(body), false);
    const response = await send(body, {...baseEnv, AGENT_PROFILE: 'agenda'});
    const actual = await response.json();
    assert.notEqual(actual.result?.task?.metadata?.operation, 'worked_example');
    assert.notEqual(actual.result?.metadata?.operation, 'worked_example');
  }
});

test('saved previews work on legacy and freemium transports without advertising disabled trials', async () => {
  const env = {AGENT_PROFILE: 'agent_output_verification', WORKER_FREE_TRIAL: '0'};
  const modern = await (await send(requestBody(), env)).json();
  assert.equal(modern.result.task.artifacts[0].parts[1].data.next.trial_terms_url, undefined);
  for (const method of ['message/send', 'tasks/send']) {
    const body = requestBody(); body.method = method;
    const response = await send(body, {...env, BILLING_MODE: 'pay_per_call'}, {'a2a-version': '0.3'});
    assert.equal(response.status, 200);
    const actual = await response.json();
    assert.equal(actual.result.kind, 'task');
    assert.equal(actual.result.status.state, 'completed');
    assert.equal(actual.result.metadata.evaluation_performed, false);
  }
});

test('the ordinary structured evaluation still requires paid admission', async () => {
  const env = {...baseEnv, AGENT_PROFILE: 'agent_output_verification'};
  const body = requestBody(); body.params.message.parts = [{data: WORKED_EXAMPLES.agent_output_verification.request, mediaType: 'application/json'}];
  const response = await send(body, env);
  assert.equal(response.status, 402);
  assert.ok(response.headers.get('payment-required'));
  assert.ok(!(await response.json()).result);
});
