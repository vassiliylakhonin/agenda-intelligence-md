import test from 'node:test';
import assert from 'node:assert/strict';
import {agentCard} from '../src/index.js';

const card = async profile => agentCard(new Request('https://example.test/.well-known/agent-card.json'),
  {AGENT_PROFILE:profile,BILLING_MODE:'pay_per_call'});

test('selection copy stays focused without changing machine source keys or advice boundaries', async () => {
  for (const profile of ['kazakhstan','gulf_maritime_exposure','cis_secondary_sanctions','corridor_sanctions_assistant']) {
    const result = await card(profile);
    const copy = [result.description, ...result.skills.flatMap(skill => [skill.name,skill.description,...skill.tags])].join(' ');
    assert.doesNotMatch(copy,/\binsurance\b|(?<!marine cargo )\binsurers?\b/i,profile);
    assert.match(JSON.stringify(result.x_agenda_intelligence.boundaries),/No .*advice/);
    if (profile === 'kazakhstan') assert.ok(result.x_agenda_intelligence.required_before_go.includes('insurance_clause_or_underwriter_note'));
    if (profile === 'gulf_maritime_exposure') assert.ok(result.x_agenda_intelligence.required_before_review.includes('pi_insurance_certificate'));
  }
});

test('shipment, policy-memo and AI-report discovery have distinct jobs', async () => {
  const corridor = await card('kazakhstan'), agenda = await card('agenda'), output = await card('agent_output_verification');
  assert.ok(corridor.skills.some(skill => skill.id === 'middle-corridor-shipment-memo-check'));
  assert.ok(!corridor.skills.some(skill => ['risk-memo-quality-gate','a2a-evidence-pack-linter'].includes(skill.id)));
  assert.ok(agenda.skills.some(skill => skill.id === 'agenda-validate-memo'));
  assert.match(agenda.skills.find(skill => skill.id === 'agenda-audit-claims').name,/Packaged policy-memo/);
  assert.match(output.description,/^Citation check for AI reports:/);
  const main = output.skills.find(skill => skill.id === 'agent-output-verification');
  assert.equal(main.name,'Citation check for AI reports');
  assert.equal(main.tags.length,8);
  assert.match(output.description,/allow_relay is never issued/);
  assert.match(output.description,/mandatory human review/);
});
