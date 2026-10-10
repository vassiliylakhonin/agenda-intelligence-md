import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.js';
import { memoryD1 } from './helpers/d1.js';

const origin = 'https://example.test';
const envFor = () => ({ AGENT_PROFILE:'agenda', WORKER_FREE_TRIAL:'1',
  BILLING_MODE:'pay_per_call', VIZIER_DISABLED:'1', PAYMENT_LEDGER:memoryD1() });
const post = (env, body, ip='192.0.2.90') => handleRequest(new Request(origin+'/v1/trial', {
  method:'POST', headers:{'content-type':'application/json','cf-connecting-ip':ip,'x-client-id':'agenda-owner-diagnostics'},
  body:JSON.stringify(body) }), env);
const capture = async action => {
  const events=[],old=console.log;console.log=e=>events.push(e);
  try { await action(events); } finally {console.log=old;}
};
const example = async env => (await (await handleRequest(new Request(origin+'/v1/trial'),env)).json()).example_request;

test('network exhaustion has a precise campaign reason and is not an execution failure', async () => capture(async events => {
  const env=envFor(),body=await example(env);
  assert.equal((await post(env,body)).status,200);
  assert.equal((await post(env,body)).status,200);
  events.length=0;
  const response=await post(env,body),result=await response.json();
  assert.equal(response.status,429);
  assert.equal(result.code,'trial_exhausted');
  assert.equal(result.trial.limit_reason,'network_allowance_exhausted');
  assert.equal(result.trial.attempt_consumed,false);
  assert.equal(response.headers.get('retry-after'),null);
  const failure=events.find(e=>e?.stage==='preview_failed');
  assert.equal(failure.failure_family,'trial_admission');
  assert.equal(failure.trial_limit_reason,'network_allowance_exhausted');
  assert.ok(!events.some(e=>e?.event==='agenda_intelligence_a2a_usage'));
  assert.equal((await post(env,body,'192.0.2.91')).status,200);
}));

test('daily capacity returns a UTC reset hint without consuming the fresh network allowance', async () => capture(async events => {
  const env=envFor(),body=await example(env),now=new Date().toISOString();
  await env.PAYMENT_LEDGER.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1000)
    INSERT INTO output_verification_trials SELECT 'capacity-'||i,'capacity-'||i,?1,?2 FROM n`)
    .bind(now.slice(0,10),now).run();
  const response=await post(env,body),result=await response.json();
  assert.equal(response.status,429);
  assert.equal(result.trial.limit_reason,'daily_capacity_exhausted');
  assert.equal(result.trial.attempt_consumed,false);
  assert.ok(Number(response.headers.get('retry-after'))>0);
  assert.equal(result.trial.retry_after_seconds,Number(response.headers.get('retry-after')));
  assert.equal(events.find(e=>e?.stage==='preview_failed').failure_family,'trial_admission');
  assert.equal(events.find(e=>e?.stage==='preview_failed').trial_limit_reason,'daily_capacity_exhausted');
  assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n,1000);
  // Moving old capacity out of today's window must leave both fresh attempts.
  await env.PAYMENT_LEDGER.prepare("UPDATE output_verification_trials SET reserved_day='2026-01-01'").run();
  assert.equal((await post(env,body)).status,200);
  assert.equal((await post(env,body)).status,200);
  assert.equal((await post(env,body)).status,429);
}));

test('campaign exhaustion takes precedence when daily capacity is also full', async () => capture(async () => {
  const env=envFor(),body=await example(env),now=new Date().toISOString();
  await post(env,body);await post(env,body);
  await env.PAYMENT_LEDGER.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<998)
    INSERT INTO output_verification_trials SELECT 'capacity-'||i,'capacity-'||i,?1,?2 FROM n`)
    .bind(now.slice(0,10),now).run();
  const response=await post(env,body),result=await response.json();
  assert.equal(response.status,429);
  assert.equal(result.trial.limit_reason,'network_allowance_exhausted');
  assert.equal(response.headers.get('retry-after'),null);
}));

test('unavailable transactional storage fails closed as admission, without an evaluation', async () => capture(async events => {
  const env=envFor(),body=await example(env);
  env.PAYMENT_LEDGER.batch=async()=>{throw new Error('unavailable');};
  const response=await post(env,body),result=await response.json();
  assert.equal(response.status,503);
  assert.equal(result.code,'trial_unavailable');
  assert.equal(events.find(e=>e?.stage==='preview_failed').failure_family,'trial_admission');
  assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n,0);
  assert.ok(!events.some(e=>e?.stage==='preview_completed'));
}));
