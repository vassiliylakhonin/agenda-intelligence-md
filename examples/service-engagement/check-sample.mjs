// Entirely local synthetic acceptance demonstration; no buyer acceptance.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reviewAnswer} from '../../deploy/cloudflare-worker/src/answer-review.js';
import {evaluateM2MEscrowArbitration} from '../../deploy/cloudflare-worker/src/m2m_escrow_arbiter.js';
const sources=[{source_id:'s1',text:'The report lists three warehouses.'}];
const first=reviewAnswer({answer:'The report says “five warehouses” [s1](https://example.invalid/source)',sources});
assert.ok(first.findings.some(item=>item.code==='quote_not_found'));
const repaired=reviewAnswer({answer:'The report says “three warehouses” [s1](https://example.invalid/source)',sources});
assert.equal(repaired.route,'human_review');
assert.equal(repaired.semantic_support,'not_assessed');
assert.equal(repaired.authorization_granted,false);
const artifact={records:1};
const request={escrow_id:'synthetic-integrity-demo',
  deal_terms:{buyer_id:'synthetic-buyer',seller_id:'synthetic-seller',amount_usd:100,currency:'USD',deadline_utc:'2026-10-20T10:00:00Z',arbitration_policy:'all_or_nothing'},
  specification:{deliverable_type:'json_data',expected_artifact_sha256:createHash('sha256').update(JSON.stringify(artifact)).digest('hex'),
    expected_schema:{type:'object',required:['records'],additionalProperties:false,properties:{records:{type:'integer',minimum:1}}}},
  delivery_submission:{artifact_data:artifact,submitted_at:'2026-10-20T09:00:00Z',telemetry:{total_items:1,valid_items:1}}};
const intact=await evaluateM2MEscrowArbitration(request);
const changed=structuredClone(request);changed.delivery_submission.artifact_data.records=2;
const tampered=await evaluateM2MEscrowArbitration(changed);
assert.equal(intact.arbitration_ruling.check_status.hash,'passed');
assert.equal(tampered.arbitration_ruling.check_status.hash,'failed');
assert.equal(intact.arbitration_ruling.human_review_required,true);
assert.equal(tampered.arbitration_ruling.human_review_required,true);
console.log(JSON.stringify({synthetic:true,network_calls:0,first:first.route,repaired:repaired.route,
  intact,tampered,buyer_acceptance:'not_observed'},null,2));
