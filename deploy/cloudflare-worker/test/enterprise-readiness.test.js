import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { handleRequest } from '../src/index.js';
import { evaluateM2MEscrowArbitration } from '../src/m2m_escrow_arbiter.js';
const payload = () => ({escrow_id:'audit',deal_terms:{buyer_id:'buyer',seller_id:'seller',amount_usd:500,currency:'USDC',deadline_utc:'2026-10-01T00:00:00Z',arbitration_policy:'pro_rata'},specification:{deliverable_type:'json_data'},delivery_submission:{submitted_at:'2026-09-23T00:00:00Z',telemetry:{total_items:100,valid_items:100}}});
test('missing artifacts cannot be marked verified or authorize funds', async () => {
 const r = (await evaluateM2MEscrowArbitration(payload())).arbitration_ruling;
 assert.equal(r.checks.hash_verified,false); assert.equal(r.checks.schema_verified,false);
 assert.equal(r.check_status.hash,'not_evaluated'); assert.equal(r.check_status.schema,'not_evaluated');
 assert.equal(r.ruling,'ESCALATE_HUMAN'); assert.equal(r.settlement_authorized,false);
 assert.equal(r.payout_breakdown.arbiter_fee_usd,0); assert.ok(r.evidence_gaps.length >= 3);
});
test('artifact hash is computed from content, including empty string; declared digests cannot override it', async () => {
 const p=payload();p.specification.expected_schema={type:'string'};p.delivery_submission.artifact_data='';
 p.specification.expected_artifact_sha256=createHash('sha256').update('').digest('hex');
 let r=(await evaluateM2MEscrowArbitration(p)).arbitration_ruling;
 assert.equal(r.check_status.hash,'passed');assert.equal(r.checks.schema_verified,true);assert.equal(r.checks.slo_verified,false);
 p.delivery_submission.artifact_data='changed';p.delivery_submission.artifact_sha256=p.specification.expected_artifact_sha256;
 r=(await evaluateM2MEscrowArbitration(p)).arbitration_ruling;
 assert.equal(r.check_status.hash,'failed');assert.equal(r.checks.hash_verified,false);assert.equal(r.ruling,'ESCALATE_HUMAN');
});
test('dossier escapes untrusted markup and ignores forged verdicts',async()=>{
 const res=await handleRequest(new Request('https://example.test/v1/dossier/export',{method:'POST',headers:{'content-type':'application/json',accept:'text/html'},body:JSON.stringify({cargo:'<img src=x onerror=alert(1)>',verdict:'CLEARED'})}));
 const html=await res.text();assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));
 assert.ok(!html.includes('CLEARED'));assert.match(html,/Synthetic demonstration/);assert.match(html,/jws_signature: null/);assert.equal(res.headers.get('cache-control'),'no-store');
});
test('public schemas and trust documents are accessible',async()=>{
 for(const path of ['/trust','/privacy','/terms']){const res=await handleRequest(new Request('https://example.test'+path));assert.equal(res.status,200);assert.match(await res.text(),/Operator: Vassiliy Lakhonin/);}
 const res=await handleRequest(new Request('https://example.test/schemas/v1/m2m-escrow-arbiter-request.schema.json'));
 assert.equal(res.status,200);assert.ok((await res.json()).required.includes('escrow_id'));
});

test('OpenAPI response contracts differ from requests and schema links resolve', async () => {
 const res = await handleRequest(new Request('https://example.test/api/openapi.json'));
 assert.equal(res.status, 200);
 const spec = await res.json();
 assert.equal(spec.openapi, '3.1.0');
 for (const route of Object.values(spec.paths)) {
   const operation = route.post;
   const requestRef = operation?.requestBody?.content?.['application/json']?.schema?.$ref;
   if (!requestRef?.startsWith('/schemas/')) continue;
   const response = operation.responses[200].content['application/json'].schema;
   assert.notEqual(response['x-canonical-schema'], requestRef);
   for (const path of [requestRef, response['x-canonical-schema']]) {
     assert.equal((await handleRequest(new Request('https://example.test' + path))).status, 200);
   }
 }
});
