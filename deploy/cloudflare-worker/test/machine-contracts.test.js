import {cardExtensionParams} from '../src/card-extension.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
const origin='https://example.test';
const env={AGENT_PROFILE:'agent_output_verification',BILLING_MODE:'pay_per_call',X402_STANDARD:'1',OUTPUT_VERIFICATION_TRIAL:'1',VIZIER_DISABLED:'1'};
test('published payment manifest declares the standard enabled by the actual runtime',async()=>{
  const response=await handleRequest(new Request(origin+'/.well-known/x402'),env);
  const manifest=await response.json();
  assert.equal(manifest.x_agenda_access.standard_x402.version,2);
  assert.equal(manifest.x402_version,'2.0');
  assert.equal(manifest.x402Version,2);
});

import {memoryD1} from './helpers/d1.js';
import {inspectMachineAgent} from '../../../examples/machine-contract/client.mjs';
import {validatePublishedInput} from '../src/input-validation.js';
const request=(url,body)=>new Request(url,{method:'POST',headers:{'content-type':'application/json','x-client-id':'agenda-owner-machine-contract-test'},body:JSON.stringify(body)});
const reserved=async environment=>(await environment.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n;

test('a client uses only fleet links and published contracts to preflight all twelve profiles without execution or quota',async()=>{
  const log=console.log,network=globalThis.fetch;console.log=()=>{};globalThis.fetch=()=>{throw Error('Unexpected upstream call');};
  try {
    const fleet=await(await handleRequest(new Request(origin+'/.well-known/fleet.json'),env)).json();
    assert.equal(fleet.gates.length,12);
    for(const gate of fleet.gates){
      assert.ok(gate.when_to_call);
      assert.ok(gate.schema_url.startsWith(gate.canonical_endpoint+'/schemas/tools/'));
      assert.deepEqual(gate.decision_contract.enum,['block','review','insufficient']);
      const environment={...env,AGENT_PROFILE:gate.profile,WORKER_FREE_TRIAL:'1',PAYMENT_LEDGER:memoryD1()};
      const paths=[],fetcher=async(url,options)=>{paths.push(new URL(url).pathname);return handleRequest(new Request(url,options),environment);};
      const client=await inspectMachineAgent(gate.canonical_endpoint,{tool:gate.tool_name,fetcher});
      assert.equal(client.example.example_available,true,gate.profile);
      const input=client.example.arguments;
      const valid=await client.validate(input);
      assert.equal(valid.valid,true,gate.profile+JSON.stringify(valid));
      assert.equal(valid.evaluation_performed,false);
      assert.equal(valid.attempt_consumed,false);
      const rpc=await handleRequest(request(gate.canonical_endpoint+'/mcp/agent',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'validate_input',arguments:{tool:gate.tool_name,input}}}),environment);
      const result=(await rpc.json()).result;
      assert.equal(result.isError,false);
      assert.deepEqual(result.structuredContent,valid);
      assert.equal(await reserved(environment),0,gate.profile);
      assert.equal(paths.some(path=>path.includes('/trial')||path==='/message/send'),false);
    }
  }finally{console.log=log;globalThis.fetch=network;}
});

test('preflight returns stable missing-field pointers and catches nested types, extra fields and enums',async()=>{
  const base={claims:[{claim_id:'c1',claim:'Caller statement',support_level:'unsupported'}],evidence:[]};
  for(const input of [{}, {...base,evidence:1}, {...base,claims:[{...base.claims[0],support_level:'invented'}]}, {...base,unknown:'never-echo-this-secret'}]){
    const checked=validatePublishedInput('agent_output_verification',{tool:'agent_output_verification',input},true);
    assert.equal(checked.status,200);assert.equal(checked.body.valid,false);
    assert.ok(checked.body.findings.length);
    assert.ok(!JSON.stringify(checked).includes('never-echo-this-secret'));
  }
  const missing=validatePublishedInput('agent_output_verification',{tool:'agent_output_verification',input:{}},true).body;
  assert.deepEqual(missing.missing_fields,['/claims','/evidence']);
});

