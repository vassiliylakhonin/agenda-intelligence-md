import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { handleRequest } from '../src/index.js';
import { PRODUCT_WORKFLOWS } from '../src/product-workflows.js';
import { readBoundedJson, safeJsonInputDiagnostics } from '../src/request-body.js';
import { createTelemetry } from '../src/telemetry.js';

const origin = 'https://example.test';
const env = { AGENT_PROFILE:'agent_output_verification', BILLING_MODE:'pay_per_call', VIZIER_DISABLED:'1' };
async function silent(action) {
  const events=[], old=console.log; console.log=value=>events.push(value);
  try { return await action(events); } finally { console.log=old; }
}

test('documented jq extraction produces an executable request from actual wire cards', async () => silent(async () => {
  const guide=readFileSync(new URL('../../../docs/deployment/hosted-quickstart.md',import.meta.url),'utf8');
  const filter=guide.match(/\| jq(?: -e)? '([^']+)' > a2a-request.json/)[1];
  for (const profile of Object.keys(PRODUCT_WORKFLOWS)) {
    const configured={...env,AGENT_PROFILE:profile};
    const card=await (await handleRequest(new Request(origin+'/.well-known/agent-card.json'),configured)).json();
    const extracted=spawnSync('jq',['-e',filter],{input:JSON.stringify(card),encoding:'utf8'});
    assert.equal(extracted.status,0,profile+': '+extracted.stderr+' '+extracted.stdout);
    const body=JSON.parse(extracted.stdout);
    assert.equal(body?.method,'SendMessage',profile);
    const response=await handleRequest(new Request(card.supportedInterfaces[0].url,{
      method:'POST',headers:{'content-type':'application/json','a2a-version':'1.0'},body:JSON.stringify(body)
    }),configured);
    assert.equal(response.status,402,profile+': '+await response.text());
  }
}));

test('diagnostic labels reject injected values and never establish caller identity', async () => silent(async events => {
  const labels={failure:'malformed_json',media_type:'text',origin_relation:'cross_origin',referrer_relation:'other'};
  assert.deepEqual(safeJsonInputDiagnostics({...labels,raw_body:'private-marker'}),labels);
  for (const field of Object.keys(labels)) assert.equal(safeJsonInputDiagnostics({...labels,[field]:'private-marker'}),null);
  const telemetry=createTelemetry({agentProfile:()=> 'agenda',jsonResponse:Response.json,
    AGENSTRY_VERIFICATION_PATHS:[],directRoutes:()=>({})});
  telemetry.logPaymentEvent(new Request(origin+'/message/send'),{},
    {stage:'payment_rejected',validation:{category:'invalid_json',error_count:1},input_diagnostics:{...labels,failure:'private-marker'}});
  assert.equal(events[0].input_diagnostics,undefined);
  assert.doesNotMatch(JSON.stringify(events),/private-marker/);
  for (const [headers,relations] of [
    [{},['absent','absent']],
    [{origin:'null',referer:'not a URL'},['invalid','invalid']],
    [{origin:'https://other.test',referer:origin+'/private-path'},['cross_origin','same_origin']],
    [{origin:'https://other.test/private-path',referer:'https://agenstry.com.evil.test/private-path'},['invalid','other']]
  ]) {
    const response=await handleRequest(new Request(origin+'/message/send',{method:'POST',headers,body:'{' }),env);
    const data=await response.json();
    assert.equal(data.input_diagnostics.origin_relation,relations[0]);
    assert.equal(data.input_diagnostics.referrer_relation,relations[1]);
  }
}));

test('stream read errors remain input refusals; byte limits survive cancellation errors', async () => {
  let cancelled=false;
  const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(8));},
    cancel(){cancelled=true;throw new Error('private-marker');}});
  await assert.rejects(readBoundedJson(new Request(origin,{method:'POST',body:stream,duplex:'half'}),10),
    {status:413,json_body_failure:'body_too_large'});
  assert.equal(cancelled,true);
  const broken=new ReadableStream({pull(){throw new Error('private-marker');}});
  await assert.rejects(readBoundedJson(new Request(origin,{method:'POST',body:broken,duplex:'half'})),
    error=>error.status===400 && error.json_body_failure==='read_failed' && !error.message.includes('private-marker'));
});

test('valid JSON with a noncanonical media type retains normal heartbeat admission', async () => silent(async events => {
  const body=JSON.stringify({jsonrpc:'2.0',id:'first-call',method:'SendMessage',params:{message:{messageId:'first-call',
    role:'ROLE_USER',parts:[{text:'A2A conformance heartbeat'}]}}});
  for (const type of ['application/json','text/plain','application/x-www-form-urlencoded']) {
    const response=await handleRequest(new Request(origin+'/message/send',{method:'POST',
      headers:{'a2a-version':'1.0','content-type':type},body}),env);
    assert.equal(response.status,200);
    assert.equal((await response.json()).result.task.metadata.evaluation_performed,false);
  }
  assert.ok(!events.some(e=>e?.input_diagnostics));
}));

test('JSON admission distinguishes empty, form, UTF-8, malformed and oversized input without retaining content', async () => silent(async events => {
  const cases=[
    {body:undefined,headers:{},failure:'empty_body',media_type:'missing',status:400},
    {body:'',headers:{'content-type':'application/json'},failure:'empty_body',media_type:'json',status:400},
    {body:'prompt=private-marker',headers:{'content-type':'application/x-www-form-urlencoded'},failure:'malformed_json',media_type:'form_urlencoded',status:400},
    {body:'{"secret":"private-marker"',headers:{'content-type':'application/json; charset=utf-8'},failure:'malformed_json',media_type:'json',status:400},
    {body:new Uint8Array([0xff]),headers:{'content-type':'application/json'},failure:'invalid_utf8',media_type:'json',status:400},
    {body:'private-marker',headers:{'content-type':'multipart/form-data; boundary=private-boundary'},failure:'malformed_json',media_type:'multipart',status:400},
    {body:'private-marker',headers:{'content-length':'1048577','content-type':'private-type'},failure:'body_too_large',media_type:'other',status:413}
  ];
  for (const row of cases) {
    events.length=0;
    const response=await handleRequest(new Request(origin+'/message/send?private-query',{
      method:'POST',headers:{...row.headers,origin,referer:'https://agenstry.com/agents/private-path?private-query',
        'x-client-id':'agenda-owner-manual'},body:row.body
    }),env);
    const data=await response.json();
    assert.equal(response.status,row.status);
    assert.equal(data.validation.category,row.status===413?'body_too_large':'invalid_json');
    assert.deepEqual(data.input_diagnostics,{failure:row.failure,media_type:row.media_type,
      origin_relation:'same_origin',referrer_relation:'agenstry'});
    const payment=events.filter(e=>e?.event==='agenda_intelligence_payment');
    assert.equal(payment.length,2);
    assert.ok(payment.every(e=>e.event_version===5 && e.origin_verification==='unverified'));
    assert.ok(payment.every(e=>JSON.stringify(e.input_diagnostics)===JSON.stringify(data.input_diagnostics)));
    assert.ok(!events.some(e=>e?.event==='agenda_intelligence_a2a_usage'));
    assert.doesNotMatch(JSON.stringify(events),/private-marker|private-boundary|private-type|private-query|private-path/);
    const hint=data.request_hint;
    const repaired=await handleRequest(new Request(origin+'/message/send',{
      method:'POST',headers:hint.headers,body:JSON.stringify(hint.example_request)
    }),env);
    assert.equal(repaired.status,402);
  }
}));
