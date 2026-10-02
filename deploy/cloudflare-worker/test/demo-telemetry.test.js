import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
const origin='https://example.test';
const env={AGENT_PROFILE:'agenda',BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1'};
const trace='f42a6ec9-993a-4462-804e-b6fe09d5b1bc';
async function capture(action){const events=[];const old=console.log;console.log=e=>events.push(e);try{return {response:await action(),events};}finally{console.log=old;}}
test('free preview closes its attempt without claiming payment or paid execution',async()=>{
 const body={project_name:'Synthetic',corridor_leg:'Aktau-Baku',capex_usd_m:10,ifi_debt_usd_m:0,dscr_min:1.5};
 const {response,events}=await capture(()=>handleRequest(new Request(origin+'/v1/corridor-bankability/screen',{method:'POST',body:JSON.stringify(body)}),env));
 assert.equal(response.status,200);const payment=events.filter(e=>e?.event==='agenda_intelligence_payment');
 assert.deepEqual(payment.map(e=>e.stage),['request_received','preview_completed']);assert.equal(payment[0].attempt_id,payment[1].attempt_id);
});
test('worked example telemetry is fixed empty same-origin POST, never evaluated usage',async()=>{
 const {response,events}=await capture(()=>handleRequest(new Request(origin+'/telemetry/worked-example',{method:'POST',headers:{origin,'x-example-trace-id':trace},body:''}),env));
 assert.equal(response.status,204);assert.equal(events.length,1);assert.equal(events[0].step,'worked_example');assert.equal(events[0].demo_trace_id,trace);
 for(const request of [new Request(origin+'/telemetry/worked-example',{method:'POST',headers:{origin:'https://foreign.test'}}),new Request(origin+'/telemetry/worked-example',{method:'POST',headers:{origin},body:'secret'})])assert.ok((await handleRequest(request,env)).status>=400);
});
test('unpaid attempt carries only validated example trace for aggregate linkage',async()=>{
 const body={jsonrpc:'2.0',id:1,method:'message/send',params:{message:{role:'user',parts:[{kind:'text',text:'Assess a synthetic file'}]}}};
 const {events}=await capture(()=>handleRequest(new Request(origin+'/message/send',{method:'POST',headers:{'x-example-trace-id':trace},body:JSON.stringify(body)}),env));
 const payment=events.filter(e=>e?.event==='agenda_intelligence_payment');assert.ok(payment.length);assert.ok(payment.every(e=>e.demo_trace_id===trace));
});
