import {routingToolForProfile} from '../src/pricing-policy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { agentCard, handleRequest, toSpecWireCard } from '../src/index.js';
import { validateAgentCard } from '../scripts/verify-agent-card.js';

const profiles = ['agentic_interaction_trust', 'cis_secondary_sanctions', 'gulf_maritime_exposure',
  'market_entry_readiness', 'critical_minerals_due_diligence', 'dual_use_technology_export',
  'corridor_sanctions_assistant', 'agent_financial_guard', 'm2m_escrow_arbiter'];
const origin = 'https://example.test';
const resolve = (value, pointer) => pointer.slice(1).split('/').reduce((node, key) => node?.[key], value);

test('every additional skill has an executable existing-result contract, with human review', async () => {
  const log = console.log, fetch = globalThis.fetch;
  console.log = () => {};
  globalThis.fetch = () => { throw new Error('Synthetic discovery tests must not call live upstreams'); };
  try {
    for (const profile of profiles) {
      const env = { AGENT_PROFILE: profile, VIZIER_DISABLED: '1' };
      const card = agentCard(new Request(origin), env);
      assert.equal(card.skills.length, 3, profile);
      assert.deepEqual(validateAgentCard(toSpecWireCard(card)), []);
      const discovery = card.x_agenda_intelligence.skill_invocations;
      assert.equal(discovery.version, '1');
      assert.match(discovery.scope, /same.*evaluation/i);
      assert.equal(discovery.skills.length, 3);
      for (const skill of card.skills.slice(1)) {
        const contract = discovery.skills.find(item => item.skill_id === skill.id);
        assert.ok(contract, skill.id);
        assert.ok(contract.result_pointers.length > 0);
        assert.equal(contract.result_root, '/result/task/metadata/response');
        const example = contract.a2a_example;
        assert.equal(example.endpoint, origin + '/message/send');
        assert.equal(example.request.method, 'SendMessage');
        assert.ok(!('skillId' in example.request.params));
        const response = await handleRequest(new Request(example.endpoint, {
          method: 'POST', headers: example.headers, body: JSON.stringify(example.request)
        }), env);
        assert.equal(response.status, 200, profile + ': ' + await response.clone().text());
        const actual = await response.json();
        assert.equal(actual.result.task.status.state, 'TASK_STATE_COMPLETED');
        assert.equal(actual.result.task.metadata.human_review_required, true);
        const result = resolve(actual, contract.result_root);
        if (skill.id === 'financial-approval-pattern-review') {
          assert.equal(result.financial_guard_verdict.checks.contract_security, false);
          assert.match(result.financial_guard_verdict.violations.join(' '), /infinite token approval/i);
        }
        if (skill.id === 'escrow-artifact-integrity-review') {
          assert.equal(result.arbitration_ruling.check_status.hash, 'passed');
          assert.equal(result.arbitration_ruling.check_status.schema, 'passed');
          assert.equal(result.arbitration_ruling.settlement_authorized, false);
        }
        if (skill.id === 'escrow-deadline-slo-review') {
          assert.equal(result.arbitration_ruling.check_status.deadline, 'failed');
          assert.equal(result.arbitration_ruling.check_status.slo, 'not_evaluated');
          assert.equal(result.arbitration_ruling.settlement_authorized, false);
        }
        for (const pointer of contract.result_pointers) {
          assert.notEqual(resolve(result, pointer), undefined, profile + '/' + skill.id + pointer);
        }
        const part = example.request.params.message.parts[0];
        assert.deepEqual(JSON.parse(skill.examples[0]), part.data || part.text);
      }
    }
  } finally { console.log = log; globalThis.fetch = fetch; }
});

test('new skill examples preserve paid admission and malformed-input refusal', async () => {
  const log = console.log; console.log = () => {};
  try {
    for (const profile of profiles) {
      const env = { AGENT_PROFILE: profile, VIZIER_DISABLED: '1', BILLING_MODE: 'pay_per_call' };
      const card = agentCard(new Request(origin), env);
      for (const contract of card.x_agenda_intelligence.skill_invocations.skills.slice(1)) {
        const example = contract.a2a_example;
        const send = request => handleRequest(new Request(example.endpoint, {
          method: 'POST', headers: example.headers, body: JSON.stringify(request)
        }), env);
        const paid = await send(example.request);
        const free=Boolean(routingToolForProfile(profile));
        assert.equal(paid.status, free?200:402, profile + ': ' + await paid.clone().text());
        const refusal = await paid.json();
        if(free) assert.ok(refusal.result);
        else {assert.ok(refusal.error);assert.ok(!refusal.result);}
        assert.ok(!card.skills.find(skill => skill.id === contract.skill_id).tags.includes('free'));
        const invalid = structuredClone(example.request);
        invalid.params.message.parts = [{ data: {}, mediaType: 'application/json' }];
        const response = await send(invalid);
        assert.ok(response.status >= 400 && response.status !== 402, profile);
        assert.ok(!(await response.json()).result);
      }
    }
  } finally { console.log = log; }
});
