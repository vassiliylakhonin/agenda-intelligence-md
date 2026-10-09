import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.js';
import { TRIAL_PROFILES } from '../src/trial-profiles.js';
import { memoryD1 } from './helpers/d1.js';
import { trialCompletionStats } from '../src/trial-receipts.js';

const origin = 'https://example.test';
const today = () => new Date().toISOString().slice(0,10);
const getStats = env => handleRequest(new Request(origin+'/stats?date='+today(),
  {headers:{'x-stats-token':'owner-stats'}}),env);

test('24 real trial handlers remain measurable when three console completion logs disappear', async () => {
  const db=memoryD1(), log=console.log, events=[];
  await db.prepare("UPDATE trial_receipt_coverage SET complete_from='2000-01-01T00:00:00.000Z' WHERE id='fleet'").run();
  const dropped=new Set(['cis_secondary_sanctions','agentic_interaction_trust','dual_use_technology_export']);
  const lost=new Set();
  console.log=e=>{
    if(e?.stage==='preview_completed' && dropped.has(e.agent_profile) && !lost.has(e.agent_profile)) {
      lost.add(e.agent_profile); return;
    }
    events.push(e);
  };
  let successes=0;
  try {
    for(const profile of Object.keys(TRIAL_PROFILES)) {
      const env={AGENT_PROFILE:profile,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',
        VIZIER_DISABLED:'1',PAYMENT_LEDGER:db,STATS_TOKEN:'owner-stats'};
      const terms=await (await handleRequest(new Request(origin+'/v1/trial'),env)).json();
      for(let i=0;i<2;i++) {
        const response=await handleRequest(new Request(origin+'/v1/trial',{method:'POST',
          headers:{'cf-connecting-ip':'192.0.2.60','user-agent':'Agenda-Ecosystem-Verification/Receipt-Regression'},
          body:JSON.stringify(terms.example_request)}),env);
        assert.equal(response.status,200);
        successes++;
      }
    }
    assert.equal(events.filter(e=>e?.stage==='preview_completed').length,21);
    const stats=await (await getStats({PAYMENT_LEDGER:db,STATS_TOKEN:'owner-stats'})).json();
    assert.equal(stats.trial_completions.total_completed,successes);
    assert.equal(stats.trial_completions.groups.excluded,24);
    assert.equal(stats.trial_completions.groups.external_candidate,0);
    assert.equal(stats.trial_completions.rows.length,12);
    assert.ok(!JSON.stringify(stats.trial_completions).includes('192.0.2.60'));
    assert.ok(!JSON.stringify(stats.trial_completions).includes('caller_hash'));
    const denied=await handleRequest(new Request(origin+'/stats?date='+today()),{PAYMENT_LEDGER:db,STATS_TOKEN:'owner-stats'});
    assert.equal(denied.status,401);
  } finally {console.log=log;}
});

test('receipt storage failure cannot produce an unrecorded successful trial response', async () => {
  const db=memoryD1(), log=console.log, events=[];
  await db.prepare("UPDATE trial_receipt_coverage SET complete_from='2000-01-01T00:00:00.000Z' WHERE id='fleet'").run();
  const env={AGENT_PROFILE:'agent_output_verification',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1',
    PAYMENT_LEDGER:{prepare(sql){if(sql.includes('INSERT INTO trial_completion_receipts'))throw new Error('private storage detail');return db.prepare(sql);}}};
  console.log=e=>events.push(e);
  try {
    const terms=await (await handleRequest(new Request(origin+'/v1/trial'),env)).json();
    const response=await handleRequest(new Request(origin+'/v1/trial',{method:'POST',
      headers:{'cf-connecting-ip':'192.0.2.70'},body:JSON.stringify(terms.example_request)}),env);
    assert.equal(response.status,503);
    const body=await response.json();
    assert.equal(body.code,'trial_recording_unavailable');
    assert.equal(body.trial.attempt_consumed,true);
    assert.ok(!JSON.stringify(body).includes('private storage detail'));
    assert.ok(!events.some(e=>e?.stage==='preview_completed' || e?.stage==='payment_verified'));
    const stats=await (await getStats({PAYMENT_LEDGER:db,STATS_TOKEN:'owner-stats'})).json();
    assert.equal(stats.trial_completions.total_completed,0);
  } finally {console.log=log;}
});

test('rollout and historical gaps stay unmeasured; same-millisecond completions are included', async t => {
  const db=memoryD1();
  assert.equal((await trialCompletionStats({PAYMENT_LEDGER:db},today())).status,'rollout_in_progress');
  await db.prepare("UPDATE trial_receipt_coverage SET complete_from=?1 WHERE id='fleet'").bind(new Date(Date.now()-1000).toISOString()).run();
  const previous=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const historical=await trialCompletionStats({PAYMENT_LEDGER:db},previous);
  assert.equal(historical.status,'not_instrumented');
  assert.equal(historical.total_completed,null);
  const now=Date.now();
  await db.prepare('INSERT INTO trial_completion_receipts VALUES (?1,?2,?3,?4,?5)')
    .bind(crypto.randomUUID(),'agenda',today(),new Date(now).toISOString(),'external_candidate').run();
  t.mock.method(Date,'now',()=>now);
  const measured=await trialCompletionStats({PAYMENT_LEDGER:db},today());
  assert.equal(measured.status,'partial_window');
  assert.equal(measured.groups.external_candidate,1);
  assert.equal((await trialCompletionStats({},today())).total_completed,null);
});
