import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { handleRequest } from '../src/index.js';
import { memoryD1 } from './helpers/d1.js';

const origin='https://example.test';
const configured=profile=>({AGENT_PROFILE:profile,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',
  VIZIER_DISABLED:'1',PAYMENT_LEDGER:memoryD1()});
const headers={'content-type':'application/json','cf-connecting-ip':'192.0.2.120',origin,'x-client-id':'agenda-owner-followthrough'};
const get=(env,path='/v1/trial?availability=1')=>handleRequest(new Request(origin+path,{headers}),env);
const post=(env,body,extra={})=>handleRequest(new Request(origin+'/v1/trial',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)}),env);
const quiet=async action=>{const old=console.log;console.log=()=>{};try{await action();}finally{console.log=old;}};

async function browser(profile='m2m_escrow_arbiter') {
  const env=configured(profile),terms=await (await get(env)).json();
  const html=await (await handleRequest(new Request(origin+'/?owner_test=1',{headers:{...headers,accept:'text/html'}}),env)).text();
  const ids=['profile-run','profile-paid','profile-status','profile-result','profile-summary','profile-response','profile-request',
    'profile-feedback','profile-helpful','profile-blocked','profile-feedback-status','profile-recovery','profile-allowance',
    'profile-allowance-check','profile-progress','profile-review','profile-feedback-panel','worked-example'];
  const elements=Object.fromEntries(ids.map(id=>[id,{value:JSON.stringify(terms.example_request),innerHTML:'',textContent:'',hidden:true}]));
  const requests=[];
  const context={URL,window:{location:{href:origin+'/?owner_test=1',origin},crypto},crypto,
    document:{getElementById:id=>elements[id],createElement:()=>({set textContent(value){this.innerHTML=String(value);}})},
    fetch:async(url,init={})=>{requests.push({url,init});return handleRequest(new Request(new URL(url,origin),
      {...init,headers:{...headers,...init.headers}}),env);}};
  vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],context);
  return {env,elements,context,requests};
}

test('Output receives five campaign attempts, including legacy reservations; other profiles retain two',async()=>quiet(async()=>{
  const env=configured('agent_output_verification');
  let terms=await (await get(env)).json();
  // First two requests use the already deployed campaign key. Raising the limit
  // must grant three more, never reset or replace those existing reservations.
  for(let i=0;i<2;i++) assert.equal((await post(env,terms.example_request)).status,200);
  terms=await (await get(env)).json();
  assert.equal(terms.attempts_per_network,5);
  assert.equal(terms.availability.remaining_attempts,3);
  const rest=await Promise.all(Array.from({length:10},(_,i)=>post(env,terms.example_request,{'x-client-id':'changed-'+i,'user-agent':'Runtime/'+i})));
  assert.equal(rest.filter(r=>r.status===200).length,3);
  assert.equal(rest.filter(r=>r.status===429).length,7);
  const blocked=await (await get(env)).json();
  assert.equal(blocked.availability.remaining_attempts,0);
  assert.match((await rest.find(r=>r.status===429).json()).error,/5 campaign attempts/);
  const other=await (await get(configured('agenda'))).json();
  assert.equal(other.attempts_per_network,2);
  const access=await (await get(env,'/.well-known/x402')).json();
  assert.equal(access.x_agenda_access.free_trial.attempts_per_network,5);
  const openapi=await (await get(env,'/api/openapi.json')).json();
  assert.match(openapi.paths['/v1/agent-output/trial'].post.description,/5 reserved attempts/);
}));

test('a refused retry preserves the completed review and its optional feedback binding',async()=>quiet(async()=>{
  const {elements,context,requests}=await browser();
  const run=()=>context.runProfileExample({preventDefault(){}});
  await run();await run();
  const previous={summary:elements['profile-summary'].innerHTML,result:elements['profile-result'].textContent,
    attempt:context.agendaFeedbackAttempt,input:elements['profile-request'].value};
  await run(); // actual network quota refusal
  assert.match(elements['profile-status'].textContent,/No payment was made/);
  assert.equal(elements['profile-summary'].innerHTML,previous.summary);
  assert.equal(elements['profile-result'].textContent,previous.result);
  assert.equal(context.agendaFeedbackAttempt,previous.attempt);
  assert.equal(elements['profile-helpful'].disabled,false);
  assert.equal(elements['profile-request'].value,previous.input);
  assert.equal(elements['profile-run'].disabled,true);
  await context.submitTrialFeedback('useful_next_step');
  const submitted=requests.filter(r=>r.url==='/telemetry/trial-feedback');
  assert.equal(submitted.length,1);
  assert.equal(JSON.parse(submitted[0].init.body).attempt_id,previous.attempt);
  assert.match(elements['profile-feedback-status'].textContent,/choice was recorded/);
}));

