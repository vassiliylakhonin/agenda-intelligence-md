import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { handleRequest } from '../src/index.js';
import { memoryD1 } from './helpers/d1.js';
import { OUTPUT_TRIAL_PATH, reserveOutputTrial } from '../src/output-trial.js';

const origin = 'https://example.test';
const evidence = { claims: [{ claim_id:'own-claim', claim:'A redacted source reports three warehouses.',
  support_level:'direct', evidence_ids:['own-source'], supporting_quotes:[{evidence_id:'own-source',quote:'three warehouses'}] }],
  evidence:[{evidence_id:'own-source',source_id:'redacted-report',text:'The supplied report lists three warehouses.'}] };
const envFor = () => ({ AGENT_PROFILE:'agent_output_verification', OUTPUT_VERIFICATION_TRIAL:'1',
  BILLING_MODE:'pay_per_call', VIZIER_DISABLED:'1', PAYMENT_LEDGER:memoryD1() });
const post = (env, body=evidence, headers={}, path=OUTPUT_TRIAL_PATH) => handleRequest(new Request(origin+path,
  {method:'POST', headers:{'content-type':'application/json','cf-connecting-ip':'192.0.2.10', ...headers},
    body:typeof body === 'string' ? body : JSON.stringify(body)}), env);
const quiet = async action => { const old=console.log;console.log=()=>{};
  try { return await action(); } finally { console.log=old; } };
const stored = env => env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS count FROM output_verification_trials').first();

