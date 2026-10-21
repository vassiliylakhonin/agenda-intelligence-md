import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';

const env={AGENT_PROFILE:'agent_output_verification',BILLING_MODE:'pay_per_call',WORKER_FREE_TRIAL:'1'};
const headers={'content-type':'application/json','x-client-id':'agenda-owner-free-first-regression'};
const call=async(method,params={},path='/mcp/output-verification',extra={})=>{
  const response=await handleRequest(new Request('https://example.test'+path,{method:'POST',headers,
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),{...env,...extra},{waitUntil(){}});
  return {response,body:await response.json()};
};
async function example(){
  const {body}=await call('tools/list');
  return body.result.tools.find(tool=>tool.name==='agent_output_verification')._meta['com.agenda/readiness'].example_arguments;
}

test('plugin endpoint exposes unpaid admission as a tool error without evaluation',async()=>{
  const {response,body}=await call('tools/call',{name:'agent_output_verification',arguments:await example()});
  assert.equal(response.status,200);
  assert.equal(body.result.isError,true);
  const refusal=JSON.parse(body.result.content[0].text);
  assert.equal(refusal.admission_status,402);
  assert.equal(refusal.evaluated,false);
  assert.match(refusal.next_step,/free_trial/);
  assert.ok(!body.result.structuredContent);
});

test('text-only consumers retain the same findings and next actions as structured consumers',async()=>{
  const {body}=await call('tools/call',{name:'agent_output_verification',arguments:await example()},'/mcp/agent',
    {BILLING_MODE:'freemium'});
  assert.equal(body.result.isError,false);
  assert.deepEqual(JSON.parse(body.result.content[0].text),body.result.structuredContent);
  assert.ok(Array.isArray(body.result.structuredContent.owner_actions));
});

test('legacy initialization selects a supported version instead of echoing an unknown one',async()=>{
  const {body}=await call('initialize',{protocolVersion:'2099-01-01'});
  assert.ok(['2026-07-28','2025-11-25','2025-06-18','2025-03-26'].includes(body.result.protocolVersion));
});

test('production x402 v2 plugin admission remains an MCP tool error with no evaluation',async()=>{
  const {response,body}=await call('tools/call',{name:'agent_output_verification',arguments:await example()},
    '/mcp/output-verification',{X402_STANDARD:'1'});
  assert.equal(response.status,200);
  assert.equal(body.result.isError,true);
  assert.equal(body.result._meta['com.agenda/admission'].admission_status,402);
  assert.equal(body.result._meta['com.agenda/admission'].evaluated,false);
  assert.deepEqual(JSON.parse(body.result.content[0].text),body.result.structuredContent);
  assert.equal(body.result.structuredContent.x402Version,2);
  assert.ok(response.headers.get('payment-required'));
});
