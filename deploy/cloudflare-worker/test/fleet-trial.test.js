import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { handleRequest, DIRECT_V1_ROUTES, handleMcpJsonRpc } from '../src/index.js';
import { memoryD1 } from './helpers/d1.js';
import { TRIAL_PROFILES, trialPath, OUTPUT_TRIAL_PATH } from '../src/trial-profiles.js';
import { tokenHash } from '../src/payment-ledger.js';

const origin = 'https://example.test';
const baseEnv = db => ({ WORKER_FREE_TRIAL:'1', BILLING_MODE:'pay_per_call',
  VIZIER_DISABLED:'1', PAYMENT_LEDGER:db || memoryD1() });
const envFor = (profile, db) => ({ ...baseEnv(db), AGENT_PROFILE:profile });
const call = (env, path='/v1/trial', body, headers={}) => handleRequest(new Request(origin+path,
  {method:body === undefined ? 'GET' : 'POST', headers:{'content-type':'application/json',
    'cf-connecting-ip':'192.0.2.60',...headers}, ...(body === undefined ? {} : {body:JSON.stringify(body)})}),env);
const quiet = async action => { const old=console.log;console.log=()=>{};
  try { return await action(); } finally { console.log=old; } };
const count = async db => (await db.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n;
const termsFor = async env => (await call(env)).json();

for (const [profile,config] of Object.entries(TRIAL_PROFILES)) {
  test(`${profile}: free/paid parity, two reserved attempts, invalid input and discovery`, async () => quiet(async () => {
    const env=envFor(profile),terms=await termsFor(env);
    assert.equal(terms.agent_profile,profile);
    assert.equal(terms.paid_price_usdc,profile==='m2m_escrow_arbiter'?0.5:0.05);
    assert.equal((await call(env,'/v1/trial',{})).status,400);
    const first=await call(env,'/v1/trial',terms.example_request);
    assert.equal(first.status,200);
    const {trial,...actual}=await first.json();
    assert.equal(trial.payment_required,false);
    assert.equal(trial.tool,config.tool);
    let expected;
    if(config.route) {
      const route=DIRECT_V1_ROUTES[config.route];
      const result=await route.run(route.extract(terms.example_request),new Request(origin+config.route),env);
      expected={...result.response,...(route.provenance?.(result)||{})};
      if(profile==='agent_financial_guard') {
        delete expected.x402_challenge;
        expected.financial_guard_verdict={...expected.financial_guard_verdict};
        delete expected.financial_guard_verdict.x402_challenge;
      }
    } else {
      const result=await handleMcpJsonRpc({jsonrpc:'2.0',id:1,method:'tools/call',
        params:{name:config.tool,arguments:terms.example_request}},new Request(origin+'/mcp'),env);
      assert.equal(result.result.isError,false);
      expected=result.result.structuredContent;
    }
    assert.deepEqual(actual,JSON.parse(JSON.stringify(expected)));
    const paidBody=config.route ? terms.example_request : {jsonrpc:'2.0',id:1,method:'tools/call',
      params:{name:config.tool,arguments:terms.example_request}};
    assert.equal((await call(env,terms.paid_endpoint,paidBody)).status,402);
    assert.equal((await call(env,trialPath(profile),terms.example_request)).status,200);
    assert.equal((await call(env,'/v1/trial',terms.example_request,{'x-client-id':'another-label'})).status,429);
    assert.equal(await count(env.PAYMENT_LEDGER),2);
    const api=await (await call(env,'/api/openapi.json')).json();
    assert.ok(api.paths[trialPath(profile)].post.responses['429']);
    const access=await (await call(env,'/.well-known/x402')).json();
    assert.equal(access.x_agenda_access.free_trial.agent_profile,profile);
    if(profile==='agent_financial_guard') assert.ok(!JSON.stringify(actual).includes('x402_challenge'));
    if(profile!=='agent_output_verification') assert.equal((await call(env,OUTPUT_TRIAL_PATH)).status,404);
  }));
}

test('all products have isolated network quotas in one database under concurrent calls', async () => quiet(async () => {
  const db=memoryD1(),profiles=Object.keys(TRIAL_PROFILES);
  const results=await Promise.all(profiles.map(async profile=>{
    const env=envFor(profile,db),terms=await termsFor(env);
    const calls=await Promise.all(Array.from({length:5},()=>call(env,'/v1/trial',terms.example_request)));
    return calls.map(r=>r.status).sort();
  }));
  for(const result of results) assert.deepEqual(result,[200,200,429,429,429]);
  assert.equal(await count(db),24);
}));

test('fleet-wide cap includes legacy Output reservations and serializes different products', async () => quiet(async () => {
  const db=memoryD1();
  await db.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<999)
    INSERT INTO output_verification_trials SELECT 'legacy-'||i,'legacy-'||i,?1,?2 FROM n`)
    .bind(new Date().toISOString().slice(0,10),new Date().toISOString()).run();
  const results=await Promise.all(['agenda','agent_output_verification','m2m_escrow_arbiter'].map(async profile=>{
    const env=envFor(profile,db),terms=await termsFor(env);
    return (await call(env,'/v1/trial',terms.example_request)).status;
  }));
  assert.deepEqual(results.sort(),[200,429,429]);
  assert.equal(await count(db),1000);
}));

test('Output aliases preserve the previously shipped campaign identity', async () => quiet(async () => {
  const env=envFor('agent_output_verification');
  const key=await tokenHash('output-trial-v1::192.0.2.60');
  for(const id of ['old-1','old-2']) await env.PAYMENT_LEDGER.prepare(
    'INSERT INTO output_verification_trials VALUES (?1,?2,?3,?4)').bind(id,key,'2026-10-01','2026-10-01T00:00:00Z').run();
  const terms=await termsFor(env);
  for(const path of ['/v1/trial',OUTPUT_TRIAL_PATH]) assert.equal((await call(env,path,terms.example_request)).status,429);
  assert.equal(await count(env.PAYMENT_LEDGER),2);
}));

test('trial refuses tool selection, inline payment and credentials without consuming quota', async () => quiet(async () => {
  for(const profile of Object.keys(TRIAL_PROFILES)) {
    const env=envFor(profile),terms=await termsFor(env);
    for(const patch of [{capability:'corridor_bankability_screen'},{agent_profile:'agenda'},
      {tool:'decision_check'},{jsonrpc:'2.0',method:'tools/call'},{request:{x402_payment_tx:'0x'+'a'.repeat(64)}}]) {
      assert.equal((await call(env,'/v1/trial',{...terms.example_request,...patch})).status,400);
    }
    assert.equal((await call(env,'/v1/trial',terms.example_request,{'authorization':'Bearer agy_pro_fake'})).status,400);
    assert.equal(await count(env.PAYMENT_LEDGER),0);
  }
  const gated={...envFor('cis_secondary_sanctions'),CIS_SECONDARY_SANCTIONS_API_KEY:'private-test-key'};
  assert.equal((await call(gated,'/v1/trial',(await termsFor(gated)).example_request)).status,401);
  assert.equal((await call({...envFor('agenda'),WORKER_FREE_TRIAL:'0'})).status,404);
}));

test('free CIS screening never calls the paid OpenSanctions fallback', async () => quiet(async () => {
  const env={...envFor('cis_secondary_sanctions'),OPENSANCTIONS_API_KEY:'private-test-key'};
  const terms=await termsFor(env);
  const old=globalThis.fetch;globalThis.fetch=()=>{throw new Error('No paid upstream call is allowed');};
  try {
    const response=await call(env,'/v1/trial',terms.example_request);
    assert.equal(response.status,200);
    assert.equal((await response.json()).live_retrieval_status,'disabled');
  } finally {globalThis.fetch=old;}
}));

test('evaluator refusal consumes its reservation and never records a successful free result', async () => {
  const env=envFor('agent_financial_guard'),terms=await quiet(()=>termsFor(env));
  const route=DIRECT_V1_ROUTES[TRIAL_PROFILES.agent_financial_guard.route];
  const run=route.run,old=console.log,events=[];
  route.run=async()=>({response:{error:'private upstream failure'}});
  console.log=e=>events.push(e);
  try {
    const response=await call(env,'/v1/trial',terms.example_request);
    assert.equal(response.status,503);
    assert.equal((await response.json()).code,'trial_evaluation_failed');
    assert.equal(await count(env.PAYMENT_LEDGER),1);
    assert.ok(events.some(e=>e.stage==='preview_failed' && e.reason==='trial_evaluation_failed'));
    assert.ok(!events.some(e=>e.stage==='preview_completed' || e.stage==='execution_completed'));
  } finally {route.run=run;console.log=old;}
});

test('every free-first form uses the correct payload, explicit paid tool and price, and shared trace', async () => quiet(async () => {
  for(const profile of Object.keys(TRIAL_PROFILES)) {
    const env=envFor(profile),terms=await termsFor(env);
    const html=await (await call(env,'/?owner_test=1',undefined,{accept:'text/html'})).text();
    assert.ok(html.includes('id="profile-console"'));
    const input=html.match(/<textarea id="profile-request"[^>]*>([\s\S]*?)<\/textarea>/)[1]
      .replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
    assert.deepEqual(JSON.parse(input),terms.example_request);
    const elements=Object.fromEntries(['profile-run','profile-paid','profile-status','profile-result','profile-summary','profile-response','profile-request','profile-feedback']
      .map(id=>[id,{value:input,innerHTML:'',textContent:'',hidden:id==='profile-paid'}]));
    let paid=0;const traces=[];
    const context={URL,window:{location:{href:origin+'/?owner_test=1',origin},crypto:globalThis.crypto},crypto:globalThis.crypto,
      document:{getElementById:id=>elements[id],createElement:()=>({set textContent(value){this.innerHTML=String(value);}})},
      fetch:async(url,init)=>{traces.push(init.headers['x-payment-trace-id']);
        return handleRequest(new Request(url,{...init,headers:{...init.headers,'cf-connecting-ip':'192.0.2.61'}}),env);}};
    const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
    vm.runInNewContext(script,context);
    context.agendaPaidFetch=async(url,init,price)=>{
      paid++;traces.push(init.headers['x-payment-trace-id']);
      assert.equal(new URL(url).pathname,terms.paid_endpoint);
      assert.equal(price,terms.paid_price_usdc);
      const payload=JSON.parse(init.body);
      if(terms.paid_transport==='mcp') {
        assert.equal(payload.params.name,terms.tool);
        assert.deepEqual(payload.params.arguments,terms.example_request);
      } else assert.deepEqual(payload,terms.example_request);
      return Response.json({code:'payment_required'},{status:402});
    };
    for(let i=0;i<3;i++) await context.runProfileExample({preventDefault(){}});
    assert.equal(paid,0);
    assert.equal(elements['profile-paid'].hidden,false);
    assert.ok(elements['profile-status'].textContent.includes('No payment was made'),profile);
    assert.equal(elements['profile-request'].value,input);
    const feedback = new URL(elements['profile-feedback'].href);
    assert.equal(feedback.protocol, 'mailto:');
    assert.match(feedback.searchParams.get('body'), /Allowance reached/);
    assert.ok(!feedback.searchParams.get('body').includes(input));
    await context.runProfileExample({preventDefault(){}},true);
    assert.equal(paid,1);
    assert.equal(new Set(traces).size,1);
  }
}));
