import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.js';
import { memoryD1 } from './helpers/d1.js';
const origin = 'https://legacy.example';
const fixture = {project_name:'Synthetic continuation',corridor_leg:'Aktau-Baku',capex_usd_m:10,ifi_debt_usd_m:5,dscr_min:1.4};
const env = {AGENT_PROFILE:'agenda',BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1'};
const call = (path, body) => handleRequest(new Request(origin+path,{method:'POST',headers:{'content-type':'application/json','x-client-id':'agenda-owner-continuation-test'},body:JSON.stringify(body)}),env);
test('legacy REST preview distinguishes delivered output and optional signed HTTP/MCP continuation', async()=>{
  const response = await call('/v1/corridor-bankability/screen',fixture);
  assert.equal(response.status,200);
  const data = await response.json();
  assert.equal(data.unlocked_full_dossier,false);
  assert.equal(data.continuation.status,'free_preview_completed');
  assert.equal(data.continuation.payment_required_for_preview,false);
  assert.equal(data.continuation.optional_paid_continuation.amount_usdc,25);
  assert.equal(data.continuation.http.url,origin+'/v1/corridor-bankability/screen');
  assert.equal(data.continuation.mcp.url,origin+'/mcp/agent');
  assert.equal(data.continuation.mcp.tool,'corridor_bankability_screen');
  assert.deepEqual(data.continuation.payment.required_headers,['X-Payment-Tx','X-Payment-Signature']);
  assert.match(data.x402_unlock.how_to_unlock,/challenge/i);
  assert.match(data.x402_unlock.how_to_unlock,/X-Payment-Signature/);
  assert.ok(!data.full_dossier);
});
test('MCP-only callers receive the same actionable continuation with their actual hostname',async()=>{
  const response=await call('/mcp/agent',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'corridor_bankability_screen',arguments:fixture}});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.result.isError,false);
  const text=JSON.stringify(body.result);
  assert.match(text,/free_preview_completed/);
  assert.match(text,/X-Payment-Signature/);
  assert.match(text,/https:\/\/legacy.example\/mcp\/agent/);
});
test('invalid financial input remains refused before a continuation is offered',async()=>{
  const response=await call('/v1/corridor-bankability/screen',{...fixture,ifi_debt_usd_m:11});
  assert.equal(response.status,400);
  assert.equal((await response.json()).continuation,undefined);
});

test('payment hash alone only returns a signing challenge on both continuation transports',async()=>{
  const tx='0x'+'a'.repeat(64);
  for(const [path,body,status] of [
    ['/v1/corridor-bankability/screen',fixture,401],
    ['/mcp/agent',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'corridor_bankability_screen',arguments:fixture}},200]
  ]) {
    const response=await handleRequest(new Request(origin+path,{method:'POST',headers:{'content-type':'application/json','x-payment-tx':tx},body:JSON.stringify(body)}),{...env,PAYMENT_LEDGER:memoryD1()});
    assert.equal(response.status,status);
    const data=await response.json();
    const details=path==='/mcp/agent'?JSON.parse(data.result.content[0].text).details:data;
    assert.ok(details.challenge_message);
    assert.equal(details.unlocked_full_dossier,undefined);
    if(path==='/mcp/agent') assert.equal(data.result.isError,true);
  }
});
test('a non-Agenda HTTP profile points MCP continuation at the host that publishes the tool',async()=>{
  const response=await handleRequest(new Request(origin+'/v1/corridor-bankability/screen',{method:'POST',body:JSON.stringify(fixture)}),{...env,AGENT_PROFILE:'gulf_maritime_exposure'});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.continuation.http.url,origin+'/v1/corridor-bankability/screen');
  assert.equal(data.continuation.mcp.url,'https://agendamcp.dpdns.org/mcp/agent');
});
