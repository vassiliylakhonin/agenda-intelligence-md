import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {generateBankabilityScreen} from '../src/corridor_bankability.js';
import {lookupChplTier, CHPL_CODES} from '../src/chpl.js';
import {verifyGatewayWithVizier} from '../src/upstream_vizier_gateway.js';
import {verifyAssistantWithVizier} from '../src/upstream_vizier_assistant.js';
import {verifyMarketEntryWithVizier} from '../src/upstream_vizier_market_entry.js';
import {verifyMiddleCorridorWithVizier} from '../src/upstream_vizier_middle_corridor.js';
import {screenMaritimeExposureWithVizier} from '../src/upstream_vizier_maritime.js';

async function evaluate(profile,args,upstream) {
 const env={AGENT_PROFILE:profile,VIZIER_DISABLED:upstream ? '0':'1',LIVE_RETRIEVAL_ENABLED:'0',...(upstream ? {VIZIER:upstream}: {})};
 const response=await handleRequest(new Request('https://example.test/mcp',{method:'POST',headers:{'content-type':'application/json','user-agent':'agenda-fleet-contract-test'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:WORKED_EXAMPLES[profile].tool,arguments:args}})}),env);
 assert.equal(response.status,200);
 const body=await response.json();assert.ok(!body.error && !body.result?.isError,JSON.stringify(body));
 const data=body.result.structuredContent;
 return data.metadata?.response || data;
}
for(const profile of Object.keys(WORKED_EXAMPLES)) {
 test(`fleet: ${profile} published example remains callable without wallet locally`,async()=>{
  const body=await evaluate(profile,structuredClone(WORKED_EXAMPLES[profile].request));
  assert.ok(body && typeof body==='object');
 });
}
for(const profile of ['kazakhstan','agentic_interaction_trust','gulf_maritime_exposure','cis_secondary_sanctions']) {
 test(`fleet: ${profile} impossible dates cannot buy readiness`,async()=>{
  const args=structuredClone(WORKED_EXAMPLES[profile].request);
  for(const source of args.dated_sources)source.date='2026-02-30';
  const body=await evaluate(profile,args);
  assert.equal(body.decision_readiness_score,0);
  assert.ok(body.source_record_review.issues.length);
 });
}
test('bankability: asserted guarantee cannot hide poor coverage; zero-debt DSCR is inapplicable',()=>{
 const req={project_name:'Synthetic port',corridor_leg:'Aktau-Baku',capex_usd_m:100,ifi_debt_usd_m:60,dscr_min:0.8,has_sovereign_guarantee:true};
 const body=generateBankabilityScreen(req);
 assert.equal(body.bankability_status,'HIGH_DEFAULT_RISK');
 assert.equal(body.covenant_checks[0].result,'FAILS');
 assert.equal(generateBankabilityScreen({...req,ifi_debt_usd_m:0}).covenant_checks[0].result,'NOT_APPLICABLE');
});
test('CHPL: exact HS6 membership, correct 4A/4B, no prefix overreach',()=>{
 assert.equal(Object.values(CHPL_CODES).flat().length,50);
 assert.equal(lookupChplTier('8457.10').tier,'Tier 4.B');
 assert.equal(lookupChplTier('848620').tier,'Tier 4.A');
 assert.equal(lookupChplTier('847180').tier,'Tier 4.A');
 assert.equal(lookupChplTier('851769').tier,'Tier 3.A');
 for(const code of ['8542','854234','851711','abc854231','903031'])assert.equal(lookupChplTier(code).isHighPriority,false,code);
 assert.equal(lookupChplTier('8542310000').tier,'Tier 1');
});
test('market entry: open blockers produce pause and owner work',async()=>{
 const args=structuredClone(WORKED_EXAMPLES.market_entry_readiness.request);
 args.known_blockers=['Signing authority is disputed'];
 const body=await evaluate('market_entry_readiness',args);
 assert.equal(body.gate_decision,'pause_for_evidence');
 assert.match(body.strongest_reason_to_pause,/Signing authority is disputed/);
 assert.ok(body.owner_actions.some(a=>a.action.includes('Signing authority')));
});
for(const profile of ['market_entry_readiness','agentic_interaction_trust','dual_use_technology_export']) {
 test(`fleet: ${profile} upstream outage is incomplete screening, not a leak or clearance`,async()=>{
  const args=structuredClone(WORKED_EXAMPLES[profile].request);
  const body=await evaluate(profile,args,{fetch:async()=>new Response('Unavailable',{status:503})});
  const text=JSON.stringify(body);
  assert.match(text,/unavailable or incomplete/);
  assert.doesNotMatch(text,/Leaked credentials or sensitive secrets detected|DLP Firewall detected sensitive/);
  assert.notEqual(body.decision_readiness_label,'review_ready');
 });
}
for(const [label,verify,args] of [
 ['gateway',(env,args)=>verifyGatewayWithVizier(env,'',args),{counterparties:[{name:'Flagged Co'},{name:'Second Co'}]}],
 ['assistant',(env,args)=>verifyAssistantWithVizier(env,'',args),{counterparties:[{name:'Flagged Co'},{name:'Second Co'}]}],
 ['market',verifyMarketEntryWithVizier,{partner_or_company:'Flagged Co',counterparties:[{name:'Second Co'}]}],
 ['middle',verifyMiddleCorridorWithVizier,{counterparties:[{name:'Flagged Co'},{name:'Second Co'}]}],
 ['maritime',screenMaritimeExposureWithVizier,{vessel:{name:'Flagged Co'},counterparties:[{name:'Second Co'}]}]
]) {
 for(const throws of [false,true])test(`fleet: ${label} keeps an earlier adverse match after later ${throws?'exception':'503'}`,async()=>{
  let n=0;
  const result=await verify({VIZIER:{fetch:async()=>{
   if(++n===1)return Response.json({violation:true,aggregate_blocked_percentage:100,reason_codes:['OFAC_SDN_MATCH'],clean:false});
   if(throws)throw Error('connection reset');
   return new Response('Unavailable',{status:503});
  }}},args);
  assert.equal(result.status,'degraded');
  assert.equal(result.violation,true);
  assert.equal((result.sanctions_screening?.matches || result.matches).length,1);
 });
}

for(const profile of ['agenda','corridor_sanctions_assistant'])test(`fleet: ${profile} failed DLP/name request does not invent a leak in prose`,async()=>{
 const response=await handleRequest(new Request('https://example.test/message/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'message/send',params:{counterparties:[{name:'Example Logistics LLP'}],message:{role:'user',parts:[{text:'Review this corridor transaction with Example Logistics LLP'}]}}})}),{AGENT_PROFILE:profile,VIZIER:{fetch:async()=>new Response('Unavailable',{status:503})}});
 const body=await response.json();const task=body.result.task || body.result;
 assert.equal(task.metadata.vizier_status,'degraded');
 const prose=task.artifacts.flatMap(a=>a.parts.map(p=>p.text || '')).join('\n');
 assert.match(prose,/screening is unavailable or incomplete/);
 assert.doesNotMatch(prose,/Sensitive credentials.*detected|Sensitive credentials.*flagged/);
 assert.equal(task.metadata.vizier_clearance_receipt,null);
});
