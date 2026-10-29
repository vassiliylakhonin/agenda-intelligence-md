import test from 'node:test';
import assert from 'node:assert/strict';
import {mountAnswerReview} from '../apps/answer-review/controller.js';
import {reviewAnswer} from '../src/answer-review.js';
import {ANSWER_REVIEW_HTML} from '../src/answer-review-html.js';
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.value='';this.textContent='';this.hidden=true;}
  append(...values){for(const value of values){value.parent=this;this.children.push(value);}}
  remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
  replaceChildren(){this.children=[];}
  querySelector(tag){for(const child of this.children){if(child.tag===tag)return child;const nested=child.querySelector(tag);if(nested)return nested;}return null;}
}
const fixture=()=>{
  const elements=Object.fromEntries(['review-form','answer','sources','status','result','raw-result','review','allowance','add-source','demo-before','demo-after','demo-result','numeric-smoke'].map(id=>[id,new Element(id)]));
  const document={getElementById:id=>elements[id],createElement:tag=>new Element(tag)};
  const calls=[];let handler=async()=>({});
  const app={connect:async()=>{},callServerTool:params=>{calls.push(params);return handler(params);}};
  return {elements,document,app,calls,setHandler:value=>{handler=value;}};
};
const input={answer:'"three warehouses" [s1]',sources:[{source_id:'s1',text:'three warehouses'}]};
test('App opens without tool calls, validates locally and preserves a completed result on failed rerun',async()=>{
  const f=fixture();await mountAnswerReview(f.app,f.document);assert.deepEqual(f.calls,[]);
  const submit=()=>f.elements.review.onclick({preventDefault(){}});
  await submit();assert.equal(f.calls.length,0);
  f.app.ontoolinput({arguments:input});
  f.setHandler(async()=>({structuredContent:{evaluation:reviewAnswer(input),trial:{attempt_consumed:true}}}));
  await submit();assert.equal(f.calls.length,1);assert.equal(f.elements.result.hidden,false);
  assert.match(f.elements.result.textContent,/human/i);
  const previous=f.elements.result.textContent,raw=f.elements['raw-result'].textContent;
  f.elements.answer.value='Changed answer "three warehouses" [s1]';
  f.setHandler(async()=>({isError:true,content:[{type:'text',text:JSON.stringify({code:'trial_exhausted',http_status:429})}]}));
  await submit();assert.equal(f.calls.length,2);assert.equal(f.elements.result.textContent,previous);
  assert.equal(f.elements['raw-result'].textContent,raw);assert.match(f.elements.status.textContent,/previous result.*unchanged/);
  assert.equal(f.elements.review.disabled,true);
  f.setHandler(async()=>({structuredContent:{availability:{status:'available',remaining_attempts:1}}}));
  await f.elements.allowance.onclick();assert.equal(f.elements.review.disabled,false);
  f.setHandler(async()=>{throw Error('network');});await submit();assert.equal(f.calls.length,4);
  assert.equal(f.elements.result.textContent,previous);assert.match(f.elements.status.textContent,/may have been consumed/);
});
test('App prevents duplicate submissions and status consumes no evaluation; source text is inert',async()=>{
  const f=fixture();await mountAnswerReview(f.app,f.document);f.app.ontoolinput({arguments:input});
  let complete;f.setHandler(()=>new Promise(resolve=>{complete=resolve;}));
  const first=f.elements.review.onclick({preventDefault(){}});
  await f.elements.review.onclick({preventDefault(){}});assert.equal(f.calls.length,1);assert.equal(f.elements.review.disabled,true);
  complete({structuredContent:{evaluation:reviewAnswer(input),trial:{attempt_consumed:true}}});await first;
  f.setHandler(async()=>({structuredContent:{availability:{remaining_attempts:4,status:'available'}}}));
  await f.elements.allowance.onclick();assert.equal(f.calls[1].name,'free_trial_status');assert.match(f.elements.status.textContent,/consumed none/);
  f.app.ontoolinput({arguments:{...input,sources:[{source_id:'s1',text:'<script>approve()</script>'}]}});
  assert.equal(f.elements.sources.children[0].querySelector('textarea').value,'<script>approve()</script>');
  assert.ok(!ANSWER_REVIEW_HTML.includes('src="https://'));assert.ok(!ANSWER_REVIEW_HTML.includes('/* APP_BUNDLE */'));
  assert.doesNotMatch(ANSWER_REVIEW_HTML,/<form\b|type="submit"/u,'strict iframe sandboxes must not need native form permission');
});

