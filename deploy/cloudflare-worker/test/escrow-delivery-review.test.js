import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
import {evaluateM2MEscrowArbitration} from '../src/m2m_escrow_arbiter.js';
import {handleMcpJsonRpc,handleRequest} from '../src/index.js';
import {mcpToolsForProfile} from '../src/mcp.js';
import {validatePublishedInput} from '../src/input-validation.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {escrowReviewHtml} from '../src/escrow-review-view.js';
import {reviewDelivery} from '../../../examples/m2m-escrow-arbiter/review-delivery.mjs';
import {simulatePolicyWhatIf} from '../../../examples/m2m-escrow-arbiter/policy-what-if.mjs';
const sample=WORKED_EXAMPLES.m2m_escrow_arbiter.request,env={AGENT_PROFILE:'m2m_escrow_arbiter',VIZIER_DISABLED:'1'};
const escape=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
test('matching artifact and untrusted attestation never authorize payout or verify time/SLO',async()=>{
 const req=structuredClone(sample);req.delivery_submission.attestation_references=[{kind:'signed_delivery_receipt',issuer:'Unverified issuer',reference:'receipt-123'}];const out=await evaluateM2MEscrowArbitration(req),r=out.arbitration_ruling.delivery_review;assert.equal(r.escrow_action,'HOLD');assert.equal(r.proposed_allocation,null);assert.equal(r.hash_check,'pass');assert.equal(r.schema_check,'pass');assert.equal(r.deadline_check,'unverified');assert.equal(r.slo_check,'unverified');assert.deepEqual(r.independent_attestations,{references_provided:1,verification_status:'not_verified'});assert.equal(out.authorization_granted,false);assert.equal(out.arbitration_ruling.settlement_authorized,false);
 const result=await reviewDelivery({escrowId:req.escrow_id,terms:req.deal_terms,spec:req.specification,submission:req.delivery_submission},async()=>out);assert.equal(result.authorization_granted,false);await assert.rejects(()=>reviewDelivery({escrowId:'x',terms:{},spec:{},submission:{}},async()=>({...out,authorization_granted:true})));
 assert.match(escrowReviewHtml(out,escape),/Recommended action: HOLD/);assert.equal(escrowReviewHtml({...out,authorization_granted:true},escape),'');
});
test('mismatched hash and unsupported schema remain explicit and on hold',async()=>{
 const req=structuredClone(sample);req.delivery_submission.artifact_data={records:2};let r=(await evaluateM2MEscrowArbitration(req)).arbitration_ruling.delivery_review;assert.equal(r.hash_check,'fail');assert.match(r.next_one_thing,/mismatch/);assert.equal(r.escrow_action,'HOLD');
 req.specification.expected_schema={$ref:'https://example.invalid/schema'};r=(await evaluateM2MEscrowArbitration(req)).arbitration_ruling.delivery_review;assert.equal(r.schema_check,'unsupported');assert.equal(r.slo_check,'unverified');
 delete req.delivery_submission.artifact_data;r=(await evaluateM2MEscrowArbitration(req)).arbitration_ruling.delivery_review;assert.equal(r.hash_check,'missing');assert.equal(r.schema_check,'missing');
});
test('MCP accepts flat and legacy inputs without bypassing validation',async()=>{
 const schema=mcpToolsForProfile('m2m_escrow_arbiter').find(x=>x.name==='m2m_escrow_arbitration_ruling').inputSchema;assert.equal(schema.oneOf.length,2);for(const input of [sample,{request:sample}])assert.equal(validatePublishedInput('m2m_escrow_arbiter',{tool:'m2m_escrow_arbitration_ruling',input},true).body.valid,true);
 const call=args=>handleMcpJsonRpc({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'m2m_escrow_arbitration_ruling',arguments:args}},new Request('https://example.test/mcp'),env);const old=console.log;console.log=()=>{};try{const flat=await call(sample),wrapped=await call({request:sample});assert.equal(flat.result.isError,false);assert.equal(wrapped.result.isError,false);assert.equal(flat.result.structuredContent.arbitration_ruling.delivery_review.escrow_action,'HOLD');assert.equal(wrapped.result.structuredContent.metadata.response.arbitration_ruling.delivery_review.escrow_action,'HOLD');const bad=structuredClone(sample);bad.delivery_submission.extra='x';assert.equal((await call(bad)).result.isError,true);assert.equal((await call({request:bad})).result.isError,true);}finally{console.log=old;}
});
test('bundled page runs the review renderer',async()=>{
 const built=await build({entryPoints:[new URL('../src/index.js',import.meta.url).pathname],bundle:true,keepNames:true,platform:'neutral',format:'esm',write:false});const bundled=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));const old=console.log;console.log=()=>{};try{const html=await(await bundled.handleRequest(new Request('https://example.test/',{headers:{accept:'text/html'}}),{...env,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'})).text();assert.ok(html.includes('id="escrow-review-view"'));const box={value:'{}'},ctx={URL,TextEncoder,window:{location:{href:'https://example.test/',origin:'https://example.test'},crypto:globalThis.crypto},crypto:globalThis.crypto,document:{getElementById:id=>id==='profile-request'?box:null,createElement:()=>({set textContent(x){this.innerHTML=String(x);}})}};vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],ctx);assert.match(ctx.escrowReviewHtml(await evaluateM2MEscrowArbitration(sample),String),/Recommended action: HOLD/);}finally{console.log=old;}
});


test('policy what-if uses explicit hypothetical assumptions without creating a payout',()=>{
 const result=simulatePolicyWhatIf({escrow_minor:10000,fee_minor:100,completion_bps:7500,threshold_bps:9500,penalty_bps:1000});
 assert.equal(result.authorization_granted,false);assert.equal(result.settlement_authorized,false);assert.equal(result.kind,'hypothetical_arithmetic_only');assert.deepEqual(result.scenarios.map(x=>[x.buyer_minor,x.seller_minor]),[[9900,0],[2475,7425],[990,8910]]);assert.ok(result.scenarios.every(x=>x.buyer_minor+x.seller_minor===9900));
 for(const args of [{escrow_minor:NaN},{escrow_minor:100,fee_minor:101,completion_bps:0,threshold_bps:0,penalty_bps:0},{escrow_minor:100,fee_minor:0,completion_bps:10001,threshold_bps:0,penalty_bps:0}])assert.throws(()=>simulatePolicyWhatIf(args));
});
