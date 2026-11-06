import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {memoryD1} from './helpers/d1.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
const origin='https://example.test';
const env={AGENT_PROFILE:'agenda',BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1'};
const trace='f42a6ec9-993a-4462-804e-b6fe09d5b1bc';
async function capture(action){const events=[];const old=console.log;console.log=e=>events.push(e);try{return {response:await action(),events};}finally{console.log=old;}}
test('free preview closes its attempt without claiming payment or paid execution',async()=>{
 const body={project_name:'Synthetic',corridor_leg:'Aktau-Baku',capex_usd_m:10,ifi_debt_usd_m:0,dscr_min:1.5};
 const {response,events}=await capture(()=>handleRequest(new Request(origin+'/v1/corridor-bankability/screen',{method:'POST',body:JSON.stringify(body)}),env));
 assert.equal(response.status,200);const payment=events.filter(e=>e?.event==='agenda_intelligence_payment');
 assert.deepEqual(payment.map(e=>e.stage),['request_received','request_validated','preview_completed']);assert.ok(payment.every(e=>e.attempt_id===payment[0].attempt_id));
});
test('worked example telemetry is fixed empty same-origin POST, never evaluated usage',async()=>{
 const {response,events}=await capture(()=>handleRequest(new Request(origin+'/telemetry/worked-example',{method:'POST',headers:{origin,'x-example-trace-id':trace},body:''}),env));
 assert.equal(response.status,204);assert.equal(events.length,1);assert.equal(events[0].step,'worked_example');assert.equal(events[0].demo_trace_id,trace);
 for(const request of [new Request(origin+'/telemetry/worked-example',{method:'POST',headers:{origin:'https://foreign.test'}}),new Request(origin+'/telemetry/worked-example',{method:'POST',headers:{origin},body:'secret'})])assert.ok((await handleRequest(request,env)).status>=400);
});
test('unpaid attempt carries only validated example trace for aggregate linkage',async()=>{
 const body={};
 const {events}=await capture(()=>handleRequest(new Request(origin+'/v1/agent-output/verification',{method:'POST',headers:{'x-example-trace-id':trace},body:JSON.stringify(body)}),{...env,AGENT_PROFILE:'agent_output_verification'}));
 const payment=events.filter(e=>e?.event==='agenda_intelligence_payment');assert.ok(payment.length);assert.ok(payment.every(e=>e.demo_trace_id===trace));
});

test('Escrow links a tagged demo to a recorded trial without reusing its attempt ID', async () => {
 const escrow = {...env, AGENT_PROFILE:'m2m_escrow_arbiter', WORKER_FREE_TRIAL:'1', PAYMENT_LEDGER:memoryD1()};
 const page = await (await handleRequest(new Request(origin+'/?source=agenstry#worked-example',
   {headers:{accept:'text/html'}}),escrow)).text();
 assert.match(page, /href="#profile-console">Check my delivery evidence/);
 const {response,events} = await capture(async () => {
   const opened = await handleRequest(new Request(origin+'/telemetry/worked-example',{method:'POST',
     headers:{origin,'x-example-trace-id':trace,'x-agenda-example-source':'agenstry'}}),escrow);
   assert.equal(opened.status,204);
   return handleRequest(new Request(origin+'/v1/trial',{method:'POST',
     headers:{'content-type':'application/json','x-example-trace-id':trace,'cf-connecting-ip':'192.0.2.60'},
     body:JSON.stringify(WORKED_EXAMPLES.m2m_escrow_arbiter.request)}),escrow);
 });
 assert.equal(response.status,200);
 assert.equal(events.find(event => event?.step === 'worked_example').example_source,'agenstry_link');
 const payment = events.find(event => event?.stage === 'preview_completed');
 assert.equal(payment.reason,'free_trial');
 assert.equal(payment.demo_trace_id,trace);
 assert.notEqual(payment.attempt_id,trace);
 assert.equal((await response.json()).trial.completion_recorded,true);
});