test('invalid input and a failed fetch preserve the last completed result without resubmitting it',async()=>quiet(async()=>{
  const {elements,context,requests}=await browser();
  await context.runProfileExample({preventDefault(){}});
  const result=elements['profile-result'].textContent,attempt=context.agendaFeedbackAttempt;
  elements['profile-request'].value='{';
  const before=requests.length;
  await context.runProfileExample({preventDefault(){}});
  assert.equal(requests.length,before);
  assert.equal(elements['profile-result'].textContent,result);
  assert.equal(context.agendaFeedbackAttempt,attempt);
  elements['profile-request'].value='{}';
  context.fetch=async()=>{throw new Error('offline');};
  await context.runProfileExample({preventDefault(){}});
  assert.equal(elements['profile-result'].textContent,result);
  assert.equal(context.agendaFeedbackAttempt,attempt);
  assert.equal(elements['profile-helpful'].disabled,false);
}));

test('each successful handler emits one usage event, one KV record and one durable completion',async()=>{
  const env=configured('agent_output_verification'),events=[],kv=new Map(),old=console.log;
  env.AGENDA_USAGE={put:async(key,value)=>kv.set(key,value)};
  console.log=e=>events.push(e);
  try {
    const terms=await (await get(env)).json();
    for(let i=0;i<2;i++) assert.equal((await post(env,terms.example_request)).status,200);
    assert.equal((await post(env,{})).status,400);
    assert.equal(events.filter(e=>e?.event==='agenda_intelligence_a2a_usage').length,2);
    assert.equal(events.filter(e=>e?.stage==='preview_completed').length,2);
    assert.equal(kv.size,2);
    assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM trial_completion_receipts').first()).n,2);
  } finally {console.log=old;}
});

test('a delayed feedback reply never marks the next completed check as rated',async()=>quiet(async()=>{
  const {context,elements}=await browser();
  await context.runProfileExample({preventDefault(){}});
  const first=context.agendaFeedbackAttempt,actual=context.fetch;
  let release;
  context.fetch=async(url,init)=>{
    if(url==='/telemetry/trial-feedback' && !release) return new Promise(resolve=>{
      release=async()=>resolve(await actual(url,init));
    });
    return actual(url,init);
  };
  const pending=context.submitTrialFeedback('useful_next_step');
  await context.runProfileExample({preventDefault(){}});
  assert.notEqual(context.agendaFeedbackAttempt,first);
  await release();await pending;
  assert.equal(context.agendaFeedbackSent,false);
  assert.equal(elements['profile-feedback-status'].textContent,'');
  await context.submitTrialFeedback('still_blocked');
  assert.match(elements['profile-feedback-status'].textContent,/choice was recorded/);
}));

test('Output web review preserves a completed result without spending a second unchanged attempt',async()=>quiet(async()=>{
  const {env,context,elements,requests}=await browser('agent_output_verification');
  const run=()=>context.runProfileExample({preventDefault(){}},false,'one-claim-v1');
  await run();
  const previous=elements['profile-result'].textContent,attempt=context.agendaFeedbackAttempt,n=requests.length;
  await run();
  assert.equal(requests.length,n,'unchanged completed review must not send another request');
  assert.match(elements['profile-status'].textContent,/unchanged.*no.*attempt/i);
  assert.equal(elements['profile-result'].textContent,previous);
  assert.equal(context.agendaFeedbackAttempt,attempt);
  const revised=JSON.parse(elements['profile-request'].value);revised.claims[0].claim+=' Additional context for review.';
  elements['profile-request'].value=JSON.stringify(revised);
  await run();assert.equal(requests.length,n+1);
  assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n,2);
}));

test('Output web review checks the submitted version and suppresses a concurrent second request',async()=>quiet(async()=>{
  const {context,elements,requests}=await browser('agent_output_verification'),actual=context.fetch;
  let release;
  context.fetch=(url,init)=>new Promise(resolve=>{release=async()=>resolve(await actual(url,init));});
  const run=()=>context.runProfileExample({preventDefault(){}});
  const first=run();await run();
  assert.equal(requests.length,0,'the first fetch is still waiting; no second fetch was started');
  const revised=JSON.parse(elements['profile-request'].value);revised.claims[0].claim+=' Changed while waiting.';
  elements['profile-request'].value=JSON.stringify(revised);
  await release();await first;
  context.fetch=actual;await run();
  assert.equal(requests.length,2,'the edited current input was not checked by the first request');
}));
