import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {handleArchiveFeedback} from '../src/archive-feedback.js';
const origin='https://example.test',env={AGENT_PROFILE:'agenda',BILLING_MODE:'pay_per_call'};
const request=(value,extra={})=>new Request(origin+'/archive-feedback',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin,'x-client-id':'agenda-owner-archive-feedback-test',...extra},body:new URLSearchParams(value)});
const answer={outcome:'packet_prepared',context:'synthetic_example',blocker:'none',consent:'yes'};
test('optional feedback is explicit, finite and separate from workspace, usage and payment',async()=>{
  const log=console.log,events=[];console.log=e=>events.push(e);
  try{
    const form=await handleRequest(new Request(origin+'/archive-feedback'),env);assert.equal(form.status,200);
    assert.equal(form.headers.get('referrer-policy'),'same-origin','native form POST needs its same-origin Origin; no-referrer can serialize it as null');
    assert.equal(events.filter(e=>e?.step==='archive_feedback').length,0);assert.match(await form.text(),/name="consent"/);
    const result=await handleRequest(request(answer),env);assert.equal(result.status,200);assert.match(await result.text(),/Feedback accepted/);
    const feedback=events.filter(e=>e?.step==='archive_feedback');assert.equal(feedback.length,1);
    assert.equal(feedback[0].event_version,8);assert.equal(feedback[0].feedback_context,'synthetic_example');
    assert.equal(feedback[0].acceptance_verified,false);assert.equal(feedback[0].evaluation_performed,false);
    assert.ok(!events.some(e=>['agenda_intelligence_payment','agenda_intelligence_a2a_usage'].includes(e?.event)));
    const workspace=await handleRequest(new Request(origin+'/document-archive'),env);
    assert.match(workspace.headers.get('content-security-policy'),/connect-src 'none'/);
    assert.match(workspace.headers.get('content-security-policy'),/form-action 'none'/);
    assert.match(await workspace.text(),/href="\/archive-feedback" target="_blank"/);
  }finally{console.log=log;}
});
test('unsolicited fields, absent consent, cross-origin and excessive bodies are refused without recording',async()=>{
  let recorded=0;const record=()=>{recorded++;};
  for(const patch of [{consent:'no'},{context:'private-filename.pdf'},{blocker:'export'},
    {filename:'private-filename.pdf'},{outcome:'still_blocked',blocker:'none'}]){
    assert.equal((await handleArchiveFeedback(request({...answer,...patch}),record)).status,400);
  }
  assert.equal((await handleArchiveFeedback(request(answer,{origin:'https://else.test'}),record)).status,403);
  assert.equal((await handleArchiveFeedback(request(answer,{'content-type':'application/json'}),record)).status,415);
  const large=new Request(origin+'/archive-feedback',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:'x'.repeat(1025)});
  assert.equal((await handleArchiveFeedback(large,record)).status,413);
  assert.equal(recorded,0);
  assert.equal((await handleArchiveFeedback(request(answer),()=>{throw Error('report failed');})).status,503);
});
test('archive service offers bounded scope and acceptance before any order or payment',async()=>{
  for(const path of ['/archive-review','/archive-review/sample.md']){
    const result=await handleRequest(new Request(origin+path),env);assert.equal(result.status,200);
    const text=await result.text();assert.match(text,/synthetic|Synthetic/);
    assert.equal((await handleRequest(new Request(origin+path,{method:'POST'}),env)).status,405);
    assert.equal(await(await handleRequest(new Request(origin+path,{method:'HEAD'}),env)).text(),'');
    if(path==='/archive-review'){assert.match(text,/99 USD/);assert.match(text,/written quote/);assert.match(text,/two business days/);assert.match(text,/mailto:/);}
  }
});
