import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFirstCheckClient,runFirstCheckCli} from '../../../examples/hosted-mcp/first-check.mjs';
import {handleRequest} from '../src/index.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {memoryD1} from './helpers/d1.js';

const origin='https://example.test';
const endpoint=origin+'/mcp/agent';
const configured=profile=>({AGENT_PROFILE:profile,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1',PAYMENT_LEDGER:memoryD1()});
const quiet=async action=>{const old=console.log;console.log=()=>{};try{return await action();}finally{console.log=old;}};
function setup(profile='agent_output_verification', options={}) {
  const env={...configured(profile),...options},requests=[];
  const fetchImpl=async(url,init)=>{
    requests.push(JSON.parse(init.body));
    assert.equal(init.redirect,'error');
    const headers=new Headers(init.headers);
    assert.equal(headers.get('x-client-id'),'agenda-owner-first-check-regression');
    return handleRequest(new Request(url,{...init,headers:{...Object.fromEntries(headers),'cf-connecting-ip':'192.0.2.149'}}),env);
  };
  const client=createFirstCheckClient({endpoint,headers:{'x-client-id':'agenda-owner-first-check-regression'},fetchImpl});
  const reservations=async()=> (await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n;
  return {env,client,requests,fetchImpl,reservations};
}

test('single-client path reaches a real free result and optional completion-bound feedback on every trial profile',async()=>quiet(async()=>{
  for(const [profile,example] of Object.entries(WORKED_EXAMPLES)) {
    const {client,requests,reservations}=setup(profile);
    const info=await client.inspect();
    assert.equal(info.connected,true,profile);
    assert.equal(info.free_check_available,true,profile);
    const trialInput=info.example_input;
    assert.ok(trialInput && typeof trialInput==='object',profile);
    if(profile==='agent_output_verification')assert.deepEqual(trialInput,example.request);
    assert.equal(await reservations(),0);
    const input=structuredClone(trialInput);
    const ready=await client.prepare(input);
    assert.equal(ready.prepared,true,profile);
    assert.equal(await reservations(),0);
    input.unsubmitted_private_edit='keep the prepared snapshot unchanged';
    const result=await client.evaluate();
    assert.equal(result.trial.completion_recorded,true,profile);
    assert.equal(result.trial.payment_required,false);
    assert.deepEqual(requests.find(row=>row.params?.name==='free_trial').params.arguments,trialInput);
    const feedback=await client.feedback('useful_next_step');
    assert.deepEqual(feedback,{recorded:true,response:'useful_next_step',evaluation_performed:false,self_report_only:true});
    assert.equal(await reservations(),1);
    assert.deepEqual(requests.filter(row=>row.method==='tools/call').map(row=>row.params.name),
      ['validate_input','free_trial_status','free_trial','free_trial_feedback']);
    await assert.rejects(client.evaluate(),{code:'not_prepared'});
    await assert.rejects(client.prepare(trialInput),{code:'already_submitted'});
    const resumed=createFirstCheckClient({endpoint,headers:{'x-client-id':'agenda-owner-first-check-regression'},fetchImpl:setup(profile).fetchImpl});
    await assert.rejects(resumed.feedback('useful_next_step',result),{code:'tool_refused'}); // Other ledger has no completion.
  }
}));

test('invalid input stops before availability or evaluation, and protocol envelopes are not silently unwrapped',async()=>quiet(async()=>{
  const {client,requests,reservations}=setup();
  await assert.rejects(client.prepare(null),{code:'invalid_input'});
  assert.equal(requests.length,0);
  const result=await client.prepare({jsonrpc:'2.0',method:'tools/call',params:{private:'never-evaluate'}});
  assert.equal(result.valid,false);
  assert.equal(result.prepared,false);
  assert.equal(result.validation.evaluation_performed,false);
  assert.deepEqual(requests.filter(row=>row.method==='tools/call').map(row=>row.params.name),['validate_input']);
  await assert.rejects(client.evaluate(),{code:'not_prepared'});
  assert.equal(await reservations(),0);
}));

test('exhausted or disabled trials never fall back to a paid tool and retain the last result',async()=>quiet(async()=>{
  const {client,fetchImpl,reservations}=setup('m2m_escrow_arbiter');
  const input=(await client.inspect()).example_input;
  await client.prepare(input);const result=await client.evaluate();
  const second=createFirstCheckClient({endpoint,headers:{'x-client-id':'agenda-owner-first-check-regression'},fetchImpl});
  await second.prepare(input);await second.evaluate();
  const third=createFirstCheckClient({endpoint,headers:{'x-client-id':'agenda-owner-first-check-regression'},fetchImpl});
  assert.equal((await third.prepare(input)).availability.status,'network_allowance_exhausted');
  await assert.rejects(third.evaluate(),{code:'not_prepared'});
  assert.equal((await third.feedback('still_blocked',result)).recorded,true);
  assert.equal(await reservations(),2);
  const disabled=setup('agent_output_verification',{WORKER_FREE_TRIAL:'0'});
  assert.equal((await disabled.client.inspect()).free_check_available,false);
  await assert.rejects(disabled.client.prepare(WORKED_EXAMPLES.agent_output_verification.request),{code:'free_check_unavailable'});
  assert.equal(await disabled.reservations(),0);
}));

test('an unknown evaluation outcome cannot cause an automatic or accidental second submission',async()=>quiet(async()=>{
  const actual=setup();let evaluations=0;
  const client=createFirstCheckClient({endpoint,headers:{'x-client-id':'agenda-owner-first-check-regression'},fetchImpl:async(url,init)=>{
    if(JSON.parse(init.body).params?.name==='free_trial') {evaluations++;await actual.fetchImpl(url,init);throw new Error('response lost');}
    return actual.fetchImpl(url,init);
  }});
  await client.prepare(WORKED_EXAMPLES.agent_output_verification.request);
  await assert.rejects(client.evaluate(),{code:'transport_failed',stage:'evaluate'});
  await assert.rejects(client.evaluate(),{code:'not_prepared'});
  await assert.rejects(client.prepare(WORKED_EXAMPLES.agent_output_verification.request),{code:'already_submitted'});
  assert.equal(evaluations,1);
  assert.equal(await actual.reservations(),1);
}));

test('optional feedback availability does not block a valid free check',async()=>quiet(async()=>{
  const actual=setup();
  const client=createFirstCheckClient({endpoint,headers:{'x-client-id':'agenda-owner-first-check-regression'},fetchImpl:async(url,init)=>{
    const response=await actual.fetchImpl(url,init);
    if(JSON.parse(init.body).method!=='tools/list')return response;
    const body=await response.json();body.result.tools=body.result.tools.filter(tool=>tool.name!=='free_trial_feedback');
    return Response.json(body);
  }});
  assert.equal((await client.inspect()).feedback_available,false);
  assert.equal((await client.prepare(WORKED_EXAMPLES.agent_output_verification.request)).prepared,true);
  assert.equal((await client.evaluate()).trial.completion_recorded,true);
  await assert.rejects(client.feedback('useful_next_step'),{code:'feedback_unavailable'});
  assert.equal(await actual.reservations(),1);
}));

test('missing authentication, incompatible headers, forged receipts and cross-endpoint feedback do not reserve an attempt',async()=>quiet(async()=>{
  const s=setup('cis_secondary_sanctions',{CIS_SECONDARY_SANCTIONS_API_KEY:'private-key'});
  await assert.rejects(s.client.prepare(WORKED_EXAMPLES.cis_secondary_sanctions.request),{code:'authentication_required'});
  assert.equal(await s.reservations(),0);
  for(const name of ['x-payment-tx','payment-signature','mcp-method','mcp-protocol-version']) {
    assert.throws(()=>createFirstCheckClient({endpoint,headers:{[name]:'private-value'}}),{code:'incompatible_headers'});
  }
  for(const url of ['http://example.test/mcp','https://key@example.test/mcp','https://example.test/mcp?key=private']) {
    assert.throws(()=>createFirstCheckClient({endpoint:url}),{code:'invalid_endpoint'});
  }
  const actual=setup();
  await assert.rejects(actual.client.feedback('useful_next_step',{endpoint,trial:{attempt_id:crypto.randomUUID()}}),{code:'completion_required'});
  await actual.client.prepare(WORKED_EXAMPLES.agent_output_verification.request);const result=await actual.client.evaluate();
  result.endpoint='https://elsewhere.test/mcp/agent';
  await assert.rejects(actual.client.feedback('useful_next_step',result),{code:'completion_required'});
}));

test('protocol diagnostics retain only finite guidance, never rejected private strings or executable follow-ups',async()=>{
  const client=createFirstCheckClient({endpoint,fetchImpl:async()=>Response.json({jsonrpc:'2.0',id:null,error:{code:-32600,
    message:'private-server-message',data:{connection_hint:{reason:'profile_method_mismatch',recommended_profile:'stateless',
      recommended_protocol_version:'2026-07-28',private:'private-input',recovery_requests:[{url:'https://untrusted.test'}]}}}},{status:400})});
  await assert.rejects(client.inspect(),error=>{
    assert.equal(error.connection.reason,'profile_method_mismatch');
    assert.equal(error.connection.automatic_retry,false);
    assert.doesNotMatch(JSON.stringify(error),/private-|untrusted/);
    return true;
  });
});

test('CLI rejects malformed JSON before HTTP, preserves the result when file saving fails and never chooses feedback',async()=>quiet(async()=>{
  const errors=[],outputs=[];let calls=0;
  const io={readFile:async()=>'{private-malformed',writeFile:async()=>{},stdout:v=>outputs.push(v),stderr:v=>errors.push(v),fetchImpl:async()=>{calls++;}};
  assert.equal(await runFirstCheckCli(['evaluate',endpoint,'input.json'],io),1);
  assert.equal(calls,0);
  assert.equal(JSON.parse(errors.pop()).code,'invalid_json_file');
  const actual=setup();
  io.readFile=async()=>JSON.stringify(WORKED_EXAMPLES.agent_output_verification.request);
  io.fetchImpl=async(url,init)=>{init.headers.set('x-client-id','agenda-owner-first-check-regression');return actual.fetchImpl(url,init);};
  io.writeFile=async()=>{throw new Error('disk full');};
  assert.equal(await runFirstCheckCli(['evaluate',endpoint,'input.json','--out','result.json'],io),1);
  assert.equal(JSON.parse(outputs.at(-1)).trial.completion_recorded,true);
  assert.equal(JSON.parse(errors.at(-1)).code,'result_save_failed');
  assert.ok(!actual.requests.some(row=>row.params?.name==='free_trial_feedback'));
  assert.equal(await actual.reservations(),1);
}));

test('download is canonical, executable source and discoverable without submitting a check',async()=>quiet(async()=>{
  const env=configured('agent_output_verification');
  const response=await handleRequest(new Request(origin+'/.well-known/first-check.mjs'),env);
  assert.equal(response.status,200);
  assert.equal(await response.text(),readFileSync(new URL('../../../examples/hosted-mcp/first-check.mjs',import.meta.url),'utf8'));
  assert.match(response.headers.get('content-disposition'),/attachment/);
  assert.match(response.headers.get('content-type'),/^text\/javascript/);
  const head=await handleRequest(new Request(origin+'/.well-known/first-check.mjs',{method:'HEAD'}),env);
  assert.equal(head.status,200);
  assert.equal(await head.text(),'');
  assert.equal((await handleRequest(new Request(origin+'/.well-known/first-check.mjs',{method:'POST'}),env)).status,405);
  const contract=await (await handleRequest(new Request(origin+'/.well-known/agent-contract.json'),env)).json();
  assert.equal(contract.first_check.client_url,origin+'/.well-known/first-check.mjs');
  assert.equal(contract.first_check.automatic_payment,false);
  assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n,0);
}));

test('CLI synthetic example is runnable as raw trial input and public defaults carry no owner marker',async()=>quiet(async()=>{
  const env=configured('m2m_escrow_arbiter'),outputs=[],errors=[];let saved;
  const fetchImpl=(url,init)=>{
    assert.equal(new Headers(init.headers).has('x-client-id'),false);
    return handleRequest(new Request(url,{...init,headers:{...Object.fromEntries(new Headers(init.headers)),'cf-connecting-ip':'192.0.2.150'}}),env);
  };
  const io={fetchImpl,readFile:async()=>saved,writeFile:async(path,value,options)=>{
    assert.equal(options.flag,'wx');assert.equal(options.mode,0o600);saved=value;
  },stdout:value=>outputs.push(value),stderr:value=>errors.push(value)};
  assert.equal(await runFirstCheckCli(['example',endpoint,'--out','synthetic-input.json'],io),0);
  assert.match(errors[0],/Synthetic example/);
  assert.equal(JSON.parse(saved).request,undefined); // Paid Escrow wrapper is intentionally different.
  assert.equal(await runFirstCheckCli(['validate',endpoint,'synthetic-input.json'],io),0);
  assert.equal(JSON.parse(outputs.at(-1)).prepared,true);
  assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n,0);
}));
