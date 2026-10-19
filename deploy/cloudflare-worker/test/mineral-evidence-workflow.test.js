import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleRequest} from '../src/index.js';
import {memoryD1} from './helpers/d1.js';

const origin='https://example.test';
const headers={'content-type':'application/json','cf-connecting-ip':'192.0.2.53','x-client-id':'agenda-owner-evidence-loop-test'};
const environment=()=>({AGENT_PROFILE:'critical_minerals_due_diligence',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1',PAYMENT_LEDGER:memoryD1()});
function dossier() {
  // Synthetic structural control, never an authenticated record or user result.
  const request=JSON.parse(readFileSync(new URL('../../../examples/critical-minerals-due-diligence/contract/ready_for_human_review.request.json',import.meta.url),'utf8'));
  for(const source of request.supplied_sources) {
    source.title=source.title.replace('Illustrative','Provided');
    source.excerpt=source.excerpt.replace('ILLUSTRATIVE ONLY. ','');
  }
  return request;
}
const send=(env,path,body,extra={})=>handleRequest(new Request(origin+path,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)}),env);
const rpc=async(env,name,args)=>(await send(env,'/mcp/agent',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})).json();
const count=async env=>(await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n;
const a2a=input=>({jsonrpc:'2.0',id:1,method:'SendMessage',params:{message:{messageId:crypto.randomUUID(),role:'ROLE_USER',metadata:{'com.agenda/free-trial':{operation:'evaluate'}},parts:[{data:input,mediaType:'application/json'}]}}});

test('MCP initial dossier to updated A2A trial exposes requests, coverage changes and preserves two-attempt admission',async()=>{
  const env=environment(),original=console.log;console.log=()=>{};
  try {
    const input=dossier();input.supplied_sources=input.supplied_sources.slice(0,1);
    const first=await rpc(env,'free_trial',input);
    const flow=first.result.structuredContent.evaluation.dossier_review.evidence_workflow;
    assert.equal(flow.evidence_requests.length,7);
    assert.equal(flow.evidence_requests[0].source_template.excerpt,'');
    const updated=dossier();updated.supplied_sources=updated.supplied_sources.slice(0,3);
    updated.previous_submission=input;
    const response=await send(env,'/message/send',a2a(updated),{'a2a-version':'1.0'});
    assert.equal(response.status,200);
    const task=(await response.json()).result.task;
    const second=task.artifacts[0].parts.find(part=>part.data).data;
    const revision=second.dossier_review.evidence_workflow.revision;
    assert.equal(revision.status,'compared');
    assert.deepEqual(revision.newly_reviewable_source_types,updated.supplied_sources.slice(1).map(source=>source.source_type));
    assert.equal(revision.still_missing_source_types.length,5);
    assert.equal(second.authorization_granted,false);
    assert.equal(await count(env),2);
    const exhausted=await rpc(env,'free_trial',updated);
    assert.equal(exhausted.result.isError,true);
    assert.equal(await count(env),2);
    const feedback=await rpc(env,'free_trial_feedback',{attempt_id:task.metadata.trial.attempt_id,response:'still_blocked'});
    assert.equal(feedback.result.isError,false);
    assert.equal(await count(env),2);
  } finally {console.log=original;}
});

test('malformed or recursive baselines are refused before trial reservation across HTTP, MCP and A2A',async()=>{
  const env=environment(),original=console.log;console.log=()=>{};
  try {
    const invalid=[null,{}, {...dossier(),previous_submission:{}}, {...dossier(),supplied_sources:[{source_type:'x',scope:{commodity:12}}]},
      {...dossier(),decision_readiness_score:100}];
    for(const previous_submission of invalid) {
      const input={...dossier(),previous_submission};
      assert.equal((await send(env,'/v1/trial',input)).status,400);
      assert.equal((await rpc(env,'free_trial',input)).result.isError,true);
      const a=await (await send(env,'/message/send',a2a(input),{'a2a-version':'1.0'})).json();
      assert.ok(a.error);
    }
    assert.equal(await count(env),0);
  } finally {console.log=original;}
});

test('decision change, backwards dates, expired evidence and blocker removal cannot masquerade as coverage improvement',()=>{
  // The actual service seam is covered above; compare pure review for deterministic edge cases.
  return import('../src/critical_minerals_dossier.js').then(({reviewMineralDossier})=>{
    const current=dossier(),previous=structuredClone(current);
    previous.blockers=['Ownership disputed'];
    current.previous_submission=previous;
    let flow=reviewMineralDossier(current).evidence_workflow;
    assert.deepEqual(flow.revision.newly_reviewable_source_types,[]);
    assert.deepEqual(flow.revision.removed_caller_blockers,['Ownership disputed']);
    previous.supplied_sources[0].valid_until=previous.assessment_date;
    current.supplied_sources[0].valid_until=previous.assessment_date;
    current.assessment_date='2026-10-06';
    flow=reviewMineralDossier(current).evidence_workflow;
    assert.deepEqual(flow.revision.no_longer_reviewable_source_types,[current.supplied_sources[0].source_type]);
    current.assessment_date='2026-10-04';
    flow=reviewMineralDossier(current).evidence_workflow;
    assert.ok(flow.revision.comparison_blockers.includes('assessment_date_moved_backwards'));
    current.decision_stage='pre_exploration';
    flow=reviewMineralDossier(current).evidence_workflow;
    assert.equal(flow.revision.status,'not_comparable');
    assert.deepEqual(flow.revision.newly_reviewable_source_types,[]);
    assert.ok(flow.revision.changed_scope_fields.includes('decision_stage'));
  });
});
