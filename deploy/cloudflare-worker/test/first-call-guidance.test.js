import {routingToolForProfile} from '../src/pricing-policy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {memoryD1} from './helpers/d1.js';
import {createHostedMcpCall} from '../../../examples/hosted-mcp/client.mjs';

const origin='https://example.test';
const headers={'content-type':'application/json','x-client-id':'agenda-owner-first-call-regression'};
async function silent(action) {
  const old=console.log;console.log=()=>{};
  try {await action();} finally {console.log=old;}
}
function hintOf(body) {
  return body.first_call || body.result?._meta?.['com.agenda/admission']?.first_call ||
    (body.result?.content?.[0]?.text?JSON.parse(body.result.content[0].text).details?.first_call:undefined);
}

test('invalid A2A, REST and MCP inputs expose executable free discovery without replacing private input',async()=>silent(async()=>{
  const env={AGENT_PROFILE:'agent_output_verification',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',
    VIZIER_DISABLED:'1',PAYMENT_LEDGER:memoryD1()};
  for (const path of ['/message/send','/v1/agent-output/verification','/mcp/agent']) {
    for (const body of ['{"private-marker"',JSON.stringify({jsonrpc:'2.0',id:'bad',method:path.startsWith('/mcp')?'tools/call':'SendMessage',
      params:{name:'agent_output_verification',arguments:{private:'private-marker'},message:{role:'ROLE_USER',parts:[{text:'private-marker'}]}}})]) {
      const response=await handleRequest(new Request(origin+path+'?private-query',{method:'POST',headers,body}),env);
      assert.equal(response.status,400);
      const payload=await response.json(),hint=hintOf(payload);
      assert.equal(hint.automatic_retry,false);
      assert.equal(hint.automatic_payment,false);
      assert.equal(hint.input_preflight.url,origin+'/v1/validate-input');
      assert.equal(hint.input_preflight.evaluation_performed,false);
      assert.equal(hint.free_trial.tool,'agent_output_verification');
      const contract=await handleRequest(new Request(hint.contract_request.url,hint.contract_request),env);
      assert.equal(contract.status,200);
      const terms=await handleRequest(new Request(hint.free_trial.terms_request.url,hint.free_trial.terms_request),env);
      assert.equal(terms.status,200);
      assert.equal((await terms.json()).tool,hint.free_trial.tool);
      assert.doesNotMatch(JSON.stringify(hint),/private-marker|private-query/);
      if (payload.error?.data) assert.deepEqual(payload.error.data.first_call,hint);
    }
  }
  assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n,0);
}));

test('all product payment admissions advertise only their configured trial and preserve the x402 challenge',async()=>silent(async()=>{
  for (const [profile,example] of Object.entries(WORKED_EXAMPLES)) {
    if (routingToolForProfile(profile)) continue; // Free routing has no payment admission (entry-pricing tests).
    for (const standard of ['0','1']) {
      const env={AGENT_PROFILE:profile,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1',
        X402_STANDARD:standard,PAYMENT_LEDGER:memoryD1()};
      const body=JSON.stringify({jsonrpc:'2.0',id:'first-call',method:'tools/call',params:{name:example.tool,arguments:example.request}});
      const response=await handleRequest(new Request(origin+'/mcp/agent',{method:'POST',headers,body}),env);
      assert.equal(response.status,200);
      const payload=await response.json(),hint=hintOf(payload);
      assert.equal(payload.result.isError,true);
      assert.equal(hint.free_trial.tool,example.tool);
      assert.equal(hint.free_trial.post_consumes_attempt,true);
      const terms=await (await handleRequest(new Request(hint.free_trial.terms_request.url),env)).json();
      const checked=await handleRequest(new Request(hint.input_preflight.url,{method:'POST',headers,
        body:JSON.stringify({tool:example.tool,input:example.request})}),env);
      assert.equal((await checked.json()).valid,true);
      assert.equal(terms.tool,hint.free_trial.tool);
      if (standard==='1') {
        const challenge=JSON.parse(atob(response.headers.get('payment-required')));
        assert.deepEqual(payload.result.structuredContent,challenge);
        assert.deepEqual(JSON.parse(payload.result.content[0].text),challenge);
        assert.deepEqual(JSON.parse(payload.result.content[1].text).first_call,hint);
      }
      assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM output_verification_trials').first()).n,0);
    }
  }
}));

test('retained integration preserves free-entry guidance in both payment shapes and input errors',async()=>silent(async()=>{
  for (const standard of ['0','1']) {
    const env={AGENT_PROFILE:'agent_output_verification',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',X402_STANDARD:standard};
    const options={endpoint:origin+'/mcp/agent',headers,fetchImpl:(url,init)=>handleRequest(new Request(url,init),env)};
    const example=WORKED_EXAMPLES.agent_output_verification;
    const result=await createHostedMcpCall(example.tool,example.request,options).evaluate();
    assert.equal(result.evaluated,false);
    assert.equal(result.firstCall.free_trial.tool,example.tool);
    await assert.rejects(createHostedMcpCall(example.tool,{},options).evaluate(),error=>
      error.status===400 && error.firstCall.automatic_retry===false);
  }
}));

test('disabled trials and production authentication are represented without granting access',async()=>silent(async()=>{
  const env={AGENT_PROFILE:'cis_secondary_sanctions',BILLING_MODE:'pay_per_call',CIS_SECONDARY_SANCTIONS_API_KEY:'private-key'};
  const req=authorization=>new Request(origin+'/v1/cis-secondary-sanctions/exposure',{method:'POST',headers:{...headers,...authorization},body:'{'});
  const denied=await handleRequest(req({}),env);
  assert.equal(denied.status,401);
  assert.equal((await denied.json()).first_call,undefined);
  const admitted=await handleRequest(req({authorization:'Bearer private-key'}),env);
  const hint=hintOf(await admitted.json());
  assert.equal(hint.free_trial,null);
  assert.equal(hint.authentication,'bearer_required');
  assert.doesNotMatch(JSON.stringify(hint),/private-key/);
  for (const standard of ['0','1']) {
    const example=WORKED_EXAMPLES.agent_output_verification;
    const response=await handleRequest(new Request(origin+'/mcp/agent',{method:'POST',headers,
      body:JSON.stringify({jsonrpc:'2.0',id:'no-trial',method:'tools/call',params:{name:example.tool,arguments:example.request}})}),
      {AGENT_PROFILE:'agent_output_verification',BILLING_MODE:'pay_per_call',X402_STANDARD:standard});
    const payload=await response.json();
    assert.equal(hintOf(payload).free_trial,null);
    assert.match(payload.result._meta['com.agenda/admission'].next_step,/does not advertise a free trial/);
  }
}));
