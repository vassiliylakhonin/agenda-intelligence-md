import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleRequest} from '../src/index.js';
import {reviewMineralDossier} from '../src/critical_minerals_dossier.js';
import {MINERALS_TAXONOMY} from '../src/critical_minerals_taxonomy.js';
const base = new URL('../../../examples/critical-minerals-due-diligence/contract/', import.meta.url);
const load = name => JSON.parse(readFileSync(new URL(name, base), 'utf8'));
const env = {AGENT_PROFILE:'critical_minerals_due_diligence', VIZIER_DISABLED:'1'};
const url = 'https://critical-minerals.example.workers.dev/v1/critical-minerals/due-diligence';
async function evaluate(request, bindings = env) {
  const res = await handleRequest(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)}),bindings);
  assert.equal(res.status,200);
  return res.json();
}
test('Critical Minerals Worker matches Python dossier results at the public REST seam', async () => {
  for (const name of ['ready_for_human_review','pre_signature_escalate','insufficient_information']) {
    const expected = load(`${name}.response.json`), result = await evaluate(load(`${name}.request.json`));
    for (const field of ['dossier_review','traceability_status','decision_readiness_score','decision_readiness_label','operational_decision','risk_signal','minimum_sources_before_go','watch_next']) {
      assert.deepEqual(result[field],expected[field],`${name}: ${field}`);
    }
  }
  assert.deepEqual(MINERALS_TAXONOMY, JSON.parse(readFileSync(new URL('../../../source-requirements/critical-minerals-due-diligence.json',import.meta.url),'utf8')));
});
test('Critical Minerals labels and counsel boolean cannot acquire verification status', async () => {
  const request = load('ready_for_human_review.request.json');
  request.supplied_sources = request.supplied_sources.map(s => ({source_type:s.source_type,verified_by_counsel:true}));
  const result = await evaluate(request);
  assert.equal(result.decision_readiness_score,0);
  assert.equal(result.traceability_status,'unverified');
  assert.equal(result.operational_decision.decision,'request_evidence');
});
test('Critical Minerals rejects expired, future, mismatched and recycled evidence', async () => {
  const request = load('ready_for_human_review.request.json');
  request.supplied_sources[0].valid_until='2026-10-04';
  request.supplied_sources[1].date='2026-10-06';
  request.supplied_sources[2].scope.origin_jurisdiction='China';
  request.supplied_sources[4].document_id=request.supplied_sources[3].document_id;
  const result=await evaluate(request);
  assert.equal(result.decision_readiness_score,50);
  assert.equal(result.readiness_contract.owner_actions.length,4);
  for(const [i,issue] of [[0,'expired'],[1,'after assessment_date'],[2,'Scope mismatch'],[4,'Duplicate document']]) assert.ok(result.dossier_review.source_reviews[i].issues.join(' ').includes(issue));
});
test('Critical Minerals dated_sources alias, date validity and caller blocker are respected', async () => {
  const request=load('ready_for_human_review.request.json');
  request.dated_sources=request.supplied_sources; request.supplied_sources=[];
  assert.equal((await evaluate(request)).decision_readiness_score,100);
  request.dated_sources[0].date='2026-02-30'; request.blockers=['Ownership chart disputed'];
  const result=await evaluate(request);
  assert.equal(result.operational_decision.decision,'request_evidence');
  assert.ok(result.evidence_gaps.includes('Ownership chart disputed'));
  assert.ok(result.dossier_review.source_reviews[0].issues.some(i=>i.includes('invalid issue date')));
});
test('Critical Minerals same missing evidence produces identical MCP and REST decisions', async () => {
  const request=load('pre_signature_escalate.request.json'), expected=await evaluate(request);
  const res=await handleRequest(new Request('https://critical-minerals.example.workers.dev/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'critical_minerals_due_diligence',arguments:request}})}),env);
  const json=await res.json(); assert.ok(!json.error,JSON.stringify(json));
  assert.deepEqual(json.result.structuredContent.dossier_review,expected.dossier_review);
  assert.deepEqual(json.result.structuredContent.operational_decision,expected.operational_decision);
});
test('Critical Minerals degraded DLP service is not reported as an observed secret leak', async () => {
  const result=await evaluate(load('ready_for_human_review.request.json'),{AGENT_PROFILE:env.AGENT_PROFILE,VIZIER:{fetch:async()=>new Response('{}',{status:504})}});
  assert.equal(result.operational_decision.reason_code,'upstream_screening_incomplete');
  assert.equal(result.operational_decision.decision,'request_evidence');
  assert.equal(result.decision_readiness_label,'not_decision_ready');
  assert.ok(!JSON.stringify(result.top_risks).includes('DLP leak detected'));
});
test('Critical Minerals rejects invalid stage and null source objects with a client error', async () => {
  for (const change of [{decision_stage:'nonsense'},{supplied_sources:[null]}]) {
    const request={...load('ready_for_human_review.request.json'),...change};
    const res=await handleRequest(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)}),env);
    assert.equal(res.status,400);
  }
});
test('Critical Minerals scope dates are deterministic, with no implicit current time', () => {
  const request=load('ready_for_human_review.request.json'); delete request.assessment_date;
  const result=reviewMineralDossier(request);
  assert.equal(result.assessment_date,null);
  assert.ok(result.limitations.some(line=>line.includes('were not checked')));
});
test('Critical Minerals ISO week dates cannot silently differ between runtimes', async () => {
  const request=load('ready_for_human_review.request.json'); request.supplied_sources[0].date='2026-W40-1';
  const result=await evaluate(request);
  assert.ok(result.dossier_review.source_reviews[0].issues.some(issue=>issue.includes('invalid issue date')));
});
