import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {taskStage,executionTaskStage,taskStageObservation,documentArchiveIntent} from '../src/a2a-task-stage.js';
import {memoryD1} from './helpers/d1.js';

const origin='https://example.test';
const headers={'content-type':'application/json','a2a-version':'1.0','cf-connecting-ip':'192.0.2.25','x-client-id':'agenda-owner-task-stage-test'};
const envelope=text=>({jsonrpc:'2.0',id:'synthetic-stage',method:'SendMessage',params:{message:{messageId:crypto.randomUUID(),role:'ROLE_USER',parts:[{text}]}}});
const send=(env,body)=>handleRequest(new Request(origin+'/message/send',{method:'POST',headers,body:JSON.stringify(body)}),env);
async function observed(action){const log=console.log,events=[];console.log=value=>events.push(value);try{return {value:await action(),events:events.filter(e=>e?.step==='a2a_task_stage'),all:events};}finally{console.log=log;}}
const envFor=profile=>({AGENT_PROFILE:profile,BILLING_MODE:'pay_per_call',WORKER_FREE_TRIAL:'1',VIZIER_DISABLED:'1',OPENSANCTIONS_DISABLED:'1',PAYMENT_LEDGER:memoryD1()});

test('archive intent routes once without counting a completed evaluation, reserving a trial or echoing input',async()=>{
  for(const text of ['Reconcile a fictional document archive: missing files and duplicate copies.','Нужна сверка документного архива: дубли файлов и пробелы.']){
    const env=envFor('agenda');
    const {value:response,events,all}=await observed(()=>send(env,envelope(text)));
    assert.equal(response.status,200);const task=(await response.json()).result.task;
    assert.equal(task.status.state,'TASK_STATE_COMPLETED');assert.equal(task.metadata.task_persisted,false);
    assert.equal(task.metadata.task_progress.stage,'routing');assert.equal(task.metadata.task_progress.evaluation_performed,false);
    const route=task.artifacts[0].parts.find(part=>part.data).data;
    assert.equal(route.workspace_url,origin+'/document-archive');assert.equal(route.authorization_granted,false);
    assert.ok(!JSON.stringify(task).includes(text));
    assert.equal(events.length,1);assert.equal(events[0].event_version,7);assert.equal(events[0].a2a_stage,'routing');
    assert.ok(!all.some(event=>['agenda_intelligence_a2a_usage','agenda_intelligence_payment'].includes(event?.event)));
    assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n,0);
    assert.deepEqual(Object.keys(events[0]).filter(key=>/text|filename|task_id|source|excerpt/.test(key)),[]);
  }
});
test('catalogue setup and trial evaluation have distinct stages; malformed input never becomes completed',async()=>{
  const env=envFor('agent_output_verification');
  const catalog=await observed(()=>send(env,envelope('Show input requirements')));
  assert.equal(catalog.events.length,1);assert.equal(catalog.events[0].a2a_stage,'setup');
  const example=await(await handleRequest(new Request(origin+'/v1/trial'),env)).json();
  const trial=(operation,input)=>{const body=envelope('');body.params.message.metadata={'com.agenda/free-trial':{operation}};body.params.message.parts=operation==='status'?[{text:'Check free trial availability'}]:[{data:input,mediaType:'application/json'}];return body;};
  const status=await observed(()=>send(env,trial('status')));
  assert.equal(status.events.length,1);assert.equal(status.events[0].a2a_stage,'setup');
  const failed=await observed(()=>send(env,trial('evaluate',{})));
  assert.equal(failed.events.length,1);assert.equal(failed.events[0].a2a_stage,'failed');assert.equal(failed.events[0].evaluation_performed,null);
  const completed=await observed(()=>send(env,trial('evaluate',example.example_request)));
  assert.equal(completed.value.status,200);assert.equal(completed.events.length,1);
  const task=(await completed.value.json()).result.task;
  assert.equal(task.metadata.task_progress.stage,'evaluation_completed');assert.equal(task.metadata.trial.completion_recorded,true);
  assert.equal(completed.events[0].evaluation_performed,true);
});
test('input-required remains separate from success and caller metadata cannot forge stages',async()=>{
  const body=envelope('Please review');body.params.message.metadata={task_progress:taskStage('evaluation_completed')};
  const {value,events}=await observed(()=>send({AGENT_PROFILE:'cis_secondary_sanctions',VIZIER_DISABLED:'1',OPENSANCTIONS_DISABLED:'1'},body));
  assert.equal(value.status,200);const task=(await value.json()).result.task;
  assert.equal(task.status.state,'TASK_STATE_INPUT_REQUIRED');assert.equal(task.metadata.task_progress.stage,'input_required');
  assert.equal(events.length,1);assert.equal(events[0].evaluation_performed,false);
});
test('routing respects serving authorization and only targets unstructured archive intent',async()=>{
  const env={...envFor('kazakhstan'),MIDDLE_CORRIDOR_API_KEY:'synthetic-key'};
  const response=await send(env,envelope('Review the document archive for duplicate files'));
  assert.equal(response.status,401);
  assert.equal(documentArchiveIntent('Archive the discussion of historical transport routes'),false);
  assert.equal(documentArchiveIntent('Review duplicate supplier files'),false);
  assert.equal(executionTaskStage({status:{state:'TASK_STATE_WORKING'}}).stage,'unmeasured');
  assert.equal(executionTaskStage({status:{state:'TASK_STATE_FAILED'}}).evaluation_performed,null);
  assert.equal(taskStageObservation('agenda',{...taskStage('routing'),evaluation_performed:true}),null);
  assert.equal(taskStageObservation('agenda',{...taskStage('routing'),version:2}),null);
});
