import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {handleRequest,agentCard} from '../src/index.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {memoryD1} from './helpers/d1.js';
import {executePaidRequest,paidRequestChallenge,paidRequestHash} from '../src/paid-execution.js';
import {privateKeyToAccount} from 'viem/accounts';
import {mockRpc} from './helpers/payments.js';

const origin='https://example.test';
const headers={'content-type':'application/json','x-client-id':'agenda-owner-entry-pricing-test'};
const environment=profile=>({AGENT_PROFILE:profile,BILLING_MODE:'pay_per_call',X402_STANDARD:'1',WORKER_FREE_TRIAL:'1',VIZIER_DISABLED:'1'});
const request=(path,body,extra={})=>new Request(origin+path,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
const mcp=(name,args)=>({jsonrpc:'2.0',id:'pricing',method:'tools/call',params:{name,arguments:args}});
const freeProfiles=new Set(['agenda','corridor_sanctions_assistant']);
const quiet=async fn=>{const log=console.log;console.log=()=>{};try{return await fn();}finally{console.log=log;}};
const required=response=>JSON.parse(Buffer.from(response.headers.get('payment-required'),'base64').toString()).accepts[0].amount;

test('all twelve primary operations enforce their published price across MCP and A2A',()=>quiet(async()=>{
  for(const profile of Object.keys(WORKED_EXAMPLES)) {
    const env=environment(profile),card=agentCard(new Request(origin),env);
    const contract=await(await handleRequest(new Request(origin+'/.well-known/agent-contract.json'),env)).json();
    const offer=contract.offers[0],expected=freeProfiles.has(profile)?0:profile==='m2m_escrow_arbiter'?0.05:0.01;
    assert.equal(offer.price_usdc,expected,profile);
    assert.equal(offer.payment_required,expected>0,profile);
    const sample=await(await handleRequest(new Request(offer.example_url),env)).json();
    const calls=[request('/mcp',mcp(offer.tool,sample.arguments)),
      request('/message/send',card.x_agenda_intelligence.a2a_send_message_example.request,{'a2a-version':'1.0'})];
    for(const req of calls) {
      const response=await handleRequest(req,env);
      assert.equal(response.status,expected?402:200,profile+': '+await response.clone().text());
      if(expected)assert.equal(required(response),String(expected*1000000));
      else assert.equal(response.headers.get('payment-required'),null);
    }
    const terms=await(await handleRequest(new Request(origin+(profile==='agent_output_verification'?'/v1/agent-output/trial':'/v1/trial')),env)).json();
    assert.equal(terms.paid_price_usdc,expected,profile);
  }
}));

test('a free host still charges 25 for a model export and 0.01 for HS screening',()=>quiet(async()=>{
  const env=environment('agenda');
  const bank={project_name:'Synthetic',corridor_leg:'Aktau-Baku',capex_usd_m:10,ifi_debt_usd_m:0,dscr_min:1.5};
  for(const req of [request('/mcp',mcp('corridor_bankability_screen',bank)),request('/v1/corridor-bankability/screen',bank)]) {
    const response=await handleRequest(req,env);
    assert.equal(response.status,200);
    const body=await response.json(),preview=body.result?.structuredContent || body;
    assert.equal(preview.unlocked_full_dossier,false);
    assert.equal(preview.continuation.optional_paid_continuation.amount_usdc,25);
  }
  const hs=await handleRequest(request('/mcp',mcp('screen_dual_use_hs_code',{hs_code:'854231'})),environment('corridor_sanctions_assistant'));
  assert.equal(hs.status,402);
  assert.equal(required(hs),'10000');
  const protectedEnv={...environment('cis_secondary_sanctions'),CIS_SECONDARY_SANCTIONS_API_KEY:'synthetic-key'};
  assert.equal((await handleRequest(request('/mcp',mcp('strategic_risk_triage',{text:'question'})),protectedEnv)).status,401);
}));

test('free routing never consumes trial or Pro allowance and retains its hourly limit',()=>quiet(async()=>{
  const fetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Free routing must not fetch');};
  const forbidden=new Proxy({}, {get(){throw Error('Routing must not touch paid/trial storage');}});
  try {
    for(const [profile,tool] of [['agenda','strategic_risk_triage'],['corridor_sanctions_assistant','corridor_sanctions_assistant']]) {
      const state=new Map(),env={...environment(profile),PAYMENT_LEDGER:forbidden,RATE_LIMIT_PER_HOUR:'1',
        AGENDA_USAGE:{get:async key=>state.get(key),put:async(key,value)=>state.set(key,value)}};
      const req=()=>request('/mcp',mcp(tool,{text:'What evidence is needed before an Aktau-Baku shipment?'}),{authorization:'Bearer agy_pro_synthetic'});
      assert.equal((await handleRequest(req(),env)).status,200);
      const refused=await handleRequest(req(),env);
      assert.equal(refused.status,429);
      assert.equal(refused.headers.get('payment-required'),null);
      assert.equal(refused.headers.get('www-authenticate'),null);
      assert.equal((await refused.json()).error.data.code,'free_routing_quota_exceeded');
    }
  } finally {globalThis.fetch=fetch;}
}));

test('routing browser console uses the normal free tool without a wallet or campaign reservation',()=>quiet(async()=>{
  const env=environment('agenda');
  const html=await(await handleRequest(new Request(origin+'/?owner_test=1',{headers:{accept:'text/html'}}),env)).text();
  assert.match(html,/Route question free/);
  assert.doesNotMatch(html,/Choose paid evaluation — 0 USDC/);
  const ids=['profile-run','profile-status','profile-result','profile-response','profile-summary','profile-request'];
  const elements=Object.fromEntries(ids.map(id=>[id,{value:JSON.stringify({text:'What evidence is needed before an Aktau-Baku shipment?'}),innerHTML:'',textContent:'',hidden:true}]));
  const calls=[],context={URL,crypto:globalThis.crypto,window:{location:{href:origin+'/?owner_test=1',origin},crypto:globalThis.crypto},
    document:{getElementById:id=>elements[id],createElement:()=>({set textContent(v){this.innerHTML=String(v);}})},
    fetch:async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return handleRequest(new Request(url,init),env);}};
  vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],context);
  context.agendaPaidFetch=()=>{throw Error('Routing must not enter checkout');};
  await context.runProfileExample({preventDefault(){}});
  assert.equal(calls.length,1);
  assert.equal(new URL(calls[0].url).pathname,'/mcp/agent');
  assert.equal(calls[0].body.params.name,'strategic_risk_triage');
  assert.match(elements['profile-status'].textContent,/returned/);
  const previousResult=elements['profile-result'].textContent,previousSummary=elements['profile-summary'].innerHTML;
  context.fetch=async()=>Response.json({jsonrpc:'2.0',id:1,result:{isError:true,content:[{type:'text',text:'Invalid routing input'}]}});
  await context.runProfileExample({preventDefault(){}});
  assert.match(elements['profile-status'].textContent,/Tool refused/);
  assert.equal(elements['profile-result'].textContent,previousResult);
  assert.equal(elements['profile-summary'].innerHTML,previousSummary);
}));

