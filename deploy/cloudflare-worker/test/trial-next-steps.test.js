import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {handleRequest} from '../src/index.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {memoryD1} from './helpers/d1.js';
import {TRIAL_NEXT_STEPS_SCRIPT} from '../src/trial-next-steps.js';
const createTrialNextSteps=vm.runInNewContext(TRIAL_NEXT_STEPS_SCRIPT+';createTrialNextSteps');
const origin='https://example.test';
const headers={'content-type':'application/json','cf-connecting-ip':'192.0.2.170',origin,'x-client-id':'agenda-owner-trial-next-step'};
const quiet=async fn=>{const log=console.log;console.log=()=>{};try{return await fn();}finally{console.log=log;}};
async function browser(profile='kazakhstan') {
  const env={AGENT_PROFILE:profile,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1',PAYMENT_LEDGER:memoryD1()};
  const terms=await(await handleRequest(new Request(origin+'/v1/trial',{headers}),env)).json();
  const html=await(await handleRequest(new Request(origin+'/?owner_test=1',{headers:{accept:'text/html'}}),env)).text();
  const ids=['profile-run','profile-paid','profile-status','profile-result','profile-summary','profile-response','profile-request',
    'profile-feedback','profile-helpful','profile-blocked','profile-feedback-status','profile-recovery','profile-allowance',
    'profile-allowance-check','profile-progress','profile-review','profile-feedback-panel','worked-example',
    'profile-recovery-message','profile-input-status','profile-validate-input','profile-followthrough','profile-intake'];
  const elements=Object.fromEntries(ids.map(id=>[id,{value:JSON.stringify(terms.example_request),innerHTML:'',textContent:'',hidden:true,
    focus(){this.focused=true;},scrollIntoView(){}}]));
  const calls=[];
  const context={URL,crypto,window:{location:{href:origin+'/?owner_test=1',origin},crypto},
    document:{getElementById:id=>elements[id],createElement:()=>({set textContent(v){this.innerHTML=String(v);}})},
    fetch:async(url,init={})=>{calls.push({url,init});return handleRequest(new Request(new URL(url,origin),{...init,headers:{...headers,...init.headers}}),env);}};
  vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],context);
  context.agendaPaidFetch=()=>{throw Error('No automatic checkout is allowed');};
  return {env,terms,html,elements,context,calls};
}
const reservations=async env=>(await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n;

test('every trial profile preflights the same raw trial fields without reserving or evaluating',()=>quiet(async()=>{
  for(const profile of Object.keys(WORKED_EXAMPLES).filter(p=>!['agenda','corridor_sanctions_assistant'].includes(p))) {
    const {env,context,elements,calls,terms}=await browser(profile);
    assert.equal(terms.input_preflight.target_tool,'free_trial');
    await context.agendaNextSteps.validateInput();
    assert.equal(calls.length,1,profile);
    assert.equal(new URL(calls[0].url).pathname,'/v1/validate-input');
    assert.equal(JSON.parse(calls[0].init.body).tool,'free_trial');
    assert.match(elements['profile-input-status'].textContent,/matches the published schema/,profile);
    assert.equal(await reservations(env),0,profile);
  }
}));

test('a Kazakhstan quota refusal leaves a completed result and its feedback intact during free preflight',()=>quiet(async()=>{
  const {env,context,elements,calls}=await browser();
  const run=()=>context.runProfileExample({preventDefault(){}});
  await run();await run();
  const previous={input:elements['profile-request'].value,result:elements['profile-result'].textContent,feedback:context.agendaFeedbackAttempt};
  await run();
  assert.equal(elements['profile-run'].disabled,true);
  assert.match(elements['profile-recovery-message'].textContent,/Waiting until tomorrow does not restore/);
  assert.equal(elements['profile-paid'].hidden,false);
  const n=calls.length;
  await context.agendaNextSteps.validateInput();
  assert.equal(calls.length,n+1);
  assert.match(elements['profile-input-status'].textContent,/No payment or trial attempt/);
  assert.equal(elements['profile-request'].value,previous.input);
  assert.equal(elements['profile-result'].textContent,previous.result);
  assert.equal(context.agendaFeedbackAttempt,previous.feedback);
  assert.equal(await reservations(env),2);
  context.agendaNextSteps.revise();
  assert.equal(elements['profile-request'].focused,true);
  assert.equal(calls.length,n+1,'Reviewing a revision must not submit it');
}));

test('feedback is visibly pending, recorded once, and then acknowledges the available next step',()=>quiet(async()=>{
  const {context,elements,calls}=await browser();
  await context.runProfileExample({preventDefault(){}});
  const fetch=context.fetch;let release;
  context.fetch=(url,init)=>url==='/telemetry/trial-feedback'
    ?new Promise(resolve=>{release=async()=>resolve(await fetch(url,init));}):fetch(url,init);
  const pending=context.submitTrialFeedback('useful_next_step');
  assert.equal(elements['profile-helpful'].disabled,true);
  await context.submitTrialFeedback('still_blocked');
  assert.match(elements['profile-feedback-status'].textContent,/being saved/);
  await release();await pending;
  assert.equal(calls.filter(c=>c.url==='/telemetry/trial-feedback').length,1);
  assert.match(elements['profile-feedback-status'].textContent,/choice was recorded/);
  assert.equal(elements['profile-followthrough'].hidden,false);
  assert.equal(elements['profile-helpful'].disabled,true);
}));

test('stale or unconfirmed preflight cannot be presented as a valid current input',async()=>{
  let raw='{"case":"first"}',release;
  const status={textContent:''},button={disabled:false};
  const elements={'profile-input-status':status,'profile-validate-input':button};
  const opts={document:{getElementById:id=>elements[id]},headers:()=>({}),readInput:()=>raw,
    tool:'free_trial',validationUrl:origin+'/v1/validate-input',paidPrice:0.01};
  const next=createTrialNextSteps({...opts,fetch:()=>new Promise(resolve=>{release=resolve;})});
  const pending=next.validateInput();raw='{"case":"changed"}';
  release(Response.json({tool:'free_trial',valid:true,evaluation_performed:false,attempt_consumed:false,payment_required:false,authorization_granted:false}));
  await pending;assert.match(status.textContent,/input changed/);
  await createTrialNextSteps({...opts,fetch:async()=>Response.json({tool:'free_trial',valid:true,attempt_consumed:true})}).validateInput();
  assert.match(status.textContent,/could not be confirmed/);
  assert.equal(button.disabled,false);
});

test('failed feedback allows an explicit retry and daily recovery never promises a campaign reset',()=>quiet(async()=>{
  const {context,elements}=await browser();
  await context.runProfileExample({preventDefault(){}});
  const fetch=context.fetch;
  context.fetch=async()=>Response.json({error:'unavailable'},{status:503});
  await context.submitTrialFeedback('still_blocked');
  assert.equal(context.agendaFeedbackSent,false);
  assert.equal(elements['profile-helpful'].disabled,false);
  context.fetch=fetch;
  await context.submitTrialFeedback('still_blocked');
  assert.equal(context.agendaFeedbackSent,true);
  context.agendaNextSteps.showRecovery('daily_capacity_exhausted','2026-10-26T00:00:00Z');
  assert.match(elements['profile-recovery-message'].textContent,/2026-10-26T00:00:00.000Z/);
  context.agendaNextSteps.showRecovery('network_allowance_exhausted','2026-10-26T00:00:00Z');
  assert.doesNotMatch(elements['profile-recovery-message'].textContent,/Reset time/);
}));
