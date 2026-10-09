import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedMcpCall} from '../../../examples/hosted-mcp/client.mjs';
import {handleRequest} from '../src/index.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {memoryD1} from './helpers/d1.js';
import {signedRequest,mockRpc} from './helpers/payments.js';
const origin='https://example.test';
const tx='0x'+'a'.repeat(64);
for(const [profile,example] of Object.entries(WORKED_EXAMPLES)) {
 test(`fleet client ${profile}: exact MCP paid request recovers cached execution`,async()=>{
  const oldFetch=globalThis.fetch,oldLog=console.log;
  const price=profile==='m2m_escrow_arbiter'?.5:.05;
  globalThis.fetch=mockRpc(price); console.log=()=>{};
  try {
   const env={AGENT_PROFILE:profile,BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1',PAYMENT_LEDGER:memoryD1()};
   const seen=[];let lost=false,replayed=false;
   const call=createHostedMcpCall(example.tool,structuredClone(example.request),{endpoint:origin+'/mcp',requestId:'fleet-'+profile,headers:{'x-client-id':'agenda-owner-fleet-test'},fetchImpl:async(url,options)=>{
    seen.push({url,body:options.body,headers:{...options.headers}});
    const response=await handleRequest(new Request(url,options),env);
    if(options.headers['x-payment-signature'] && response.status===200 && !lost){lost=true;throw Error('lost response after execution');}
    if(response.headers.get('x-payment-replayed')==='1')replayed=true;
    return response;
   }});
   const admission=await call.evaluate();assert.equal(admission.status,'payment_required');assert.equal(admission.payment.required_usdc,price);
   const challenge=await call.retryWithPayment({transactionHash:tx});assert.equal(challenge.status,'signature_required');assert.equal(challenge.paymentTraceId,admission.paymentTraceId);
   const original=seen[1];const signed=await signedRequest(original.url,JSON.parse(original.body),tx,original.headers);
   await assert.rejects(call.retryWithPayment({signature:signed.headers.get('x-payment-signature')}),/lost response/);
   const recovered=await call.retryWithPayment();assert.equal(recovered.evaluated,true);assert.equal(replayed,true);
   assert.ok(seen.every(request=>request.body===seen[0].body));assert.deepEqual(seen[2],seen[3]);
   assert.ok(seen.every(request=>request.headers['x-payment-trace-id']===admission.paymentTraceId));
  } finally {globalThis.fetch=oldFetch;console.log=oldLog;}
 });
 test(`fleet site ${profile}: free example and common integration are available without wallet`,async()=>{
  const html=await(await handleRequest(new Request(origin,{headers:{accept:'text/html'}}),{AGENT_PROFILE:profile,BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1'})).text();
  assert.match(html,/tree\/main\/examples\/hosted-mcp/);assert.match(html,/Saved example result/);
  const show=html.match(/function showWorkedExample\(\) \{[\s\S]*?\n\}/)?.[0];assert.ok(show);
  let shown=false;const requests=[];
  const document={getElementById:id=>{assert.equal(id,'worked-example');return{set hidden(value){shown=value===false;},scrollIntoView(){}};}};
  const run=new Function('document','window','crypto','fetch','agendaTelemetryHeaders',show+'; return showWorkedExample;');
  const window={crypto:globalThis.crypto};
  const fetch=(url,options)=>{requests.push({url,options});return Promise.resolve(new Response(null));};
  const showExample=run(document,window,globalThis.crypto,fetch,(_url,headers)=>headers);
  showExample();showExample();assert.equal(shown,true);assert.equal(requests.length,1);
  assert.equal(requests[0].url,'/telemetry/worked-example');assert.equal(requests[0].options.body,undefined);
 });
}


test('retained client understands a standard MCP payment admission without treating it as evaluation',async()=>{
 const oldLog=console.log;console.log=()=>{};
 try {
  const call=createHostedMcpCall('strategic_risk_triage',{text:'Synthetic Aktau review'},{endpoint:origin+'/mcp/agent',
   fetchImpl:(url,options)=>handleRequest(new Request(url,options),{AGENT_PROFILE:'agenda',BILLING_MODE:'pay_per_call'})});
  const admission=await call.evaluate();
  assert.equal(admission.status,'payment_required');assert.equal(admission.evaluated,false);
  assert.equal(admission.payment.required_usdc,.05);
 }finally{console.log=oldLog;}
});
