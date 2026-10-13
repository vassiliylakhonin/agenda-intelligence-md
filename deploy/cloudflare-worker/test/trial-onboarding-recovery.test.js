import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { handleRequest } from '../src/index.js';
import { memoryD1 } from './helpers/d1.js';

const origin = 'https://example.test';
const envFor = () => ({ AGENT_PROFILE:'m2m_escrow_arbiter', WORKER_FREE_TRIAL:'1',
  BILLING_MODE:'pay_per_call', VIZIER_DISABLED:'1', PAYMENT_LEDGER:memoryD1() });
const headers = { 'cf-connecting-ip':'192.0.2.80', 'x-client-id':'agenda-owner-onboarding' };
const get = (env, path='/v1/trial?availability=1', extra={}) => handleRequest(new Request(origin+path,
  {headers:{...headers,...extra}}),env);
const post = (env, body) => handleRequest(new Request(origin+'/v1/trial', {
  method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(body) }),env);
const count = async env => (await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n;
const capture = async action => {const old=console.log, events=[];console.log=e=>events.push(e);
  try {await action(events);} finally {console.log=old;}};

test('availability is a read-only network/product snapshot and POST remains authoritative', async () => capture(async events => {
  const env=envFor();
  let response=await get(env),body=await response.json();
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(Object.keys(body.availability).sort(),
    ['status','remaining_attempts','checked_at','reset_at','advisory','attempt_consumed'].sort());
  assert.equal(body.availability.status,'available');
  assert.equal(body.availability.remaining_attempts,2);
  assert.equal(body.availability.advisory,true);
  assert.equal(body.availability.attempt_consumed,false);
  assert.equal(body.availability.reset_at,null);
  assert.equal(await count(env),0);
  assert.ok(!events.some(e=>e?.stage));
  assert.equal((await post(env,body.example_request)).status,200);
  assert.equal((await (await get(env)).json()).availability.remaining_attempts,1);
  assert.equal((await post(env,body.example_request)).status,200);
  body=await (await get(env)).json();
  assert.equal(body.availability.status,'network_allowance_exhausted');
  assert.equal(body.availability.remaining_attempts,0);
  assert.equal(body.availability.reset_at,null);
  assert.equal((await post(env,body.example_request)).status,429);
  assert.equal(await count(env),2);
  assert.equal((await (await get(env,undefined,{'x-client-id':'changed-label'})).json()).availability.status,'network_allowance_exhausted');
  assert.equal((await (await get({...env,AGENT_PROFILE:'agentic_interaction_trust'})).json()).availability.remaining_attempts,2);
  assert.equal((await (await get(env,undefined,{'cf-connecting-ip':'192.0.2.81'})).json()).availability.remaining_attempts,2);
}));

test('read-only availability reports shared daily capacity and fails visibly on missing storage or authorization', async () => {
  const env=envFor(),now=new Date().toISOString();
  await env.PAYMENT_LEDGER.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1000)
    INSERT INTO output_verification_trials SELECT 'full-'||i,'full-'||i,?1,?2 FROM n`)
    .bind(now.slice(0,10),now).run();
  const body=await (await get(env)).json();
  assert.equal(body.availability.status,'daily_capacity_exhausted');
  assert.equal(body.availability.remaining_attempts,2);
  assert.ok(Date.parse(body.availability.reset_at)>Date.now());
  assert.equal(await count(env),1000);
  assert.equal((await get({...env,PAYMENT_LEDGER:undefined})).status,503);
  assert.equal((await get(env,undefined,{'cf-connecting-ip':''})).status,503);
  assert.equal((await get({...env,WORKER_FREE_TRIAL:'0'})).status,404);
  const gated={...env,AGENT_PROFILE:'cis_secondary_sanctions',CIS_SECONDARY_SANCTIONS_API_KEY:'test-only-key'};
  assert.equal((await get(gated)).status,401);
  assert.equal((await get(gated,'/v1/trial')).status,200);
});

test('Interaction Trust trial discovery supplies executable canonical A2A and recovers invalid prose', async () => capture(async () => {
  const env={...envFor(),AGENT_PROFILE:'agentic_interaction_trust'};
  const terms=await (await get(env,'/v1/trial')).json();
  assert.equal(terms.worked_example_url,'/?example=1#worked-example');
  const sample=terms.a2a_example;
  assert.equal(sample.request.params.message.parts[0].mediaType,'application/json');
  const send=body=>handleRequest(new Request(origin+'/message/send',{method:'POST',
    headers:{...sample.headers,...headers},body:JSON.stringify(body)}),env);
  assert.equal((await send(sample.request)).status,402);
  const invalid=structuredClone(sample.request);
  invalid.params.message.parts=[{text:'Please check this agent'}];
  const refused=await send(invalid),failure=await refused.json();
  assert.equal(refused.status,400);
  assert.equal(failure.validation.category,'missing_structured_request');
  assert.equal((await send(failure.request_hint.example_request)).status,402);
  assert.equal(await count(env),0);
}));

test('browser checks allowance without submitting input and offers saved example after 429', async () => capture(async () => {
  const env=envFor(),terms=await (await get(env,'/v1/trial')).json();
  const html=await (await handleRequest(new Request(origin+'/?owner_test=1',{headers:{accept:'text/html'}}),env)).text();
  const ids=['profile-run','profile-paid','profile-status','profile-result','profile-summary','profile-response',
    'profile-request','profile-feedback','profile-helpful','profile-blocked','profile-feedback-status','profile-recovery','profile-allowance','profile-allowance-check','worked-example'];
  const elements=Object.fromEntries(ids.map(id=>[id,{value:JSON.stringify(terms.example_request),
    innerHTML:'',textContent:'',hidden:true,scrollIntoView(){}}]));
  const methods=[];
  const context={URL,window:{location:{href:origin+'/?owner_test=1',origin},crypto:globalThis.crypto},crypto:globalThis.crypto,
    document:{getElementById:id=>elements[id],createElement:()=>({set textContent(value){this.innerHTML=String(value);}})},
    fetch:async(url,init)=>{methods.push(init.method || 'GET');return handleRequest(new Request(new URL(url,origin),
      {...init,headers:{...init.headers,...headers,origin}}),env);}};
  vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],context);
  context.agendaPaidFetch=()=>{throw new Error('Payment must require explicit opt-in');};
  await context.refreshTrialAvailability();
  assert.deepEqual(methods,['GET']);
  assert.equal(await count(env),0);
  assert.match(elements['profile-allowance'].textContent,/2 free attempt/);
  const input=elements['profile-request'].value;
  await context.runProfileExample({preventDefault(){}});
  const trialPosts=methods.filter(method=>method==='POST').length;
  await context.submitTrialFeedback('useful_next_step');
  assert.match(elements['profile-feedback-status'].textContent,/choice was recorded/);
  await context.submitTrialFeedback('still_blocked');
  assert.equal(methods.filter(method=>method==='POST').length,trialPosts+1);
  for(let i=0;i<2;i++) await context.runProfileExample({preventDefault(){}});
  assert.equal(elements['profile-request'].value,input);
  assert.equal(elements['profile-recovery'].hidden,false);
  assert.equal(elements['profile-paid'].hidden,false);
  assert.equal(elements['profile-run'].disabled,true);
  assert.equal(elements['profile-helpful'].disabled,false);
  const posted=methods.filter(method=>method==='POST').length;
  await context.runProfileExample({preventDefault(){}});
  assert.equal(methods.filter(method=>method==='POST').length,posted);
  await context.refreshTrialAvailability();
  assert.match(elements['profile-allowance'].textContent,/does not reset daily/);
  assert.equal(elements['profile-run'].disabled,true);
  context.fetch=async()=>({ok:true,json:async()=>({availability:{status:'available',remaining_attempts:1}})});
  await context.refreshTrialAvailability();
  assert.equal(elements['profile-run'].disabled,false);
  context.showWorkedExample();
  assert.equal(elements['worked-example'].hidden,false);
  assert.equal(elements['profile-request'].value,input);
  assert.equal(await count(env),2);
}));
