import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deployedEnvironments } from './deploy-all.js';
import { cardExtensionParams } from '../src/card-extension.js';
import { WORKED_EXAMPLES } from '../src/worked-examples.js';
import { createHostedMcpCall } from '../../../examples/hosted-mcp/client.mjs';

const fleet = deployedEnvironments(readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8'));
const headers = { 'content-type': 'application/json', 'user-agent': 'Agenda-Plugin-Client-Path/1.0', 'x-client-id': 'agenda-owner-manual' };
const results = [];
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const requireTrace = process.argv.includes('--require-trace');
const requireIntegration = process.argv.includes('--require-integration');
async function check(target) {
  const origin = `https://${target.workerName}.vassiliy-lakhonin.workers.dev`;
  const request = async (path, body, extra = {}) => fetch(origin + path, { method: body ? 'POST' : 'GET', headers: { ...headers, ...extra },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  const card = await request('/.well-known/agent-card.json'); assert.equal(card.status, 200);
  const meta = cardExtensionParams(await card.json()).x_agenda_intelligence;
  const example = meta.a2a_send_message_example;
  let tools;
  for (const [method, params] of [['initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name:'Agenda-Plugin-Client-Path',version:'1.0'} }], ['tools/list', {}]]) {
    const response = await request('/mcp', { jsonrpc:'2.0',id:'client-discovery',method,params });
    assert.equal(response.status,200);
    const data=await response.json();assert.equal(data.id,'client-discovery');assert.ok(data.result&&!data.error);
    if(method==='tools/list') { tools=data.result.tools; assert.ok(Array.isArray(tools)&&tools.length); }
  }
  const unpaid = await request('/message/send', example.request, example.headers);
  assert.equal(unpaid.status,402,'published evaluation must reach payment admission');
  const data=await unpaid.json();assert.equal(data.id,example.request.id);assert.ok(data.error?.data);
  const trace=unpaid.headers.get('x-payment-trace-id');
  if(requireTrace) assert.match(trace||'',uuid);
  // Unsigned synthetic hash asks for a signature only; no receipt check, claim or transfer.
  const challenge=await request('/message/send',example.request,{...example.headers,'x-payment-tx':'0x'+'a'.repeat(64),...(trace?{'x-payment-trace-id':trace}:{})});
  assert.equal(challenge.status,401);
  const signed=await challenge.json();assert.equal(signed.id,example.request.id);assert.equal(signed.code,'payer_signature_required');assert.ok(signed.challenge_message&&signed.request_hash);
  if(requireTrace) assert.equal(challenge.headers.get('x-payment-trace-id'),trace);
  const profile = Object.keys(WORKED_EXAMPLES).find(name => tools.some(tool => tool.name === WORKED_EXAMPLES[name].tool));
  assert.ok(profile,'serving profile must publish a maintained example');
  const tool=tools.find(tool=>tool.name===WORKED_EXAMPLES[profile].tool);
  const input=tool._meta?.['com.agenda/readiness']?.example_arguments;
  assert.ok(input,'published MCP tool must supply example arguments');
  const call=createHostedMcpCall(tool.name,input,{endpoint:origin+'/mcp',headers,
    fetchImpl:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})});
  const admission=await call.evaluate();assert.equal(admission.status,'payment_required');
  assert.equal(admission.payment.required_usdc,profile==='m2m_escrow_arbiter'?0.5:0.05);
  const mcpChallenge=await call.retryWithPayment({transactionHash:'0x'+'a'.repeat(64)});
  assert.equal(mcpChallenge.status,'signature_required');
  assert.equal(mcpChallenge.paymentTraceId,admission.paymentTraceId);
  const landing=await request('/',null,{accept:'text/html'});assert.equal(landing.status,200);
  const html=await landing.text();assert.match(html,/onclick="showWorkedExample\(\)"/);
  assert.match(html,/Precomputed synthetic fixture/);
  const saved=html.match(/Saved example result<\/summary><pre>([\s\S]*?)<\/pre>/)?.[1];
  assert.ok(saved,'saved example result must be present');
  const decoded=saved.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  assert.ok(JSON.parse(decoded) && decoded!=='{}');
  const integration=html.includes('/tree/main/examples/hosted-mcp');
  if(requireIntegration)assert.ok(integration,'common runnable client must be linked');
  return {worker:target.workerName,mcp_tool:tool.name,mcp_unpaid:admission.status,mcp_unsigned:mcpChallenge.status,
    mcp_trace_correlated:true,free_saved_example:true,common_integration_link:integration,discovery:200,unpaid:402,unsigned_challenge:401,trace_correlated:Boolean(trace&&challenge.headers.get('x-payment-trace-id')===trace)};
}
for(let i=0;i<fleet.length;i+=3){
  const batch=await Promise.allSettled(fleet.slice(i,i+3).map(check));
  batch.forEach((r,j)=>results.push(r.status==='fulfilled'?r.value:{worker:fleet[i+j].workerName,error:String(r.reason.message)}));
}
console.log(JSON.stringify({checked_at:new Date().toISOString(),require_trace:requireTrace,require_integration:requireIntegration,results,note:'Owner verification probes only. No signed live payment, RPC receipt verification, transfer or ledger claim.'},null,2));
if(results.some(r=>r.error))process.exitCode=1;
