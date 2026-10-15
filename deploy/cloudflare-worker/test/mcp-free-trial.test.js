import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {TRIAL_PROFILES, trialPath} from '../src/trial-profiles.js';
import {memoryD1} from './helpers/d1.js';

const origin='https://example.test';
const environment=profile=>({AGENT_PROFILE:profile,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',
  VIZIER_DISABLED:'1',PAYMENT_LEDGER:memoryD1()});
const headers={'content-type':'application/json','cf-connecting-ip':'192.0.2.71','x-client-id':'agenda-owner-native-trial-test'};
const rpc=(env,name,args={},path='/mcp/agent',extra={},patch={})=>handleRequest(new Request(origin+path,{
  method:'POST',headers:{...headers,...extra},body:JSON.stringify({jsonrpc:'2.0',id:1,
    method:'tools/call',params:{name,arguments:args},...patch})}),env);
const rpcData=async(...args)=>(await rpc(...args)).json();
const details=body=>JSON.parse(body.result.content[0].text);
const count=async env=>(await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n;
const quiet=async action=>{const log=console.log;console.log=()=>{};try{return await action();}finally{console.log=log;}};

for(const [profile,config] of Object.entries(TRIAL_PROFILES)) {
  test(`${profile}: native trial discovers schema, executes and shares REST quota`,()=>quiet(async()=>{
    const env=environment(profile);
    const listed=await handleRequest(new Request(origin+'/mcp/agent',{method:'POST',headers,
      body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}),env);
    const tools=(await listed.json()).result.tools;
    const trial=tools.find(t=>t.name==='free_trial');
    assert.ok(trial && tools.some(t=>t.name==='free_trial_status'));
    assert.equal(trial.annotations.idempotentHint,false);
    assert.equal(trial.annotations.readOnlyHint,false);
    const status=await rpcData(env,'free_trial_status');
    assert.equal(status.result.isError,false);
    assert.equal(status.result.structuredContent.terms.tool,config.tool);
    const limit=profile==='agent_output_verification'?5:2;
    assert.equal(status.result.structuredContent.availability.remaining_attempts,limit);
    assert.equal(await count(env),0);
    const invalid=await rpcData(env,'free_trial',{});
    assert.equal(invalid.result.isError,true);
    assert.equal(invalid.result.structuredContent,undefined);
    assert.equal(details(invalid).code,'invalid_trial_request');
    assert.equal(await count(env),0);
    const example=trial._meta['com.agenda/readiness'].example_arguments;
    const golden=await rpcData(env,'free_trial',example);
    assert.equal(golden.result.isError,false,JSON.stringify(golden));
    const result=golden.result.structuredContent;
    assert.equal(result.trial.tool,config.tool);
    assert.equal(result.trial.completion_recorded,true);
    assert.equal(result.trial.payment_required,false);
    assert.ok(result.evaluation && !result.evaluation.trial);
    assert.match(result.trial.attempt_id,/^[0-9a-f-]{36}$/);
    assert.equal((await rpcData(env,'free_trial_status')).result.structuredContent.availability.remaining_attempts,limit-1);
    // REST and both MCP URLs are one existing campaign, not extra allowances.
    const rest=await handleRequest(new Request(origin+trialPath(profile),{
      method:'POST',headers,body:JSON.stringify(example)}),env);
    assert.equal(rest.status,200);
    for(let i=2;i<limit;i++) assert.equal((await rpcData(env,'free_trial',example,'/mcp')).result.isError,false);
    const exhausted=await rpcData(env,'free_trial',example,'/mcp');
    assert.equal(exhausted.result.isError,true);
    assert.equal(exhausted.result.structuredContent,undefined);
    assert.equal(details(exhausted).http_status,429);
    assert.equal(details(exhausted).trial.limit_reason,'network_allowance_exhausted');
    assert.equal(details(exhausted).trial.attempt_consumed,false);
    assert.equal(await count(env),limit);
    assert.equal((await rpcData(env,'free_trial_status')).result.structuredContent.availability.remaining_attempts,0);
    assert.equal((await rpc(env,config.tool,example)).status,200); // /mcp/agent maps paid admission to an error.
    assert.equal((await rpcData(env,config.tool,example)).result.isError,true);
  }));
}

test('native trials cannot select another operation, hide credentials or execute malformed envelopes',()=>quiet(async()=>{
  const env=environment('agent_output_verification');
  const terms=await (await handleRequest(new Request(origin+'/v1/trial'),env)).json();
  for(const patch of [{tool:'decision_check'},{capability:'decision_check'},{agent_profile:'agenda'},
    {request:{x402_payment_tx:'0x'+'a'.repeat(64)}}]) {
    const refused=await rpcData(env,'free_trial',{...terms.example_request,...patch});
    assert.ok(refused.error || refused.result?.isError);
  }
  for(const patch of [{jsonrpc:'1.0'},{id:null},{id:{bad:true}}]) {
    assert.ok((await rpcData(env,'free_trial',terms.example_request,'/mcp/agent',{},patch)).error);
  }
  const version=await rpcData(env,'free_trial',{},'/mcp/agent',{},
    {params:{name:'free_trial',arguments:terms.example_request,_meta:{'io.modelcontextprotocol/protocolVersion':'unsupported'}}});
  assert.ok(version.error);
  const pro=await rpcData(env,'free_trial',terms.example_request,'/mcp/agent',{authorization:'Bearer agy_pro_fake'});
  assert.equal(pro.result.isError,true);
  assert.equal(details(pro).code,'trial_credentials_not_applicable');
  const signature=await rpcData(env,'free_trial',terms.example_request,'/mcp/agent',{'x-payment-signature':'not-a-signature'});
  assert.equal(signature.result.isError,true);
  assert.equal(await count(env),0);
}));

test('trial disabled, missing store and malformed status stay errors without reservations',()=>quiet(async()=>{
  const env=environment('agenda');
  const off=await rpcData({...env,WORKER_FREE_TRIAL:'0'},'free_trial',{text:'Question'});
  assert.equal(off.result.isError,true);
  assert.equal(await count(env),0);
  assert.ok((await rpcData(env,'free_trial_status',{unwanted:true})).error);
  for(const name of ['free_trial_status','free_trial']) {
    const unavailable=await rpcData({...env,PAYMENT_LEDGER:undefined},name,name==='free_trial'?{text:'Question'}:{});
    assert.equal(unavailable.result.isError,true);
    assert.equal(unavailable.result.structuredContent,undefined);
    assert.equal(details(unavailable).code,'trial_unavailable');
  }
}));

test('required production Bearer works on both trial transports and invalid credentials do not reserve',()=>quiet(async()=>{
  const env={...environment('cis_secondary_sanctions'),CIS_SECONDARY_SANCTIONS_API_KEY:'synthetic-production-key'};
  const terms=await (await handleRequest(new Request(origin+'/v1/trial'),env)).json();
  for(const extra of [{},{authorization:'Bearer wrong'}]) {
    assert.equal((await rpc(env,'free_trial',terms.example_request,'/mcp/agent',extra)).status,401);
  }
  assert.equal(await count(env),0);
  const auth={authorization:'Bearer synthetic-production-key'};
  assert.equal((await rpcData(env,'free_trial_status',{},'/mcp/agent',auth)).result.isError,false);
  assert.equal((await rpcData(env,'free_trial',terms.example_request,'/mcp/agent',auth)).result.isError,false);
  assert.equal((await handleRequest(new Request(origin+'/v1/trial',{method:'POST',
    headers:{...headers,...auth},body:JSON.stringify(terms.example_request)}),env)).status,200);
  assert.equal(await count(env),2);
}));

test('Output Verification plugin endpoint exposes native trials without broadening its paid catalog',()=>quiet(async()=>{
  const env=environment('agent_output_verification');
  const listing=await handleRequest(new Request(origin+'/mcp/output-verification',{method:'POST',headers,
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}),env);
  const tools=(await listing.json()).result.tools;
  assert.deepEqual(tools.map(t=>t.name),['agent_output_verification','free_trial_status','free_trial']);
  const trial=tools.find(t=>t.name==='free_trial');
  assert.equal((await rpcData(env,'free_trial',trial._meta['com.agenda/readiness'].example_arguments,
    '/mcp/output-verification')).result.isError,false);
  const refused=await rpcData(env,'decision_check',{},'/mcp/output-verification');
  assert.ok(refused.error || refused.result?.isError);
}));

test('concurrent REST and MCP trials share the last daily slot and expose retry guidance',()=>quiet(async()=>{
  const db=memoryD1();
  await db.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<999)
    INSERT INTO output_verification_trials SELECT 'daily-'||i,'daily-'||i,?1,?2 FROM n`)
    .bind(new Date().toISOString().slice(0,10),new Date().toISOString()).run();
  const env={...environment('agenda'),PAYMENT_LEDGER:db};
  const [mcp,rest]=await Promise.all([
    rpcData(env,'free_trial',{text:'Synthetic question'}),
    handleRequest(new Request(origin+'/v1/trial',{method:'POST',headers,
      body:JSON.stringify({text:'Synthetic question'})}),{...env,AGENT_PROFILE:'corridor_sanctions_assistant'})
  ]);
  assert.equal(Number(mcp.result.isError===false)+Number(rest.ok),1);
  assert.equal(await count(env),1000);
  const refused=mcp.result.isError ? details(mcp) : await rest.json();
  assert.equal(refused.trial.limit_reason,'daily_capacity_exhausted');
  assert.ok(refused.trial.retry_after_seconds>0);
  assert.equal(refused.trial.attempt_consumed,false);
}));

test('a completion-recording failure is an MCP tool error after consuming its reservation',()=>quiet(async()=>{
  const env=environment('agenda');
  const prepare=env.PAYMENT_LEDGER.prepare;
  env.PAYMENT_LEDGER.prepare=sql=>{
    if(sql.includes('INSERT INTO trial_completion_receipts')) throw Error('synthetic storage outage');
    return prepare(sql);
  };
  const result=await rpcData(env,'free_trial',{text:'Synthetic question'});
  assert.equal(result.result.isError,true);
  assert.equal(result.result.structuredContent,undefined);
  assert.equal(details(result).code,'trial_recording_unavailable');
  assert.equal(details(result).trial.attempt_consumed,true);
  assert.equal(await count(env),1);
}));
