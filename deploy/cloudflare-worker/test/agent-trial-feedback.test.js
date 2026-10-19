import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.js';
import { memoryD1 } from './helpers/d1.js';

const origin = 'https://example.test';
const headers = {'content-type':'application/json','cf-connecting-ip':'192.0.2.39',
  'x-client-id':'agenda-owner-offtake-feedback-test'};
const environment = () => ({AGENT_PROFILE:'critical_minerals_due_diligence', WORKER_FREE_TRIAL:'1',
  BILLING_MODE:'pay_per_call', VIZIER_DISABLED:'1', PAYMENT_LEDGER:memoryD1()});
const send = (env,path,body,extra={}) => handleRequest(new Request(origin+path,
  {method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)}),env);
const rpc = async (env,name,args={},extra={}) => (await send(env,'/mcp/agent',
  {jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}},extra)).json();
const a2a = (operation,input) => ({jsonrpc:'2.0',id:1,method:'SendMessage',params:{message:{
  messageId:crypto.randomUUID(),role:'ROLE_USER',metadata:{'com.agenda/free-trial':{operation}},
  parts:[{data:input,mediaType:'application/json'}]}}});
const count = async env => (await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n;

test('MCP-only mineral agent can rerun its dossier and report usefulness without another evaluation',async()=>{
  const env=environment(),events=[],previous=console.log;console.log=e=>events.push(e);
  try {
    const contract=await (await handleRequest(new Request(origin+'/extensions/free-trial/v1'),env)).json();
    assert.ok(contract.selector_schema.properties.operation.enum.includes('feedback'));
    const terms=await (await handleRequest(new Request(origin+'/v1/trial'),env)).json();
    const first=await rpc(env,'free_trial',terms.example_request);
    assert.equal(first.result.isError,false);
    const attempt=first.result.structuredContent.trial.attempt_id;
    const changed={...terms.example_request,decision_question:'Which supplied excerpts still need human verification before offtake?'};
    assert.equal((await rpc(env,'free_trial',changed)).result.isError,false);
    assert.equal(await count(env),2);
    const feedback=await rpc(env,'free_trial_feedback',{attempt_id:attempt,response:'still_blocked'});
    assert.equal(feedback.result.isError,false);
    assert.deepEqual(feedback.result.structuredContent,{recorded:true,response:'still_blocked',evaluation_performed:false});
    assert.equal(await count(env),2);
    assert.equal(events.filter(e=>e?.step==='trial_feedback').length,1);
    assert.equal(events.find(e=>e?.step==='trial_feedback').feedback_origin_group,'excluded');
    const forged=await rpc(env,'free_trial_feedback',{attempt_id:attempt,response:'useful_next_step'},
      {'cf-connecting-ip':'192.0.2.40'});
    assert.equal(forged.result.isError,true);
    assert.equal(events.filter(e=>e?.step==='trial_feedback').length,1);
  } finally {console.log=previous;}
});

test('A2A mineral trial returns its attempt in the task and accepts bounded agent feedback',async()=>{
  const env=environment(),events=[],previous=console.log;console.log=e=>events.push(e);
  try {
    const terms=await (await handleRequest(new Request(origin+'/v1/trial'),env)).json();
    const result=await (await send(env,'/message/send',a2a('evaluate',terms.example_request),{'a2a-version':'1.0'})).json();
    const attempt=result.result.task.metadata.trial.attempt_id;
    assert.match(attempt,/^[0-9a-f-]{36}$/);
    const response=await send(env,'/message/send',a2a('feedback',{attempt_id:attempt,response:'still_blocked'}),{'a2a-version':'1.0'});
    assert.equal(response.status,200);
    const task=(await response.json()).result.task;
    assert.equal(task.metadata.evaluation_performed,false);
    assert.equal(task.artifacts[0].parts[0].data.recorded,true);
    assert.equal(await count(env),1);
    assert.equal(events.filter(e=>e?.step==='trial_feedback').length,1);
  } finally {console.log=previous;}
});

test('native feedback keeps production auth, product scope, expiry and strict bounded input',async()=>{
  const env=environment(),previous=console.log;console.log=()=>{};
  try {
    const terms=await (await handleRequest(new Request(origin+'/v1/trial'),env)).json();
    const completed=await rpc(env,'free_trial',terms.example_request);
    const choice={attempt_id:completed.result.structuredContent.trial.attempt_id,response:'still_blocked'};
    for (const args of [{...choice,private_text:'never-log-this'},{...choice,response:'other'},
      {...choice,attempt_id:crypto.randomUUID()}]) {
      assert.equal((await rpc(env,'free_trial_feedback',args)).result.isError,true);
    }
    assert.equal((await rpc({...env,AGENT_PROFILE:'agentic_interaction_trust'},'free_trial_feedback',choice)).result.isError,true);
    const protectedEnv={...env,AGENT_PROFILE:'cis_secondary_sanctions',CIS_SECONDARY_SANCTIONS_API_KEY:'test-production-key'};
    const refused=await send(protectedEnv,'/mcp/agent',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'free_trial_feedback',arguments:choice}});
    assert.equal(refused.status,401);
    await env.PAYMENT_LEDGER.prepare('UPDATE trial_completion_receipts SET completed_at=?1 WHERE attempt_id=?2')
      .bind(new Date(Date.now()-8*86400000).toISOString(),choice.attempt_id).run();
    assert.equal((await rpc(env,'free_trial_feedback',choice)).result.isError,true);
    assert.equal(await count(env),1);
  } finally {console.log=previous;}
});