test('preflight retains production auth, refuses payments/cross-profile tools, and cannot make normal evaluation free',async()=>{
  const environment={...env,AGENT_PROFILE:'cis_secondary_sanctions',CIS_SECONDARY_SANCTIONS_API_KEY:'test-key',PAYMENT_LEDGER:memoryD1()};
  const url=origin+'/v1/validate-input';
  assert.equal((await handleRequest(request(url,{tool:'cis_secondary_sanctions_exposure',input:{}}),environment)).status,401);
  const authorized=new Request(request(url,{tool:'agent_output_verification',input:{}}),{headers:{'content-type':'application/json',authorization:'Bearer test-key'}});
  assert.equal((await handleRequest(authorized,environment)).status,400);
  const payment=new Request(request(url,{tool:'cis_secondary_sanctions_exposure',input:{}}),{headers:{'content-type':'application/json',authorization:'Bearer test-key','payment-signature':'not-a-proof'}});
  assert.equal((await handleRequest(payment,environment)).status,400);
  const plain={...env,PAYMENT_LEDGER:memoryD1()};
  const oversized=validatePublishedInput('agent_output_verification',{tool:'agent_output_verification',input:{text:'x'.repeat(262144)}},true);
  assert.equal(oversized.status,413);
  assert.equal((await handleRequest(request(origin+'/v1/agent-output/verification',{claims:[],evidence:[],validate_only:true}),plain)).status,400);
  assert.equal(await reserved(environment),0);
});

test('canonical payment offers match the actual standard 402 and separate optional commercial products',async()=>{
  const environment={...env,PAYMENT_LEDGER:memoryD1()},log=console.log;console.log=()=>{};
  try{
    const contract=await(await handleRequest(new Request(origin+'/.well-known/agent-contract.json'),environment)).json();
    const offer=contract.offers.find(item=>item.tool==='agent_output_verification');
    const example=await(await handleRequest(new Request(offer.example_url),environment)).json();
    const paid=await handleRequest(request(origin+'/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:offer.tool,arguments:example.arguments}}),environment);
    assert.equal(paid.status,402);
    const required=JSON.parse(Buffer.from(paid.headers.get('payment-required'),'base64').toString());
    assert.deepEqual(offer.payment_requirements,required.accepts);
    const manifest=await(await handleRequest(new Request(origin+'/.well-known/x402'),environment)).json();
    assert.equal(manifest.pricing_models.tier_2_pro,undefined);
    assert.equal(manifest.additional_offerings.pricing_models.tier_2_pro.price,490);
    assert.equal(manifest.offers.find(row=>row.tool==='agent_output_verification').price_usdc,0.05);
    assert.equal(await reserved(environment),0);
  }finally{console.log=log;}
});

test('preflight client refuses discovery links outside the explicitly selected origin',async()=>{
  const calls=[];
  await assert.rejects(()=>inspectMachineAgent('https://trusted.test',{tool:'x',fetcher:async url=>{
    calls.push(url);return new Response(JSON.stringify({contract_version:'agent-call.v1',offers:[{tool:'x',input_schema_url:'https://untrusted.test/schema'}]}),{headers:{'content-type':'application/json'}});
  }}),/leaves the selected origin/);
  assert.equal(calls.length,1);
});

test('card and all payment manifest aliases advertise the same configured offers and legacy scope',async()=>{
  const primary=await(await handleRequest(new Request(origin+'/.well-known/x402'),env)).json();
  for(const path of ['/.well-known/payment-manifest','/.well-known/payment-manifest.json','/.well-known/mpp','/.well-known/mpp.json']){
    const document=await(await handleRequest(new Request(origin+path),env)).json();
    assert.equal(document.x402Version,2,path);
    assert.deepEqual(document.offers,primary.offers,path);
    assert.equal(document.monetization.payment_rails[0].signature_header,'PAYMENT-SIGNATURE');
    assert.match(document.monetization.settlement_endpoint_scope,/Legacy/);
  }
  const card=await(await handleRequest(new Request(origin+'/.well-known/agent-card.json'),env)).json();
  assert.equal(cardExtensionParams(card).x_agenda_intelligence.x402.version,2);
  assert.deepEqual(cardExtensionParams(card).x_agenda_intelligence.x402.offers,primary.offers);
  assert.match(cardExtensionParams(card).x_agenda_intelligence.x402.pricing_tiers_scope,/optional/);
});
