// Public conformance and refusal probes only. No signing, funding or paid execution.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deployedEnvironments} from './deploy-all.js';
import {validateAgentCard} from './verify-agent-card.js';
import {assertSignedCard} from './card-signing-bootstrap.js';
import {cardExtensionParams} from '../src/card-extension.js';

export function publicTargets() {
  return deployedEnvironments(readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8')).map(target=>({
    ...target,key:target.workerName.replace(/-a2a$/,''),
    origin:`https://${target.workerName}.${process.env.WORKERS_SUBDOMAIN || 'vassiliy-lakhonin'}.workers.dev`
  }));
}
const ownerHeaders={'accept':'application/json','user-agent':'agenda-owner-public-conformance/2.0','x-client-id':'agenda-owner-manual'};
async function request(url,body,extra={},fetchImpl=fetch) {
  const response=await fetchImpl(url,{method:body===undefined?'GET':'POST',headers:{...ownerHeaders,...(body===undefined?{}:{'content-type':'application/json'}),...extra},
    ...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
  const data=await response.json();return {response,data};
}
export async function verifyPublicAgent(target,{fetchImpl=fetch,refusalsOnly=false}={}) {
  const {origin}=target;
  const card=await request(origin+'/.well-known/agent-card.json',undefined,{},fetchImpl);
  assert.equal(card.response.status,200);
  assert.deepEqual(validateAgentCard(card.data,origin+'/.well-known/agent-card.json'),[]);
  const meta=cardExtensionParams(card.data).x_agenda_intelligence;
  const primary=card.data.supportedInterfaces?.find(item=>item.protocolBinding==='JSONRPC');
  assert.ok(primary?.url);assert.equal(new URL(primary.url).origin,origin);
  const counts={card_schema:1,signature_verified:0,payment_admission:0,refusals:0};
  if(!refusalsOnly) {
    const health=await request(origin+'/health',undefined,{},fetchImpl);assert.equal(health.response.status,200);
    const jwks=await request(origin+'/.well-known/jwks.json',undefined,{},fetchImpl);assert.equal(jwks.response.status,200);
    await assertSignedCard(card.data,jwks.data,origin);counts.signature_verified++;
    const example=meta.a2a_send_message_example;assert.ok(example?.request&&example?.headers);
    const admission=await request(primary.url,example.request,example.headers,fetchImpl);
    assert.equal(admission.response.status,402);assert.equal(admission.data.id,example.request.id);
    assert.ok(admission.data.error?.data);assert.equal(admission.data.result,undefined);
    assert.match(admission.response.headers.get('x-payment-trace-id')||'',/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
    counts.payment_admission++;
  }
  for(const path of [primary.url,origin+'/mcp']) {
    for(const [name,body,code] of [
      ['parse','{',-32700],
      ['version',{jsonrpc:'1.0',id:'invalid-version',method:'NoSuchMethod'},-32600],
      ['unknown_method',{jsonrpc:'2.0',id:'unknown-method',method:'NoSuchMethod',params:{}},-32601]
    ]) {
      const result=await request(path,body,{'a2a-version':'1.0','mcp-protocol-version':'2025-06-18'},fetchImpl);
      assert.equal(result.data.error?.code,code,`${target.key} ${path} ${name}: HTTP ${result.response.status}`);
      assert.equal(result.data.result,undefined);counts.refusals++;
    }
  }
  return {worker:target.workerName,...counts};
}
export async function runPublicConformance({refusalsOnly=false,args=process.argv.slice(2)}={}) {
  const aliases={'agenda':'agenda-intelligence','middle-corridor':'middle-corridor-deal-risk-gate','kazakhstan-market-entry':'kazakhstan-market-entry-readiness'};
  const selected=args.map(key=>aliases[key]||key);
  const all=publicTargets();const targets=selected.length?all.filter(target=>selected.includes(target.key)):all;
  assert.ok(targets.length&&selected.every(key=>targets.some(target=>target.key===key)),'Unknown or missing public Worker target');
  const records=[];
  for(let i=0;i<targets.length;i+=3) {
    const batch=await Promise.allSettled(targets.slice(i,i+3).map(target=>verifyPublicAgent(target,{refusalsOnly})));
    batch.forEach((result,j)=>records.push(result.status==='fulfilled'?result.value:{worker:targets[i+j].workerName,error:String(result.reason?.message||result.reason)}));
  }
  console.log(JSON.stringify({checked_at:new Date().toISOString(),scope:refusalsOnly?'public protocol refusals':'AgentCard schema/signature, unpaid A2A admission and protocol refusals',records,paid_execution_tested:false},null,2));
  if(records.some(record=>record.error))process.exitCode=1;
  return records;
}
