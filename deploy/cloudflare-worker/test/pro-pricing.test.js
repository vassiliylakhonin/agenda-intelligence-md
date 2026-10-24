import test from 'node:test';
import assert from 'node:assert/strict';
import {privateKeyToAccount} from 'viem/accounts';
import {handleRequest,agentCard} from '../src/index.js';
import {cardExtensionParams} from '../src/card-extension.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {memoryD1} from './helpers/d1.js';
import {mockRpc,payer} from './helpers/payments.js';
import {settlementChallengeMessage,paymentActivationChallenge,checkDynamicBearerToken} from '../src/settlement.js';

const origin='https://example.test';
const tx='0x'+'2'.repeat(64);
const account=privateKeyToAccount('0x'+'11'.repeat(32)); // Public synthetic fixture, never funded.
const request=body=>new Request(origin+'/v1/settle',{method:'POST',headers:{'content-type':'application/json','x-client-id':'agenda-owner-pro-pricing-test'},body:JSON.stringify(body)});
const quiet=async fn=>{const log=console.log;console.log=()=>{};try{return await fn();}finally{console.log=log;}};

test('Pro costs 49 for 10000 checks and all twelve public profiles quote the same discounted amount',()=>quiet(async()=>{
  for(const profile of Object.keys(WORKED_EXAMPLES)) {
    const env={AGENT_PROFILE:profile,BILLING_MODE:'pay_per_call',X402_STANDARD:'1',VIZIER_DISABLED:'1'};
    const manifest=await(await handleRequest(new Request(origin+'/.well-known/x402'),env)).json();
    const pro=manifest.additional_offerings.pricing_models.tier_2_pro;
    assert.equal(pro.price,49,profile);
    assert.equal(pro.quota,'10,000 queries/month');
    assert.ok(pro.price/10000<0.01,'Pro must cost less than the same number of ordinary paid checks');
    assert.equal(cardExtensionParams(agentCard(new Request(origin),env)).x_agenda_intelligence.x402.pricing_tiers.tier_pro_monthly_usdc,49);
    const settle=await(await handleRequest(new Request(origin+'/v1/settle'),env)).json();
    assert.equal(settle.supported_tiers.tier_2_pro.amount_usd,49);
    for(const path of ['/.well-known/payment-manifest','/.well-known/mpp']) {
      const text=await(await handleRequest(new Request(origin+path),env)).text();
      assert.ok(!/\b490\b/.test(text),profile+path+' must not advertise the retired price');
    }
    const html=await(await handleRequest(new Request(origin+'/',{headers:{accept:'text/html'}}),env)).text();
    assert.doesNotMatch(html,/\$490\b|490 USDC|490USD|payWithBaseWallet\(490\)/);
    if(profile==='agent_financial_guard') {
      assert.match(html,/payWithBaseWallet\(49\)/);
      assert.match(html,/Pay \$49 Pro/);
    }
  }
}));

test('signed activation accepts 49, refuses underpayment and retains 30 days, quota and replay protection',()=>quiet(async()=>{
  const oldFetch=globalThis.fetch;
  const env={PAYMENT_LEDGER:memoryD1()};
  const body={tx_hash:tx,tier:'tier_2_pro',payer_signature:await account.signMessage({message:settlementChallengeMessage(tx,payer)})};
  try {
    globalThis.fetch=mockRpc(48.99);
    const short=await handleRequest(request(body),env);
    assert.equal(short.status,400);
    assert.equal((await short.json()).required_usd,49);
    assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM pro_tokens').first()).n,0);
    globalThis.fetch=mockRpc(49);
    const unsigned=await handleRequest(request({...body,payer_signature:undefined}),env);
    assert.equal(unsigned.status,400);
    const accepted=await handleRequest(request(body),env);
    assert.equal(accepted.status,200);
    const result=await accepted.json();
    assert.equal(result.receipt.amount_usdc,49);
    assert.equal(result.valid_days,30);
    assert.equal(result.monthly_quota,10000);
    const token=await checkDynamicBearerToken(result.bearer_token,env);
    assert.equal(token.quota,10000);
    assert.equal(token.used,0);
    assert.equal((await handleRequest(request(body),env)).status,409);
  } finally {globalThis.fetch=oldFetch;}
}));

test('a legacy 49 dossier activation stays a dossier when tier is omitted',()=>quiet(async()=>{
  const oldFetch=globalThis.fetch,env={PAYMENT_LEDGER:memoryD1()};
  try {
    globalThis.fetch=mockRpc(49);
    const payer_signature=await account.signMessage({message:paymentActivationChallenge(tx,payer,'tier_3_deal_dossier')});
    const response=await handleRequest(request({tx_hash:tx,payer_signature}),env);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.tier,'tier_3_deal_dossier');
    assert.equal(body.bearer_token,undefined);
    assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM pro_tokens').first()).n,0);
  } finally {globalThis.fetch=oldFetch;}
}));


test('an old 490 Pro payment without a tier retains its historical activation route',()=>quiet(async()=>{
  const oldFetch=globalThis.fetch,env={PAYMENT_LEDGER:memoryD1()};
  try {
    globalThis.fetch=mockRpc(490);
    const payer_signature=await account.signMessage({message:settlementChallengeMessage(tx,payer)});
    const response=await handleRequest(request({tx_hash:tx,payer_signature}),env);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.tier,'tier_2_pro');
    assert.equal(body.receipt.amount_usdc,490);
    assert.equal(body.monthly_quota,10000);
  } finally {globalThis.fetch=oldFetch;}
}));
