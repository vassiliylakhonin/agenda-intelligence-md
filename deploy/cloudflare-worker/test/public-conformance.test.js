import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {publicTargets,verifyPublicAgent} from '../scripts/public-conformance.js';
import {memoryD1} from './helpers/d1.js';
async function environment(profile) {
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const key=await crypto.subtle.exportKey('jwk',pair.privateKey);key.kid='synthetic-conformance';
  return {AGENT_PROFILE:profile,AGENT_CARD_SIGNING_KEY:JSON.stringify(key),BILLING_MODE:'pay_per_call',PAYMENT_LEDGER:memoryD1(),VIZIER_DISABLED:'1'};
}
for(const [name,profile] of [['agent-financial-guard','agent_financial_guard'],['m2m-escrow-arbiter','m2m_escrow_arbiter']]) {
  test(`public verifier exercises ${name} signed paid handler without funds`,async()=>{
    const env=await environment(profile);const target=publicTargets().find(item=>item.key===name);
    const result=await verifyPublicAgent(target,{fetchImpl:(url,options)=>handleRequest(new Request(url,options),env)});
    assert.equal(result.signature_verified,1);assert.equal(result.payment_admission,1);assert.equal(result.refusals,6);
  });
}
test('public verifier rejects a tampered served card instead of counting discovery as healthy',async()=>{
  const env=await environment('agent_financial_guard');const target=publicTargets().find(item=>item.key==='agent-financial-guard');
  await assert.rejects(verifyPublicAgent(target,{fetchImpl:async(url,options)=>{
    const response=await handleRequest(new Request(url,options),env);
    if(new URL(url).pathname!=='/.well-known/agent-card.json')return response;
    const card=await response.json();card.description+=' altered after signing';return Response.json(card);
  }}),/signature verification failed/);
});
