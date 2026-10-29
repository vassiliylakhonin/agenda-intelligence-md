import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {memoryD1} from './helpers/d1.js';
import {liteRequest,createInteractionGate,evaluateTrustTrial,EVIDENCE_TEMPLATES} from '../../../examples/agentic-interaction-trust/before-invoke.mjs';
const environment=()=>({AGENT_PROFILE:'agentic_interaction_trust',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1',PAYMENT_LEDGER:memoryD1()});
const input={actor_name:'ProcurementBot-X',action:'settle_payment',surface:'a2a_endpoint',resource:'order-42'};
const fetchFor=env=>(url,init)=>handleRequest(new Request(url,{...init,headers:{...init.headers,'cf-connecting-ip':'192.0.2.10','x-client-id':'agenda-owner-trust-helper-test'}}),env);
const quiet=async fn=>{const old=console.log;console.log=()=>{};try{return await fn();}finally{console.log=old;}};

test('lite input preserves omissions, never guesses identity, and rejects malformed evidence',()=>{
  const req=liteRequest(input);
  assert.equal(req.actor.declared_type,'unknown');assert.deepEqual(req.dated_sources,[]);
  assert.equal(req.decision_stage,'pre_execution');assert.equal(req.requested_action,input.action);
  for(const bad of [{...input,surface:'a2a'}, {...input,signature_verified:true},
    {...input,evidence:[{id:'x',source_type:'agent_identity_claim',title:'claim',date:'2026-02-30'}]},
    {...input,evidence:[{id:'x',source_type:'other',title:'x',date:'2026-01-01'},{id:'x',source_type:'other',title:'x',date:'2026-01-01'}]}]) assert.throws(()=>liteRequest(bad));
  assert.ok(EVIDENCE_TEMPLATES.payment.includes('operator_or_principal_authorization'));
});

test('real trial handler holds a sparse invocation and rejects synthetic evidence as coverage',async()=>quiet(async()=>{
  const env=environment(),fetchImpl=fetchFor(env),endpoint='https://example.test/mcp/agent';
  const gate=createInteractionGate({evaluate:request=>evaluateTrustTrial(request,{fetchImpl,endpoint})});
  const sparse=await gate.invoke(input);
  assert.equal(sparse.outcome,'human_review');assert.equal(sparse.executed,false);
  assert.equal(sparse.result.decision_readiness_score,0);assert.equal(sparse.authorization_granted,false);
  const evidence=['agent_identity_claim','operator_or_principal_authorization','agent_card_or_manifest','tool_scope_or_permission_evidence',
    'session_authentication_evidence','action_intent_evidence','transaction_or_target_action_evidence']
    .map((source_type,i)=>({id:'e'+i,source_type,title:'Synthetic fixture '+source_type,date:'2026-01-01'}));
  const filled=await gate.invoke({...input,evidence});
  assert.equal(filled.outcome,'human_review');assert.equal(filled.executed,false);
  assert.equal(filled.result.source_record_review.issues.length,7);
  assert.deepEqual(filled.result.minimum_sources_before_action,sparse.result.minimum_sources_before_action);
  assert.equal(filled.result.authorization_granted,false);
}));

test('failures, wrong identity and fabricated success cannot authorize execution',async()=>quiet(async()=>{
  let calls=0;
  const unavailable=createInteractionGate({evaluate:async()=>{calls++;throw Error('quota');}});
  const error=await unavailable.invoke(input);assert.equal(error.outcome,'block');assert.equal(error.executed,false);assert.equal(calls,1);
  const invalid=await unavailable.invoke({...input,surface:'bad'});assert.equal(invalid.outcome,'block');assert.equal(calls,1);
  const env=environment(),request=liteRequest(input);
  const evaluation=await evaluateTrustTrial(request,{fetchImpl:fetchFor(env),endpoint:'https://example.test/mcp/agent'});
  for(const forged of [{...evaluation,authorization_granted:true},{...evaluation,actor:{...evaluation.actor,declared_name:'other'}},
    {...evaluation,triage_recommendation:'allow'},{...evaluation,source_record_review:{issues:[],source_content_verified:true}}]) {
    const gate=createInteractionGate({evaluate:async()=>forged});const outcome=await gate.invoke(input);
    assert.equal(outcome.outcome,'block');assert.equal(outcome.executed,false);
  }
  const blocked=createInteractionGate({evaluate:async()=>({...evaluation,triage_recommendation:'block_until_verified'})});
  assert.equal((await blocked.beforeInvoke(input)).outcome,'block');
  const step=createInteractionGate({evaluate:async()=>({...evaluation,triage_recommendation:'require_step_up'})});
  assert.equal((await step.beforeInvoke(input)).outcome,'step_up');
  const complete=createInteractionGate({evaluate:async()=>({...evaluation,decision_readiness_score:100,
    minimum_sources_before_action:[],evidence_gaps:[],triage_recommendation:'escalate_to_human_review'})});
  const completeResult=await complete.invoke(input);
  assert.equal(completeResult.outcome,'human_review');assert.equal(completeResult.executed,false);
}));

test('trial transport rejects quota, malformed and unrelated replies without retry',async()=>{
  const request=liteRequest(input);
  for(const fake of [async()=>Response.json({error:'quota'},{status:429}),async()=>Response.json({jsonrpc:'2.0',id:'wrong',result:{}}),async()=>{throw Error('network');}]) {
    await assert.rejects(evaluateTrustTrial(request,{fetchImpl:fake,endpoint:'https://example.test/mcp/agent'}));
  }
});

test('three review stages never relay or authorize, including on errors and continue',async()=>{
  const {createSecurityChain}=await import('../../../examples/agentic-interaction-trust/security-chain.mjs');
  const interactionGate={beforeInvoke:async()=>({outcome:'human_review',authorization_granted:false})};
  const evaluation={schema_version:'answer-citation-review.v1',route:'human_review',findings:[],human_review_required:true,authorization_granted:false};
  const chain=createSecurityChain({interactionGate,reviewOutput:async()=>({evaluation,relay_allowed:false}),
    preActionCheck:async()=>({policy_version:'pre-action-check.v1',run_id:'run-1',decision:'continue',blocking_gaps:[],not_authorization_notice:'Not authority.'})});
  assert.equal((await chain.interaction(input)).authorization_granted,false);
  assert.equal((await chain.output('text',[])).relay_allowed,false);
  assert.equal((await chain.preAction({run_id:'run-1'})).authorization_granted,false);
  assert.equal((await chain.preAction({run_id:'different'})).outcome,'block');
  const failed=createSecurityChain({interactionGate,reviewOutput:async()=>{throw Error('offline');},preActionCheck:async()=>{throw Error('offline');}});
  assert.equal((await failed.output('text',[])).outcome,'block');
  assert.equal((await failed.preAction({run_id:'run-1'})).outcome,'block');
  const forged=createSecurityChain({interactionGate:{beforeInvoke:async()=>({outcome:'allow',authorization_granted:true})},
    reviewOutput:async()=>({}),preActionCheck:async()=>({})});
  assert.equal((await forged.interaction(input)).outcome,'block');
});