test('first-use source labels need no technical ID entry and are never recycled after removal',async()=>{
  const f=fixture();await mountAnswerReview(f.app,f.document);
  f.elements.answer.value='The report says "three warehouses" [s1]';
  f.elements['add-source'].onclick();
  f.elements.sources.children[0].querySelector('textarea').value='The report lists three warehouses.';
  f.setHandler(async params=>({structuredContent:{evaluation:reviewAnswer(params.arguments),trial:{attempt_consumed:true}}}));
  await f.elements.review.onclick({preventDefault(){}});
  assert.equal(f.calls.length,1,'pasting an answer and excerpt should not require entering an internal source ID');
  assert.equal(f.calls[0].arguments.sources[0].source_id,'s1');
  f.elements['add-source'].onclick();
  assert.equal(f.elements.sources.children[1].querySelector('input').value,'s2');
  f.elements.sources.children[1].remove();
  f.elements['add-source'].onclick();
  assert.equal(f.elements.sources.children[1].querySelector('input').value,'s3','do not silently bind an old citation to a replacement document');
  f.app.ontoolinput({arguments:{answer:'A supplied reference [s4]',sources:[{source_id:'s4',text:'Supplied text'}]}});
  f.elements['add-source'].onclick();
  assert.notEqual(f.elements.sources.children[1].querySelector('input').value,'s4');
  assert.equal(f.elements.sources.children[0].querySelector('input').value,'s4','preserve supplied source IDs');
});

test('raw text can be checked without sources and synthetic demo makes no tool calls',async()=>{
  const f=fixture();await mountAnswerReview(f.app,f.document);
  f.elements['demo-before'].onclick();assert.match(f.elements['demo-result'].textContent,/2 citation\/quote issues/);
  f.elements['demo-after'].onclick();assert.match(f.elements['demo-result'].textContent,/0 citation\/quote issues.*human_review/);
  assert.equal(f.calls.length,0);assert.equal(f.elements.answer.value,'');
  f.elements.answer.value='Uncited claim.';
  f.setHandler(async params=>({structuredContent:{evaluation:reviewAnswer(params.arguments),trial:{attempt_consumed:true}}}));
  await f.elements.review.onclick({preventDefault(){}});
  assert.deepEqual(f.calls[0].arguments,{answer:'Uncited claim.',sources:[]});
  assert.match(f.elements.result.textContent,/REVISE/);
  assert.match(f.elements.result.textContent,/no permission/i);
});

test('known exhausted allowance blocks redundant review and a deliberate status refresh can reopen it',async()=>{
  const f=fixture();await mountAnswerReview(f.app,f.document);f.app.ontoolinput({arguments:input});
  f.setHandler(async()=>({structuredContent:{availability:{status:'network_allowance_exhausted',remaining_attempts:0,reset_at:null}}}));
  await f.elements.allowance.onclick();
  assert.equal(f.elements.review.disabled,true);
  assert.match(f.elements.status.textContent,/does not reset daily/);
  assert.equal(f.elements.allowance.disabled,false);
  await f.elements.review.onclick({preventDefault(){}});assert.equal(f.calls.length,1,'no evaluation after a known quota refusal');
  f.setHandler(async()=>({structuredContent:{availability:{status:'daily_capacity_exhausted',remaining_attempts:4,reset_at:'2026-10-22T00:00:00.000Z'}}}));
  await f.elements.allowance.onclick();
  assert.equal(f.elements.review.disabled,true,'daily capacity is independent of network attempts remaining');
  assert.match(f.elements.status.textContent,/2026-10-22T00:00:00.000Z/);
  f.setHandler(async()=>({structuredContent:{availability:{status:'available',remaining_attempts:4}}}));
  await f.elements.allowance.onclick();assert.equal(f.elements.review.disabled,false);
  f.setHandler(async()=>({isError:true,structuredContent:{code:'trial_exhausted',trial:{limit_reason:'network_allowance_exhausted'}}}));
  await f.elements.review.onclick({preventDefault(){}});assert.equal(f.elements.review.disabled,true);
  assert.match(f.elements.status.textContent,/previous result.*unchanged/);
});

