// Local-only demonstration; no network, credentials, payments or telemetry writes.
import assert from 'node:assert/strict';
import {handleRequest} from '../../deploy/cloudflare-worker/src/index.js';

async function call(profile, name, args) {
  const request = new Request('https://example.test/mcp', {
    method:'POST', headers:{'content-type':'application/json','x-client-id':'agenda-owner-offline-orientation-demo'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})
  });
  const original = console.log;
  console.log = () => {};
  try {
    const response = await handleRequest(request,{AGENT_PROFILE:profile,BILLING_MODE:'freemium',VIZIER_DISABLED:'1'});
    const body = await response.json();
    if (!response.ok || body.error || body.result?.isError || !body.result?.structuredContent) throw new Error('Local evaluation unavailable: '+JSON.stringify(body));
    return body.result.structuredContent;
  } finally { console.log = original; }
}
const question = 'Middle Corridor shipment: industrial equipment from Aktau to Baku; what evidence is needed before signature?';
const orientation = await call('agenda','strategic_risk_triage',{text:question});
assert.equal(orientation.orientation.status,'EVIDENCE_NOT_ASSESSED');
assert.equal(orientation.orientation.selected_gate.profile,'middle_corridor_deal_risk');
const base = {route:'Aktau to Baku',cargo:'industrial equipment',counterparties:[{role:'consignee',name:'Fictional consignee',jurisdiction:'Kazakhstan'}],risk_question:question,decision_stage:'pre_signature',dated_sources:[]};
const before = await call('kazakhstan','middle_corridor_deal_risk',base);
const after = await call('kazakhstan','middle_corridor_deal_risk',{...base,dated_sources:[
  {id:'1',source_type:'beneficial_ownership_source',title:'Synthetic fixture ownership record',date:'2026-01-01'},
  {id:'2',source_type:'sanctions_list_extract',title:'Synthetic fixture sanctions extract',date:'2026-01-01'}
]});
assert.equal(after.source_record_review.source_content_verified,false);
assert.equal(after.human_review_required,true);
assert.ok(after.source_record_review.issues.length >= 2);
assert.deepEqual(after.counterparty_readiness.outstanding_documents,before.counterparty_readiness.outstanding_documents);
console.log(JSON.stringify({orientation:orientation.orientation, gate_before:{missing:before.counterparty_readiness.outstanding_documents},
  gate_after_synthetic_documents:{missing:after.counterparty_readiness.outstanding_documents, rejected_records:after.source_record_review.issues.length,human_review_required:after.human_review_required}},null,2));
