import test from 'node:test';
import assert from 'node:assert/strict';
import { trialFeedbackMailto } from '../src/trial-feedback.js';

test('feedback drafts include only product, bounded status and unanswered questions', () => {
  const link = trialFeedbackMailto('cis_secondary_sanctions', 200, 'support@example.test');
  const url = new URL(link);
  const body = url.searchParams.get('body');
  assert.equal(url.protocol, 'mailto:');
  assert.match(body, /Product: cis_secondary_sanctions/);
  assert.match(body, /Check: Completed/);
  assert.match(body, /What was missing or confusing/);
  assert.match(body, /Useful next step: Not answered/);
  const escrow = new URL(trialFeedbackMailto('m2m_escrow_arbiter', null, 'support@example.test'));
  assert.equal(escrow.searchParams.get('subject'), 'Trial feedback: m2m_escrow_arbiter');
  assert.match(escrow.searchParams.get('body'), /Product: m2m_escrow_arbiter/);
  assert.match(decodeURIComponent(trialFeedbackMailto('agenda', 200, 'support@example.test', 'useful_next_step')), /Useful next step: Useful next step/);
  assert.match(decodeURIComponent(trialFeedbackMailto('agenda', 200, 'support@example.test', 'still_blocked')), /Useful next step: Still blocked/);
  assert.match(trialFeedbackMailto('agenda', 429, 'support@example.test'), /Allowance%20reached/);
  const unsafe = decodeURIComponent(trialFeedbackMailto('bad\nprivate-input', 'secret-error', 'support@example.test'));
  assert.ok(!unsafe.includes('private-input'));
  assert.ok(!unsafe.includes('secret-error'));
  assert.ok(!unsafe.includes('Yes'));
});

import { handleRequest, GATE_REQUEST_GUIDES } from '../src/index.js';
import { memoryD1 } from './helpers/d1.js';
const origin = 'https://example.test';
const profile = 'agent_output_verification';
const configured = () => ({AGENT_PROFILE:profile, WORKER_FREE_TRIAL:'1', VIZIER_DISABLED:'1', BILLING_MODE:'pay_per_call', PAYMENT_LEDGER:memoryD1()});
const headers = {'content-type':'application/json',origin,'cf-connecting-ip':'192.0.2.29','x-client-id':'agenda-owner-feedback-test'};
const send = (env,path,body,extra={}) => handleRequest(new Request(origin+path,{method:'POST',headers:{...headers,...extra},body:typeof body==='string'?body:JSON.stringify(body)}),env);
test('optional feedback binds to a completed same-network/product check without storing input or consuming allowance',async()=>{
  const env=configured(),events=[],old=console.log;console.log=e=>events.push(e);
  try {
    const complete=await send(env,'/v1/agent-output/trial',GATE_REQUEST_GUIDES[profile].example);
    assert.equal(complete.status,200);
    const attempt=complete.headers.get('x-payment-attempt-id');
    const choice={attempt_id:attempt,response:'useful_next_step'};
    const before=events.length;
    assert.equal((await send(env,'/telemetry/trial-feedback',choice)).status,204);
    const feedback=events.slice(before);
    assert.equal(feedback.length,1);
    assert.equal(feedback[0].step,'trial_feedback');
    assert.equal(feedback[0].feedback_response,'useful_next_step');
    assert.equal(feedback[0].feedback_attempt_id,attempt);
    assert.equal(feedback[0].feedback_origin_group,'excluded');
    assert.equal(feedback[0].caller_kind,'owner_synthetic');
    assert.ok(!JSON.stringify(feedback).includes('claim_evidence_map'));
    assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n,1);
    for(const [body,extra,status] of [
      [{...choice,secret:'never-log-this'},{},400],
      [{...choice,response:'private-free-text'},{},400],
      [{...choice,attempt_id:crypto.randomUUID()},{},404],
      [choice,{'cf-connecting-ip':'192.0.2.30'},404],
      [choice,{origin:'https://foreign.test'},403],
      ['x'.repeat(513),{},413]
    ]) assert.equal((await send(env,'/telemetry/trial-feedback',body,extra)).status,status);
    assert.equal((await send({...env,AGENT_PROFILE:'agentic_interaction_trust'},'/telemetry/trial-feedback',choice)).status,404);
    assert.equal((await send({...env,PAYMENT_LEDGER:undefined},'/telemetry/trial-feedback',choice)).status,503);
    assert.ok(!JSON.stringify(events).includes('never-log-this'));
    await env.PAYMENT_LEDGER.prepare('UPDATE trial_completion_receipts SET completed_at=?1 WHERE attempt_id=?2')
      .bind(new Date(Date.now()-8*86400000).toISOString(),attempt).run();
    assert.equal((await send(env,'/telemetry/trial-feedback',choice)).status,404);
    assert.equal((await handleRequest(new Request(origin+'/telemetry/trial-feedback',{headers}),env)).status,405);
    assert.equal(events.filter(e=>e?.step==='trial_feedback').length,1);
  } finally {console.log=old;}
});
