import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {mcpHttpRejection} from '../src/mcp-http.js';
import {memoryD1} from './helpers/d1.js';
const version='2026-07-28',key='io.modelcontextprotocol/protocolVersion';
const request=(body,headers={})=>new Request('https://example.test/mcp/agent',{method:'POST',headers:{'content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
const body=(method,params={})=>({jsonrpc:'2.0',id:1,method,params:{...params,_meta:{[key]:version}}});
const headers=method=>({'mcp-protocol-version':version,'mcp-method':method});
const env={AGENT_PROFILE:'agent_output_verification',BILLING_MODE:'pay_per_call',WORKER_FREE_TRIAL:'1'};

test('modern HTTP rejects mirrored-header errors before any trial or paid admission',async()=>{
  const state={...env,PAYMENT_LEDGER:memoryD1()};
  const value=body('tools/call',{name:'review_answer',arguments:{answer:'Claim [s1]',sources:[{source_id:'s1',text:'Text'}]}});
  for(const h of [{},headers('tools/list'),{...headers('tools/call'),'mcp-name':'free_trial'}, {'mcp-name':'review_answer','mcp-method':'tools/call'}]) {
    const response=await handleRequest(request(value,{'cf-connecting-ip':'192.0.2.1',...h}),state);
    assert.equal(response.status,400);assert.equal((await response.json()).error.code,-32020);
  }
  assert.equal((await state.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS count FROM output_verification_trials').first()).count,0);
});
test('modern discovery and named resources work; unsupported version, parse and method have correct HTTP status',async()=>{
  assert.equal((await handleRequest(request(body('tools/list'),headers('tools/list')),env)).status,200);
  const resource=body('resources/read',{uri:'ui://agenda/answer-review.html'});
  assert.equal((await handleRequest(request(resource,{...headers('resources/read'),'mcp-name':resource.params.uri}),env)).status,200);
  for(const [value,h,status,code] of [
    [body('not/a/method'),headers('not/a/method'),404,-32601],
    ['{',headers('tools/list'),400,-32700],
    [{...body('tools/list'),jsonrpc:'1.0'},headers('tools/list'),400,-32600],
    [body('tools/list'),{...headers('tools/list'),'mcp-protocol-version':'2099-01-01'},400,-32022]
  ]) {const response=await handleRequest(request(value,h),env);assert.equal(response.status,status);assert.equal((await response.json()).error.code,code);}
});
test('named metadata decodes UTF-8 sentinel values and rejects malformed encodings',()=>{
  for(const name of ['世界',' padded ','=?base64?literal?=','tool_name']) {
    const value=body('tools/call',{name,arguments:{}}),encoded='=?base64?'+Buffer.from(name).toString('base64')+'?=';
    assert.equal(mcpHttpRejection(request(value,{...headers('tools/call'),'mcp-name':encoded}),value),null);
  }
  const value=body('tools/call',{name:'世界'});
  for(const name of ['=?base64?%%%%?=','=?BASE64?5LiW55WM?=','=?base64?/w==?='])assert.equal(mcpHttpRejection(request(value,{...headers('tools/call'),'mcp-name':name}),value).error.code,-32020);
});
test('legacy handshake requests and initialized notification remain compatible',async()=>{
  for(const protocolVersion of ['2025-03-26','2025-06-18','2025-11-25']) {
    const response=await handleRequest(request({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion}}),env);
    assert.equal(response.status,200);assert.equal((await response.json()).result.protocolVersion,protocolVersion);
  }
  const response=await handleRequest(request({jsonrpc:'2.0',method:'notifications/initialized'}),env);
  assert.equal(response.status,202);assert.equal(await response.text(),'');
});
