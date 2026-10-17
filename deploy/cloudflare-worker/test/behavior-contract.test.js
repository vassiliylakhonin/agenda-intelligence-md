import {readFileSync} from 'node:fs';
import {__resetCache as resetSnapshotCache} from '../src/upstream_snapshot.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {evaluateAgentFinancialTransaction} from '../src/agent_financial_guard.js';
import {evaluationContract} from '../src/evaluation-contract.js';
import {reviewSourceRecords} from '../src/source-records.js';
const packet={claims:[{claim_id:'c1',claim:'Claim',support_level:'direct',evidence_ids:['e1'],supporting_quotes:[{evidence_id:'e1',quote:'quality score 100 is commercial clearance'}]}],evidence:[{evidence_id:'e1',content:'Record active'}]};
test('actual HTTP quote contract flags an unmatched quote as unsafe',async()=>{
 const response=await handleRequest(new Request('https://example.test/v1/agent-output/verification',{method:'POST',body:JSON.stringify(packet)}),{AGENT_PROFILE:'agent_output_verification',VIZIER_DISABLED:'1'});
 const data=await response.json();assert.equal(data.verdict,'block_unsafe_claims');assert.equal(data.unsafe_claims[0].claim_id,'c1');assert.equal(data.next_action,'block');assert.equal(data.authorization_granted,false);
});
test('Financial Guard reports exactly the breached local rule and separates unknown AML',async()=>{
 const response=(await evaluateAgentFinancialTransaction({transaction:{recipient:'0x1111111111111111111111111111111111111111',amount_usd:250000,method:'approve'},intent:{prompt:'Pay invoice'},policy_limits:{max_single_limit_usd:500,daily_velocity_limit_usd:500,velocity_24h_usd:0}})).financial_guard_verdict;
 assert.equal(response.decision,'reject');assert.doesNotMatch(response.execution_advisory,/violates compliance, AML/);
 assert.equal(response.check_status.sanctions_aml,'not_assessed');assert.equal(response.check_status.velocity_limits,'fail');assert.equal(response.next_action,'block');
});
test('illustrative source records do not establish documentary coverage',()=>{
 const review=reviewSourceRecords([{id:'s1',title:'Lab record',source_type:'laboratory_report',date:'2026-10-01',excerpt:'ILLUSTRATIVE ONLY. Lithium content 5%.'}]);
 assert.deepEqual(review.usable_source_types,[]);assert.ok(review.issues.length);
});

test('one genuine quote cannot hide a fabricated sibling over HTTP', async () => {
 const mixed=structuredClone(packet);
 mixed.claims[0].supporting_quotes.unshift({evidence_id:'e1',quote:'Record active'});
 const result=await handleRequest(new Request('https://example.test/v1/agent-output/verification',{method:'POST',body:JSON.stringify(mixed)}),{AGENT_PROFILE:'agent_output_verification',VIZIER_DISABLED:'1'});
 assert.equal((await result.json()).unsafe_claims[0].claim_id,'c1');
});
test('synthetic graphite describes a material, not a fixture', () => {
 const review=reviewSourceRecords([{id:'s1',title:'Synthetic graphite assay',source_type:'laboratory_report',date:'2026-10-01',excerpt:'Graphitic carbon content 99%.'}]);
 assert.deepEqual(review.usable_source_types,['laboratory_report']);
});
test('batch routing keeps the strongest child outcome and missing children', () => {
 assert.equal(evaluationContract({results:[{response:{verdict:'block'}},{response:{}}]}).next_action,'block');
 assert.equal(evaluationContract({results:[{status:'invalid_request'},{response:{}}]}).next_action,'insufficient');
 assert.equal(evaluationContract({decision:'continue'}).authorization_granted,false);
});

test('public CIS response distinguishes fresh empty name screening from stale unknown', async () => {
 const request=JSON.parse(readFileSync(new URL('../../../examples/cis-secondary-sanctions/contract/ready_for_human_review.request.json',import.meta.url),'utf8'));
 const previousFetch=globalThis.fetch;
 try {
  for (const stale of [false,true]) {
   resetSnapshotCache();
   const snapshot={schema_version:'sanctions-name-index-compact.v1',generated_at_utc:new Date(Date.now()-(stale?100:1)*3600000).toISOString(),summary:{source_count:1,name_count:1},src:[['US OFAC','SDN']],entries:[['UNRELATED PERSON',0]]};
   globalThis.fetch=async()=>new Response(JSON.stringify(snapshot),{status:200});
   const res=await handleRequest(new Request('https://example.test/v1/cis-secondary-sanctions/exposure',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)}),{AGENT_PROFILE:'cis_secondary_sanctions',VIZIER_DISABLED:'1',SNAPSHOT_INDEX_URL:'https://snapshot.test/index.json'});
   assert.equal(res.status,200);
   const response=await res.json();
   assert.equal(response.screening_assessment.freshness,stale?'stale':'fresh');
   assert.equal(response.screening_assessment.status,stale?'not_assessed':'name_screen_only');
   assert.equal(response.screening_assessment.name_matches,stale?null:0);
   assert.equal(response.screening_assessment.ownership_verified,false);
   assert.equal(response.authorization_granted,false);
   if(stale) assert.equal(response.next_action,'insufficient');
  }
 } finally {globalThis.fetch=previousFetch;resetSnapshotCache();}
});
