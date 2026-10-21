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
  const elements=Object.fromEntries(['review-form','answer','sources','status','result','raw-result','review','allowance','add-source'].map(id=>[id,new Element(id)]));
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
  f.setHandler(async()=>({isError:true,content:[{type:'text',text:JSON.stringify({code:'trial_exhausted',http_status:429})}]}));
  await submit();assert.equal(f.calls.length,2);assert.equal(f.elements.result.textContent,previous);
  assert.equal(f.elements['raw-result'].textContent,raw);assert.match(f.elements.status.textContent,/previous result.*unchanged/);
  assert.equal(f.elements.review.disabled,false);
  f.setHandler(async()=>{throw Error('network');});await submit();assert.equal(f.calls.length,3);
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
