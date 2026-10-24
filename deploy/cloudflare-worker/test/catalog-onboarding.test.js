import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, agentCard } from '../src/index.js';
import { WORKED_EXAMPLES } from '../src/worked-examples.js';
import { catalogOperation } from '../src/catalog-demo.js';

const origin = 'https://example.test';
const headers = {'content-type':'application/json', 'a2a-version':'1.0',
  'x-client-id':'agenda-owner-catalog-onboarding-test'};
const envelope = text => ({jsonrpc:'2.0', id:'catalog-start', method:'SendMessage', params:{
  message:{messageId:'catalog-start-message', role:'user', parts:[{text}]}
}});
const send = (body, env, extra={}) => handleRequest(new Request(origin+'/message/send', {
  method:'POST', headers:{...headers,...extra}, body:JSON.stringify(body)
}), env);

test('every published text-only catalogue starter returns an honest read-only result', async () => {
  const log=console.log, fetch=globalThis.fetch, events=[];
  console.log=event=>events.push(event);
  globalThis.fetch=()=>{throw Error('Catalogue starters must not call upstream services');};
  const forbiddenStore=new Proxy({}, {get(){throw Error('Catalogue starters must not reserve or store tasks');}});
  try {
    for (const profile of Object.keys(WORKED_EXAMPLES)) {
      const env={AGENT_PROFILE:profile, BILLING_MODE:'pay_per_call', WORKER_FREE_TRIAL:'1', X402_STANDARD:'1',
        PAYMENT_LEDGER:forbiddenStore, AGENDA_USAGE:forbiddenStore};
      const card=agentCard(new Request(origin),env);
      const prompts=[...new Set(card.skills.flatMap(skill=>skill.examples || []))].filter(value=>{
        try {JSON.parse(value);return false;} catch {return true;}
      });
      assert.ok(prompts.length>=3, profile);
      for (const prompt of prompts) {
        const response=await send(envelope(prompt),env);
        assert.equal(response.status,200,`${profile}: ${prompt}`);
        const body=await response.json(), task=body.result.task;
        assert.equal(task.status.state,'TASK_STATE_COMPLETED');
        assert.equal(task.metadata.evaluation_performed,false);
        assert.equal(task.metadata.attempt_consumed,false);
        assert.equal(task.metadata.authorization_granted,false);
        assert.equal(task.metadata.task_persisted,false);
        assert.equal(response.headers.get('payment-required'),null);
        assert.equal(response.headers.get('cache-control'),'no-store');
      }
    }
    assert.equal(events.filter(e=>e?.step==='catalog_input_requirements').length,12);
    assert.equal(events.filter(e=>e?.step==='catalog_trial_options').length,12);
    assert.ok(!events.some(e=>['agenda_intelligence_a2a_usage','agenda_intelligence_payment'].includes(e?.event)));
  } finally {console.log=log;globalThis.fetch=fetch;}
});

test('catalogue requirements use the serving contract and trial options respect disabled campaigns', async () => {
  const log=console.log;console.log=()=>{};
  try {
    const env={AGENT_PROFILE:'agent_output_verification', BILLING_MODE:'pay_per_call', WORKER_FREE_TRIAL:'1'};
    const response=await send(envelope('Show input requirements'),env), body=await response.json();
    const data=body.result.task.artifacts[0].parts.find(part=>part.data).data;
    assert.equal(data.kind,'catalog_input_requirements');
    assert.match(data.not_advice_notice,/Setup information only/);
    assert.equal(data.input.tool,'free_trial');
    const schema=await (await handleRequest(new Request(data.input.input_schema_url),env)).json();
    const {$schema,$id,...actualSchema}=schema;
    const {$schema:originalDialect,$id:originalId,...originalSchema}=data.input.input_schema;
    assert.deepEqual(originalSchema,actualSchema);
    const contract=await (await handleRequest(new Request(data.next.contract_url),env)).json();
    assert.deepEqual(data.contract,contract);
    for (const enabled of ['1','0']) {
      const trial=await (await send(envelope('Show free trial options'),{...env,WORKER_FREE_TRIAL:enabled})).json();
      const payload=trial.result.task.artifacts[0].parts.find(part=>part.data).data;
      assert.equal(payload.availability_checked,false);
      assert.equal(payload.automatic_payment,false);
      assert.equal(payload.automatic_evaluation_retry,false);
      assert.equal(Boolean(payload.trial),enabled==='1');
      if (enabled==='1') {
        assert.equal(payload.trial.attempts_per_network,5);
        assert.equal(payload.trial.feedback.requires_recent_completion,true);
      } else {
        assert.equal(payload.next.trial_terms_url,undefined);
        assert.equal(payload.next.availability_url,undefined);
        assert.equal(payload.onboarding.first_evaluation,undefined);
      }
    }
  } finally {console.log=log;}
});

test('new catalogue commands preserve authorization, protocol and payment-material refusals', async () => {
  const log=console.log;console.log=()=>{};
  try {
    for (const prompt of ['Show input requirements','Show free trial options']) {
      const env={AGENT_PROFILE:'kazakhstan', WORKER_FREE_TRIAL:'1', BILLING_MODE:'pay_per_call',
        MIDDLE_CORRIDOR_API_KEY:'synthetic-local-key'};
      assert.equal((await send(envelope(prompt),env)).status,401);
      assert.equal((await send(envelope(prompt),env,{authorization:'Bearer synthetic-local-key'})).status,200);
      const publicEnv={...env,MIDDLE_CORRIDOR_API_KEY:''};
      for (const header of ['x-payment-tx','x-payment-signature','payment-signature','x-payment']) {
        assert.equal((await send(envelope(prompt),publicEnv,{[header]:'synthetic-invalid-proof'})).status,400);
      }
      assert.equal((await send(envelope(prompt),publicEnv,{'a2a-version':'0.3'})).status,400);
      for (const method of ['message/send','tasks/send']) {
        const body={...envelope(prompt),method};
        const result=await (await send(body,publicEnv,{'a2a-version':'0.3'})).json();
        assert.equal(result.result.status.state,'completed');
        assert.equal(result.result.metadata.evaluation_performed,false);
      }
    }
  } finally {console.log=log;}
});

test('case data and continuation never become read-only setup, and ordinary evaluation remains gated', async () => {
  const log=console.log;console.log=()=>{};
  try {
    for (const prompt of ['Show input requirements','Show free trial options']) {
      for (const change of [
        body=>{body.params.message.parts[0].text+=' for this supplied customer case';},
        body=>{body.params.message.parts.push({data:{private:'private-document'}});},
        body=>{body.params.message.metadata={scope:'private-document'};},
        body=>{body.params.message.contextId='private-context';},
        body=>{body.params.message.taskId='private-task';},
        body=>{body.params.request={private:'private-document'};}
      ]) {
        const body=envelope(prompt);change(body);
        assert.equal(catalogOperation(body),null);
      }
    }
    const env={AGENT_PROFILE:'agent_output_verification',BILLING_MODE:'pay_per_call',WORKER_FREE_TRIAL:'1',X402_STANDARD:'1'};
    const body=envelope('');body.params.message.parts=[{data:WORKED_EXAMPLES.agent_output_verification.request,mediaType:'application/json'}];
    const response=await send(body,env);
    assert.equal(response.status,402);
    assert.ok(response.headers.get('payment-required'));
    assert.ok(!(await response.json()).result);
  } finally {console.log=log;}
});