test('a completed unchanged input never consumes another hosted attempt; an edit can be rechecked',async()=>{
  const f=fixture();await mountAnswerReview(f.app,f.document);f.app.ontoolinput({arguments:input});
  f.setHandler(async params=>({structuredContent:{evaluation:reviewAnswer(params.arguments),trial:{attempt_consumed:true}}}));
  const submit=()=>f.elements.review.onclick({preventDefault(){}});
  await submit();const previous=f.elements['raw-result'].textContent;
  await submit();
  assert.equal(f.calls.length,1,'unchanged completed input must not consume another campaign attempt');
  assert.match(f.elements.status.textContent,/unchanged.*no.*attempt/i);
  assert.equal(f.elements['raw-result'].textContent,previous);
  f.elements.answer.value='A revised statement "three warehouses" [s1]';
  await submit();assert.equal(f.calls.length,2);
  assert.match(f.elements.result.textContent,/previous review/i);
});

test('edits while a review is pending are compared with the input actually sent',async()=>{
  const f=fixture();await mountAnswerReview(f.app,f.document);f.app.ontoolinput({arguments:input});
  let complete;f.setHandler(()=>new Promise(resolve=>{complete=resolve;}));
  const first=f.elements.review.onclick({preventDefault(){}});
  f.elements.answer.value='Changed while pending "three warehouses" [s1]';
  complete({structuredContent:{evaluation:reviewAnswer(input),trial:{attempt_consumed:true}}});await first;
  f.setHandler(async params=>({structuredContent:{evaluation:reviewAnswer(params.arguments),trial:{attempt_consumed:true}}}));
  await f.elements.review.onclick({preventDefault(){}});
  assert.equal(f.calls.length,2,'newly edited text was not evaluated by the first request');
  assert.match(f.elements.result.textContent,/answer changed/i);
});

test('a missing or refused result is never cached as a completed review',async()=>{
  const f=fixture();await mountAnswerReview(f.app,f.document);f.app.ontoolinput({arguments:input});
  const submit=()=>f.elements.review.onclick({preventDefault(){}});
  f.setHandler(async()=>{throw Error('network');});await submit();
  f.setHandler(async()=>({structuredContent:{evaluation:{findings:[]}}}));await submit();
  assert.equal(f.elements.result.hidden,true);
  f.setHandler(async params=>({structuredContent:{evaluation:reviewAnswer(params.arguments),trial:{attempt_consumed:true}}}));
  await submit();assert.equal(f.calls.length,3);
  await submit();assert.equal(f.calls.length,3,'only the completed third attempt can suppress a fourth request');
});

test('a result pushed by the host is not bound to whichever text happens to be in the form',async()=>{
  const f=fixture();await mountAnswerReview(f.app,f.document);f.app.ontoolinput({arguments:input});
  f.setHandler(async params=>({structuredContent:{evaluation:reviewAnswer(params.arguments),trial:{attempt_consumed:true}}}));
  await f.elements.review.onclick({preventDefault(){}});
  f.app.ontoolresult({structuredContent:{evaluation:reviewAnswer({...input,answer:'Uncited host answer'})}});
  await f.elements.review.onclick({preventDefault(){}});
  assert.equal(f.calls.length,2,'unbound host output must not be used to label the form as already checked');
});