test('trial evaluates edited evidence with exact paid-route parity and mandatory review', async () => quiet(async () => {
  const env=envFor();
  const response=await post(env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(response.headers.get('x-payment-attempt-id'),/^[0-9a-f-]{36}$/);
  const reservation=await env.PAYMENT_LEDGER.prepare('SELECT reservation_id FROM output_verification_trials').first();
  assert.equal(reservation.reservation_id,response.headers.get('x-payment-attempt-id'));
  const {trial,...actual}=await response.json();
  const expected=await (await post({...env,BILLING_MODE:'freemium'},evidence,{},'/v1/agent-output/verification')).json();
  assert.deepEqual(actual,expected);
  assert.equal(actual.human_review_required,true);
  assert.equal(actual.factual_verification_performed,false);
  assert.equal(trial.attempt_consumed,true);
  assert.equal(trial.payment_required,false);
  assert.equal(trial.attempts_per_network,2);
}));

test('concurrent callers cannot overspend or reset the network allowance with client labels', async () => quiet(async () => {
  const env=envFor();
  const responses=await Promise.all(Array.from({length:20},(_,i)=>post(env,evidence,
    {'user-agent':'Runtime/'+i,'x-client-id':'client-'+i,'x-forwarded-for':'198.51.100.'+i})));
  assert.equal(responses.filter(r=>r.status===200).length,2);
  assert.equal(responses.filter(r=>r.status===429).length,18);
  assert.equal((await stored(env)).count,2);
  const row=await env.PAYMENT_LEDGER.prepare('SELECT * FROM output_verification_trials LIMIT 1').first();
  assert.match(row.client_hash,/^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(row).includes('192.0.2.10'));
  assert.ok(!JSON.stringify(row).includes('warehouses'));
  assert.equal((await post(env,evidence,{'cf-connecting-ip':'192.0.2.11'})).status,200);
}));

test('global daily ceiling is shared by different network addresses', async () => quiet(async () => {
  const env=envFor();
  await env.PAYMENT_LEDGER.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<999)
    INSERT INTO output_verification_trials SELECT 'seed-'||i,'seed-'||i,?1,?2 FROM n`)
    .bind(new Date().toISOString().slice(0,10),new Date().toISOString()).run();
  const results=await Promise.all(['192.0.2.21','192.0.2.22'].map(ip=>post(env,evidence,{'cf-connecting-ip':ip})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,429]);
  assert.equal((await stored(env)).count,1000);
}));

test('invalid and oversized bodies and credentials do not reserve trials', async () => quiet(async () => {
  const env=envFor();
  for (const body of ['{',{},[],{...evidence,claims:[{claim_id:'bad',claim:'Bad',support_level:'invented'}]},
    {...evidence,request:{x402_payment_tx:'0x'+'a'.repeat(64)}}]) {
    assert.equal((await post(env,body)).status,400);
  }
  assert.equal((await post(env,'x'.repeat(1048577))).status,413);
  for (const headers of [{'authorization':'Bearer agy_pro_example'},{'x-payment-tx':'0x'+'a'.repeat(64)},
    {'x-payment-signature':'private-signature'}]) assert.equal((await post(env,evidence,headers)).status,400);
  assert.equal((await stored(env)).count,0);
}));

test('missing connecting address and unavailable storage fail closed', async () => quiet(async () => {
  const env=envFor();
  const noIp=new Request(origin+OUTPUT_TRIAL_PATH,{method:'POST',body:JSON.stringify(evidence),headers:{'x-forwarded-for':'192.0.2.10'}});
  assert.equal((await handleRequest(noIp,env)).status,503);
  for (const db of [undefined,{prepare(){throw new Error('private database error');}}]) {
    const r=await post({...env,PAYMENT_LEDGER:db});
    assert.equal(r.status,503);
    assert.ok(!(await r.text()).includes('private database error'));
  }
  assert.equal((await stored(env)).count,0);
}));

test('disabled and other profiles never serve trials and paid evaluation remains paid', async () => quiet(async () => {
  const env=envFor();
  for (const e of [{...env,OUTPUT_VERIFICATION_TRIAL:'0'},{...env,AGENT_PROFILE:'agent_financial_guard'}]) {
    assert.equal((await post(e)).status,404);
  }
  for (const path of ['/v1/agent-output/verification','/v1/agent-output/pre-action-check']) {
    if (path.endsWith('verification')) assert.equal((await post(env,evidence,{},path)).status,402);
  }
  const call={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'agent_output_verification',arguments:evidence}};
  assert.equal((await post(env,call,{},'/mcp')).status,402);
  assert.equal((await stored(env)).count,0);
}));

test('free telemetry records preview and usage, never paid completion or input content', async () => {
  const events=[], old=console.log;console.log=value=>events.push(value);
  try {
    const response=await post(envFor(),evidence,{'x-client-id':'agenda-owner-trial','user-agent':'OwnerRuntime/1.0'});
    assert.equal(response.status,200);
    const payment=events.filter(e=>e?.event==='agenda_intelligence_payment');
    assert.deepEqual(payment.map(e=>e.stage),['request_received','request_validated','preview_completed']);
    assert.ok(payment.every(e=>e.reason==='free_trial' && e.execution_id===null && e.minimum_usdc===0));
    assert.ok(payment.every(e=>e.caller_kind==='owner_synthetic'));
    assert.ok(payment.every(e=>e.payment_trace_id===response.headers.get('x-payment-trace-id')));
    const usage=events.find(e=>e?.event==='agenda_intelligence_a2a_usage');
    assert.equal(usage.usage_category,'domain');
    assert.equal(usage.payment.header_present,false);
    assert.equal(usage.caller_kind,'owner_synthetic');
    assert.ok(!JSON.stringify(events).includes('warehouses'));
    assert.ok(!JSON.stringify(events).includes('192.0.2.10'));
  } finally {console.log=old;}
});

test('discovery advertises a separate trial and the same live schema', async () => quiet(async () => {
  const env=envFor();
  const terms=await (await handleRequest(new Request(origin+OUTPUT_TRIAL_PATH),env)).json();
  assert.equal(terms.attempts_per_network,2);
  assert.equal((await post(env,terms.example_request)).status,200);
  const access=await (await handleRequest(new Request(origin+'/.well-known/x402'),env)).json();
  assert.equal(access.x_agenda_access.base_call_price,'paid');
  assert.equal(access.x_agenda_access.free_trial.endpoint,OUTPUT_TRIAL_PATH);
  const api=await (await handleRequest(new Request(origin+'/api/openapi.json'),env)).json();
  assert.ok(api.paths[OUTPUT_TRIAL_PATH].post.responses['429']);
}));

test('browser free form never invokes checkout, preserves exhausted input, and offers paid action explicitly', async () => quiet(async () => {
  const env=envFor();
  const html=await (await handleRequest(new Request(origin,{headers:{accept:'text/html'}}),env)).text();
  assert.ok(html.includes('Check your own evidence free'));
  const elements=Object.fromEntries(['profile-run','profile-paid','profile-status','profile-result','profile-summary','profile-response','profile-request','profile-feedback']
    .map(id=>[id,{value:JSON.stringify(evidence),innerHTML:'',textContent:'',hidden:id==='profile-paid'}]));
  let paid=0;const traces=[];
  const context={URL,window:{location:{href:origin+'/?owner_test=1',origin},crypto:globalThis.crypto},crypto:globalThis.crypto,
    document:{getElementById:id=>elements[id],createElement:()=>({set textContent(value){this.innerHTML=String(value);}})},
    fetch:async(url,init)=>{traces.push(init.headers['x-payment-trace-id']);
      return handleRequest(new Request(url,{...init,headers:{...init.headers,'cf-connecting-ip':'192.0.2.40'}}),env);}};
  const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  vm.runInNewContext(script,context);
  context.agendaPaidFetch=async(url,init)=>{paid++;traces.push(init.headers['x-payment-trace-id']);return Response.json({code:'payment_required'},{status:402});};
  for (let i=0;i<3;i++) await context.runProfileExample({preventDefault(){}});
  assert.equal(paid,0);
  assert.equal(elements['profile-paid'].hidden,false);
  assert.ok(elements['profile-status'].textContent.includes('No payment was made'));
  assert.equal(elements['profile-request'].value,JSON.stringify(evidence));
  await context.runProfileExample({preventDefault(){}},true);
  assert.equal(paid,1);
  assert.equal(new Set(traces).size,1);
}));

test('quota reservation cannot write to payment or Pro tables', async () => {
  const env=envFor();
  await reserveOutputTrial(new Request(origin,{headers:{'cf-connecting-ip':'192.0.2.10'}}),env);
  for (const table of ['payment_claims','paid_executions','pro_tokens']) {
    assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS count FROM '+table).first()).count,0);
  }
});
