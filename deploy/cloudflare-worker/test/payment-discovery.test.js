import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {validateAgentCard} from '../scripts/verify-agent-card.js';
import {cardExtensionParams} from '../src/card-extension.js';
import {routingToolForProfile} from '../src/pricing-policy.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {BASE_USDC_WALLET,BASE_USDC_CONTRACT} from '../src/profiles.js';
const origin='https://example.test',uri='https://www.x402.org/';
const environment=profile=>({AGENT_PROFILE:profile,BILLING_MODE:'pay_per_call',X402_STANDARD:'1',VIZIER_DISABLED:'1'});
const read=async(path,env)=>(await handleRequest(new Request(origin+path),env)).json();
const identity={payTo:BASE_USDC_WALLET,network:'eip155:8453',asset:BASE_USDC_CONTRACT,currency:'USDC'};

test('every wire card exposes optional shallow x402 settlement discovery without violating A2A',async()=>{
  for(const profile of Object.keys(WORKED_EXAMPLES)){
    const env=environment(profile),card=await read('/.well-known/agent-card.json',env);
    assert.deepEqual(validateAgentCard(card),[],profile);
    const extension=card.capabilities.extensions.find(item=>item.uri===uri);
    assert.ok(extension,profile+': missing dedicated payment discovery');
    assert.equal(extension.required,false);
    for(const [key,value] of Object.entries(identity)) assert.equal(extension.params[key],value,profile+': '+key);
    assert.equal(extension.params.x402Version,2);
    assert.equal(extension.params.manifest,origin+'/.well-known/x402');
    assert.equal(card.payTo,undefined);
    assert.equal(cardExtensionParams(card).x_agenda_intelligence.a2a_send_message_example.expected.http_status_without_payment,
      routingToolForProfile(profile)?200:402,profile+': example admission');
    const manifest=await read('/.well-known/x402',env);
    for(const [key,value] of Object.entries(identity)) assert.equal(manifest[key],value,profile+': manifest '+key);
    assert.equal(manifest.manifest,extension.params.manifest);
    for(const path of ['/.well-known/payment-manifest.json','/.well-known/mpp.json']){
      const alias=await read(path,env);
      for(const [key,value] of Object.entries(identity)) assert.equal(alias[key],value,profile+': alias '+key);
    }
    assert.equal(manifest.explorer_url,'https://basescan.org/address/'+BASE_USDC_WALLET);
    for(const offer of manifest.offers.filter(row=>row.payment_required)){
      for(const requirement of offer.payment_requirements){
        assert.equal(requirement.payTo,manifest.payTo);
        assert.equal(requirement.network,manifest.network);
        assert.equal(requirement.asset,manifest.asset);
      }
    }
  }
});

test('discovery does not claim standard x402 when disabled or accept caller-selected recipients',async()=>{
  const env={...environment('agent_output_verification'),X402_STANDARD:'0'};
  const card=await read('/.well-known/agent-card.json?payTo=0x'+'b'.repeat(40),env);
  assert.ok(!card.capabilities.extensions.some(item=>item.uri===uri));
  assert.deepEqual(validateAgentCard(card),[]);
  const request=new Request(origin+'/.well-known/x402?payTo=0x'+'b'.repeat(40),{headers:{'x-payment-recipient':'0x'+'b'.repeat(40)}});
  const manifest=await(await handleRequest(request,env)).json();
  assert.equal(manifest.payTo,BASE_USDC_WALLET);
  assert.equal(manifest.x402Version,1);
  assert.equal(manifest.offers[0].price_usdc,0.01);
  assert.match(manifest.integration_status,/Legacy/);
});