test('a previously paid legacy routing result remains recoverable without a new execution or network call',()=>quiet(async()=>{
  const env={...environment('agenda'),PAYMENT_LEDGER:memoryD1()},body=mcp('strategic_risk_triage',{text:'Synthetic routing request'});
  const tx='0x'+'a'.repeat(64),req=request('/mcp',body,{'x-payment-tx':tx});
  const signature=await privateKeyToAccount('0x'+'11'.repeat(32)).signMessage({message:paidRequestChallenge(tx,await paidRequestHash(req,body))});
  req.headers.set('x-payment-signature',signature);
  const old=globalThis.fetch;
  try {
    globalThis.fetch=mockRpc(0.05);
    const seeded=await executePaidRequest(req.clone(),body,env,0.05,()=>Response.json({old_result:true}));
    assert.equal(seeded.status,200);
    globalThis.fetch=()=>{throw Error('Cached routing recovery must not access a network');};
    const replay=await handleRequest(req.clone(),env);
    assert.equal(replay.status,200);
    assert.equal(replay.headers.get('x-payment-replayed'),'1');
    assert.deepEqual(await replay.json(),{old_result:true});
    const fresh=request('/mcp',body,{'x-payment-tx':'0x'+'b'.repeat(64),'x-payment-signature':signature});
    assert.equal((await handleRequest(fresh,env)).status,400);
  } finally {globalThis.fetch=old;}
}));
