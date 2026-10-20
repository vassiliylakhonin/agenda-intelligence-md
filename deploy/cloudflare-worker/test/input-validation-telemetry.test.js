import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {memoryD1} from './helpers/d1.js';
const base={AGENT_PROFILE:'agent_output_verification',BILLING_MODE:'pay_per_call',WORKER_FREE_TRIAL:'1',VIZIER_DISABLED:'1'};
const input={claims:[{claim_id:'c1',claim:'private-claim-secret',support_level:'unsupported'}],evidence:[]};
async function invoke(transport, args, {env={},headers={},raw,version='2.0'}={}) {
  const events=[], log=console.log;
  console.log=e=>{if(e?.event)events.push(e);};
  const body=transport==='http'?args:{jsonrpc:version,id:'private-rpc-secret',method:'tools/call',params:{name:'validate_input',arguments:args}};
  try {
    const response=await handleRequest(new Request('https://example.test'+(transport==='http'?'/v1/validate-input':'/mcp/agent'),{
      method:'POST',headers:{'content-type':'application/json','x-client-id':'agenda-owner-preflight-regression',...headers},body:raw??JSON.stringify(body)
    }),{...base,...env});
    return {status:response.status,body:await response.json(),events,observations:events.filter(e=>e.step==='input_validation')};
  }finally{console.log=log;}
}
function one(result,outcome,reason,profile=base.AGENT_PROFILE) {
  assert.equal(result.observations.length,1);
  const e=result.observations[0];
  assert.equal(e.event_version,6);assert.equal(e.validation_outcome,outcome);
  assert.equal(e.validation_reason,reason);assert.equal(e.caller_kind,'owner_synthetic');
  assert.equal(e.evaluation_performed,false);assert.equal(e.attempt_consumed,false);
  assert.equal(e.agent_profile,profile);
  assert.ok(!result.events.some(e=>e.event==='agenda_intelligence_a2a_usage'||e.stage));
  for(const secret of ['private-claim-secret','private-rpc-secret','private-field-secret','private-tool-secret','private-key-secret','private-proof-secret'])assert.ok(!JSON.stringify(result.events).includes(secret),secret);
  return e;
}
test('HTTP and MCP record actual schema outcomes, without quota, usage, input or findings',async()=>{
  for(const transport of ['http','mcp']){
    const ledger=memoryD1();
    const valid=await invoke(transport,{tool:'agent_output_verification',input},{env:{PAYMENT_LEDGER:ledger}});
    const e=one(valid,'valid','schema_valid');assert.equal(e.validation_transport,transport);
    assert.equal(e.validation_tool,'agent_output_verification');assert.equal(e.validation_target_kind,'evaluation');
    const invalid=await invoke(transport,{tool:'agent_output_verification',input:{'private-field-secret':'private-claim-secret'}});
    one(invalid,'invalid','schema_mismatch');
    assert.equal((await ledger.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n,0);
  }
});
test('unknown tools and invalid envelopes become bounded refusals, not invalid schema findings',async()=>{
  for(const transport of ['http','mcp']){
    const unknown=await invoke(transport,{tool:'private-tool-secret',input});
    assert.equal(one(unknown,'rejected','unknown_validation_tool').validation_tool,null);
    one(await invoke(transport,{tool:'agent_output_verification',input:null}),'rejected','invalid_validation_request');
  }
});
test('HTTP auth, malformed JSON and body limit are observed without changing refusals',async()=>{
  const unauthorized=await invoke('http',{tool:'agent_output_verification',input},{env:{AGENT_PROFILE:'cis_secondary_sanctions',CIS_SECONDARY_SANCTIONS_API_KEY:'private-key-secret'}});
  assert.equal(unauthorized.status,401);one(unauthorized,'rejected','unauthorized','cis_secondary_sanctions');
  const malformed=await invoke('http',null,{raw:'private-claim-secret'});assert.equal(malformed.status,400);
  one(malformed,'rejected','invalid_validation_json');
  const large=await invoke('http',null,{raw:'x'.repeat(262145)});assert.equal(large.status,413);
  one(large,'rejected','validation_body_too_large');
});
test('MCP authorization and invalid protocol remain errors and are never successful preflight',async()=>{
  const denied=await invoke('mcp',{tool:'agent_output_verification',input},{env:{AGENT_PROFILE:'cis_secondary_sanctions',CIS_SECONDARY_SANCTIONS_API_KEY:'private-key-secret'}});
  assert.equal(denied.status,401);assert.ok(denied.body.error);one(denied,'rejected','unauthorized','cis_secondary_sanctions');
  const bad=await invoke('mcp',{tool:'agent_output_verification',input},{version:'wrong'});
  assert.ok(bad.body.error);one(bad,'rejected','protocol_rejected');
});
test('payment headers and native MCP proof refusal are recorded once in both billing modes',async()=>{
  for(const transport of ['http','mcp'])for(const mode of ['freemium','pay_per_call']){
    one(await invoke(transport,{tool:'agent_output_verification',input},{headers:{'payment-signature':'private-proof-secret'},env:{BILLING_MODE:mode}}),'rejected','payment_not_applicable');
  }
  const native={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'validate_input',arguments:{tool:'agent_output_verification',input},_meta:{'x402/payment':{private:'private-proof-secret'}}}};
  one(await invoke('mcp',null,{raw:JSON.stringify(native)}),'rejected','payment_not_applicable');
});
test('telemetry failure never changes the schema result or charges a trial',async()=>{
  const digest=crypto.subtle.digest,warn=console.warn;crypto.subtle.digest=async()=>{throw Error('synthetic');};console.warn=()=>{};
  try{for(const transport of ['http','mcp']){
    const result=await invoke(transport,{tool:'agent_output_verification',input});
    assert.equal(result.status,200);assert.equal(result.observations.length,0);
    assert.equal(transport==='http'?result.body.valid:result.body.result.structuredContent.valid,true);
  }}finally{crypto.subtle.digest=digest;console.warn=warn;}
});
test('all twelve hosted profiles emit the serving profile on actual HTTP and MCP preflight',async()=>{
  const log=console.log;console.log=()=>{};
  let gates;
  try{gates=(await(await handleRequest(new Request('https://example.test/.well-known/fleet.json'),base)).json()).gates;}
  finally{console.log=log;}
  assert.equal(gates.length,12);
  for(const gate of gates){
    const response=await handleRequest(new Request(`https://example.test/examples/tools/${gate.tool_name}.json`),{...base,AGENT_PROFILE:gate.profile});
    const example=(await response.json()).arguments;
    for(const transport of ['http','mcp']){
      const result=await invoke(transport,{tool:gate.tool_name,input:example},{env:{AGENT_PROFILE:gate.profile}});
      one(result,'valid','schema_valid',gate.profile);
    }
  }
});

test('utility preflight is distinguishable from evaluation preflight',async()=>{
  const result=await invoke('http',{tool:'free_trial_status',input:{}});
  assert.equal(one(result,'valid','schema_valid').validation_target_kind,'utility');
});
