import test from 'node:test';
import assert from 'node:assert/strict';
import {x402RequiredResponse,x402ExecutionResponse,decodeX402} from '../src/x402-v2.js';

test('x402 challenges and failures share the MCP boundary for both standard client paths',async()=>{
  for(const path of ['/mcp/agent','/mcp/output-verification','/mcp','/v1/agent-output/verification']) {
    const standard=['/mcp/agent','/mcp/output-verification'].includes(path);
    const request=new Request('https://example.test'+path,{method:'POST'});
    const body={jsonrpc:'2.0',id:'fixed-request',method:'tools/call',params:{name:'agent_output_verification',arguments:{}}};
    const challenge=x402RequiredResponse(request,body,0.05,Response.json({code:'payment_required'},{status:402}));
    assert.equal(challenge.status,standard?200:402,path);
    const required=decodeX402(challenge.headers.get('payment-required'));
    assert.equal(required.resource.url,request.url);
    const result=await challenge.json();
    if(standard){
      assert.equal(result.id,body.id);assert.equal(result.result.isError,true);
      assert.deepEqual(JSON.parse(result.result.content[0].text),required);
      assert.deepEqual(result.result.structuredContent,required);
      assert.equal(result.result._meta['com.agenda/admission'].evaluated,false);
      assert.match(result.result._meta['com.agenda/admission'].next_step,/free_trial/);
    }else assert.equal(result.code,'payment_required');
    const failed=await x402ExecutionResponse(request,body,Response.json({code:'x402_unavailable'},{status:503}));
    assert.equal(failed.status,standard?200:503,path);
    assert.equal(decodeX402(failed.headers.get('payment-response')).success,false);
    const failure=await failed.json();
    if(standard){
      assert.equal(failure.result.isError,true);const data=JSON.parse(failure.result.content[0].text);
      assert.equal(data.evaluated,false);assert.equal(data.result_available,false);
      assert.equal(data.admission_status,503);assert.equal(data.code,'x402_unavailable');
    }else assert.equal(failure.code,'x402_unavailable');
  }
});
