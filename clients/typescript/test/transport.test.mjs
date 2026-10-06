import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {AgendaIntelligenceClient,RateLimitError} from '../dist/index.js';
const client=fetch=>new AgendaIntelligenceClient({baseUrl:'https://example.invalid',fetch,timeoutMs:20});
test('already-aborted calls do not start an HTTP request',async()=>{
  const controller=new AbortController();controller.abort();let calls=0;
  await assert.rejects(client(async()=>{calls++;return Response.json({ok:true});}).health({signal:controller.signal}),error=>error.name==='AbortError');
  assert.equal(calls,0);
});
test('completed calls remove caller abort listeners',async()=>{
  const controller=new AbortController();const c=client(async()=>Response.json({ok:true}));
  await c.health({signal:controller.signal});await c.health({signal:controller.signal});
  assert.equal(getEventListeners(controller.signal,'abort').length,0);
});
test('timeout covers streamed body after headers arrive',async()=>{
  const c=client(async(_url,{signal})=>new Response(new ReadableStream({start(controller){
    const timer=setTimeout(()=>{controller.enqueue(new TextEncoder().encode('{}'));controller.close();},80);
    signal.addEventListener('abort',()=>{clearTimeout(timer);controller.error(new DOMException('Timed out','AbortError'));},{once:true});
  }})));
  await assert.rejects(c.health(),error=>error.name==='AbortError');
});
for(const body of ['null','[]','true','']) test('non-object success is rejected '+body,async()=>{
  await assert.rejects(client(async()=>new Response(body)).health(),/JSON object/);
});
test('non-JSON 429 preserves retry-after and correlation',async()=>{
  await assert.rejects(client(async()=>new Response('upstream throttled',{status:429,headers:{'retry-after':'7','x-request-id':'synthetic'}})).health(),error=>error instanceof RateLimitError&&error.retryAfterSeconds===7&&error.requestId==='synthetic');
});
