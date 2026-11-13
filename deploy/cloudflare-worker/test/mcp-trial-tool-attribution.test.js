import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {TRIAL_PROFILES} from '../src/trial-profiles.js';
import {memoryD1} from './helpers/d1.js';

const origin='https://example.test';
const headers={'content-type':'application/json','cf-connecting-ip':'192.0.2.72','x-client-id':'agenda-owner-attribution-test'};
const environment=profile=>({AGENT_PROFILE:profile,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1',PAYMENT_LEDGER:memoryD1()});

async function trialUsage(profile,path) {
  const env=environment(profile),events=[],old=console.log;
  console.log=value=>events.push(value);
  try {
    const listed=await handleRequest(new Request(origin+path,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}),env);
    const trial=(await listed.json()).result.tools.find(t=>t.name==='free_trial');
    const example=trial._meta['com.agenda/readiness'].example_arguments;
    const response=await handleRequest(new Request(origin+path,{method:'POST',headers,
      body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'free_trial',arguments:example}})}),env);
    assert.equal((await response.json()).result.isError,false);
  } finally {console.log=old;}
  return events.filter(e=>e?.event==='agenda_intelligence_a2a_usage');
}

test('kazakhstan /mcp/agent free_trial records tool_name in usage telemetry',async()=>{
  const usage=await trialUsage('kazakhstan','/mcp/agent');
  assert.ok(usage.length>0,'a usage event was logged');
  assert.ok(usage.every(e=>e.tool_name==='free_trial'),JSON.stringify(usage.map(e=>e.tool_name)));
  assert.ok(usage.every(e=>e.agent_profile==='kazakhstan'));
});

for(const profile of Object.keys(TRIAL_PROFILES)) {
  test(`${profile}: /mcp/agent free_trial usage carries tool_name`,async()=>{
    const usage=await trialUsage(profile,'/mcp/agent');
    assert.ok(usage.length>0);
    assert.ok(usage.every(e=>e.tool_name==='free_trial'));
  });
}
