import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.js';
const env={AGENT_PROFILE:'critical_minerals_due_diligence',BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1'};
const origin='https://example.test';
test('worked example is a free precomputed demonstration, not a paid form submission',async()=>{
 const html=await (await handleRequest(new Request(origin,{headers:{accept:'text/html'}}),env)).text();
 assert.match(html,/onclick="showWorkedExample\(\)"/);assert.match(html,/Precomputed synthetic fixture/);assert.ok(!html.includes('Run the demo for the actual result'));
});
test('strict paid deployment preserves a valid A2A response to no-op heartbeat',async()=>{
 const body={jsonrpc:'2.0',id:'heartbeat',method:'SendMessage',params:{message:{messageId:'hb-1',role:'ROLE_USER',parts:[{text:'A2A conformance heartbeat'}]}}};
 const response=await handleRequest(new Request(origin+'/message/send',{method:'POST',headers:{'content-type':'application/json','a2a-version':'1.0'},body:JSON.stringify(body)}),env);
 const json=await response.json();assert.equal(json.jsonrpc,'2.0');assert.equal(json.id,'heartbeat');assert.equal(response.status,200);assert.ok(json.result.task);
});

test('heartbeat never admits supplied data, capabilities or work by caller label',async()=>{
 const message={messageId:'hb',role:'ROLE_USER',parts:[{text:'ping'}]};
 const post=async params=>{
  const response=await handleRequest(new Request(origin+'/message/send',{method:'POST',headers:{'a2a-version':'1.0','user-agent':'AgenstryBot/1.0'},body:JSON.stringify({jsonrpc:'2.0',id:7,method:'SendMessage',params})}),env);
  return {response,json:await response.json()};
 };
 for(const params of [{message,capability:'fleet_directory'}, {message:{...message,parts:[{text:'ping',data:{commodity:'lithium'}}]}}, {message:{...message,taskId:'private-task'}}]){
  const {response,json}=await post(params);assert.ok(response.status>=400);assert.equal(json.jsonrpc,'2.0');assert.equal(json.id,7);assert.ok(json.error);assert.ok(!json.result);
 }
 const {response,json}=await post({message:{...message,parts:[{text:'Assess this mineral offtake'}]}});
 assert.ok(response.status>=400);assert.equal(json.jsonrpc,'2.0');assert.ok(json.error);
});
test('all public profiles expose an honest fixed example and a no-op with no evaluated usage',async()=>{
 const profiles=['agenda','kazakhstan','cis_secondary_sanctions','agentic_interaction_trust','agent_output_verification','gulf_maritime_exposure','market_entry_readiness','critical_minerals_due_diligence','dual_use_technology_export','corridor_sanctions_assistant','agent_financial_guard','m2m_escrow_arbiter'];
 for(const profile of profiles){
  const local={...env,AGENT_PROFILE:profile};
  const html=await(await handleRequest(new Request(origin,{headers:{accept:'text/html'}}),local)).text();assert.match(html,/onclick="showWorkedExample\(\)"/);assert.match(html,/kind.*precomputed_synthetic_fixture|Precomputed synthetic fixture/);
  const body={jsonrpc:'2.0',id:8,method:'SendMessage',params:{message:{messageId:'hb',role:'ROLE_USER',parts:[{text:'ping'}]}}};
  const response=await handleRequest(new Request(origin+'/message/send',{method:'POST',headers:{'a2a-version':'1.0'},body:JSON.stringify(body)}),local);const j=await response.json();assert.equal(response.status,200);assert.equal(j.result.task.metadata.evaluation_performed,false);assert.equal(j.result.task.metadata.operation,'heartbeat');
 }
});
test('payment-required MCP and A2A responses carry JSON-RPC errors and preserved challenge',async()=>{
 const discovery=await handleRequest(new Request(origin+'/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}),env);
 const tool=(await discovery.json()).result.tools[0];const args=tool._meta['com.agenda/readiness'].example_arguments;
 const body={jsonrpc:'2.0',id:'paid',method:'tools/call',params:{name:tool.name,arguments:args}};
 const response=await handleRequest(new Request(origin+'/mcp',{method:'POST',body:JSON.stringify(body)}),env);const j=await response.json();assert.equal(response.status,402);assert.equal(j.jsonrpc,'2.0');assert.equal(j.id,'paid');assert.ok(j.error.data);assert.ok(j.x402);
});
