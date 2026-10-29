import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {CORRIDOR_WIZARD_SCRIPT,corridorWizardHtml} from '../src/corridor-wizard.js';
import {handleRequest} from '../src/index.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {corridorOwnerActions,corridorOwnerActionsHtml} from '../src/corridor-owner-actions.js';

const schema=JSON.parse(readFileSync(new URL('../../../schemas/v1/middle-corridor-deal-risk-request.schema.json',import.meta.url),'utf8'));
const base={route:'Aktau → Baku',cargo:'industrial equipment',decision_stage:'pre_signature',risk_question:'What remains before review?',
  counterparties:[{role:'forwarder',name:'Example Forwarder',jurisdiction:''}],dated_sources:[]};
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.value='';this.style={};this.hidden=false;this.textContent='';}
  setAttribute(k,v){this.attributes[k]=v;}
  getAttribute(k){return this.attributes[k];}
  appendChild(e){e.parent=this;this.children.push(e);return e;}
  remove(){this.parent.children=this.parent.children.filter(item=>item!==this);}
  scrollIntoView(){}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(selector==='[data-field]' && child.attributes['data-field']?[child]:[]),...child.querySelectorAll(selector)]);}
}
function fixture(){
  const ids=['corridor-wizard','corridor-parties','corridor-sources','corridor-add-party','corridor-add-source','corridor-next-1','corridor-next-2','corridor-step-2','corridor-step-3','corridor-prepare','corridor-route','corridor-cargo','corridor-stage','corridor-question','corridor-status','profile-request','profile-intake','profile-console'];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element('div')]));let updates=0;elements['profile-intake'].updateFromJson=()=>updates++;
  const context={document:{getElementById:id=>elements[id],createElement:tag=>new Element(tag)}};
  vm.runInNewContext(CORRIDOR_WIZARD_SCRIPT,context);context.mountCorridorWizard(schema);
  return {elements,context,updates:()=>updates};
}
test('wizard assembles only supplied fields, accepts no documents and rejects invalid records',()=>{
  const context={};vm.runInNewContext(CORRIDOR_WIZARD_SCRIPT,context);
  const value=JSON.parse(JSON.stringify(context.corridorAssemble(base,schema)));
  assert.deepEqual(value.dated_sources,[]);assert.deepEqual(value.counterparties,[{role:'forwarder',name:'Example Forwarder'}]);
  assert.equal(value.decision_stage,'pre_signature');assert.equal(value.risk_question,base.risk_question);
  for(const bad of [{...base,decision_stage:'unknown'}, {...base,counterparties:[]},
    {...base,dated_sources:[{id:'x',source_type:'beneficial_ownership_source',title:'record',date:'2026-02-30'}]},
    {...base,dated_sources:[{id:'x',source_type:'invented_type',title:'record',date:'2026-01-01'}]}]) assert.throws(()=>context.corridorAssemble(bad,schema));
});
test('actual wizard prepares structured JSON without sending, inventing or dropping inputs',()=>{
  const {elements,updates}=fixture();
  elements['corridor-route'].value=base.route;elements['corridor-cargo'].value=base.cargo;
  elements['corridor-stage'].value=base.decision_stage;elements['corridor-question'].value=base.risk_question;
  const fields=Object.fromEntries(elements['corridor-parties'].children[0].querySelectorAll('[data-field]').map(field=>[field.getAttribute('data-field'),field]));
  fields.role.value='forwarder';fields.name.value='Example Forwarder';
  elements['corridor-prepare'].onclick();
  assert.deepEqual(JSON.parse(elements['profile-request'].value).dated_sources,[]);assert.equal(updates(),1);
  assert.match(elements['corridor-status'].textContent,/No evaluation or upload occurred/);
  elements['corridor-add-source'].onclick();
  const source=Object.fromEntries(elements['corridor-sources'].children[0].querySelectorAll('[data-field]').map(field=>[field.getAttribute('data-field'),field]));
  source.id.value='s1';source.source_type.value='beneficial_ownership_source';source.title.value='Provided record';source.date.value='2026-03-01';
  elements['corridor-prepare'].onclick();
  assert.deepEqual(JSON.parse(elements['profile-request'].value).dated_sources,[{id:'s1',source_type:'beneficial_ownership_source',title:'Provided record',date:'2026-03-01'}]);
  source.date.value='not-a-date';const previous=elements['profile-request'].value;
  elements['corridor-prepare'].onclick();assert.equal(elements['profile-request'].value,previous);assert.match(elements['corridor-status'].textContent,/No request was sent/);
  assert.match(corridorWizardHtml(schema),/nothing is uploaded/i);
});
async function call(input){
  const old=console.log;console.log=()=>{};
  try {const request=new Request('https://example.test/mcp',{method:'POST',headers:{'content-type':'application/json','x-client-id':'agenda-owner-corridor-workflow-test'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'middle_corridor_deal_risk',arguments:input}})});
    const result=await(await handleRequest(request,{AGENT_PROFILE:'kazakhstan',VIZIER_DISABLED:'1'})).json();assert.equal(result.result.isError,false);return result.result.structuredContent;
  } finally {console.log=old;}
}
test('stage orders suggested owners without changing the required categories or granting approval',async()=>{
  const request={...base,counterparties:[{role:'forwarder',name:'Example Forwarder'}]};
  const first=await call(request),later=await call({...request,decision_stage:'in_transit'});
  assert.deepEqual(first.minimum_sources_before_go,later.minimum_sources_before_go);
  assert.equal(corridorOwnerActions(request,first)[0].source_type,'counterparty_registry_extract');
  assert.equal(corridorOwnerActions({...request,decision_stage:'in_transit'},later)[0].source_type,'vessel_or_carrier_history');
  assert.equal(corridorOwnerActions(request,first).length,6);
  assert.ok(corridorOwnerActions(request,first).every(action=>action.suggested===true));
  assert.deepEqual(first.readiness_contract.owner_actions,[]);
  assert.equal(first.authorization_granted,false);assert.equal(later.authorization_granted,false);
  const dual=await call({...request,cargo:'dual-use electronics'});
  assert.ok(corridorOwnerActions({...request,cargo:'dual-use electronics'},dual).some(action=>action.source_type==='end_user_or_reexport_evidence'));
  assert.ok(!dual.minimum_sources_before_go.includes('end_user_or_reexport_evidence'));
  const before=JSON.stringify(first);const html=corridorOwnerActionsHtml(request,first,String);
  assert.match(html,/Suggested next actions/);assert.equal(JSON.stringify(first),before);
  assert.deepEqual(corridorOwnerActions(request,{error:'unavailable'}),[]);
  const bankRequest={...request,risk_question:'Will the bank accept this file?'};
  assert.ok(corridorOwnerActions(bankRequest,first).some(action=>action.owner==='Banking / trade-finance owner'));
  const degraded={...first,evidence_gaps:['Configured upstream screening is unavailable or incomplete; re-run before commercial action.',...first.evidence_gaps]};
  assert.equal(corridorOwnerActions(request,degraded)[0].owner,'Compliance / security reviewer');
});
test('saved synthetic records remain gaps and never count as a real source',()=>{
  const example=WORKED_EXAMPLES.kazakhstan,after=example.follow_up.response;
  assert.equal(example.follow_up.kind,'precomputed_synthetic_placeholders');
  assert.deepEqual(after.minimum_sources_before_go,example.response.minimum_sources_before_go);
  assert.ok(after.source_record_review.issues.length>=6);assert.equal(after.authorization_granted,false);
});

test('published trial page exposes the wizard and all six gate categories before a call',async()=>{
  const request=new Request('https://example.test/',{headers:{accept:'text/html','x-client-id':'agenda-owner-corridor-page-test'}});
  const html=await (await handleRequest(request,{AGENT_PROFILE:'kazakhstan',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'})).text();
  assert.match(html,/id="corridor-wizard"/);
  assert.match(html,/counterparty registry extract/);
  assert.match(html,/beneficial ownership source/);
  assert.match(html,/sanctions list extract/);
  assert.match(html,/customs or regulatory source/);
  assert.match(html,/insurance clause or underwriter note/);
  assert.match(html,/vessel or carrier history/);
  assert.match(html,/Adding fake records: gaps remain/);
});

test('bundled Worker renders suggested actions in the browser without keepNames helpers',async()=>{
  const built=await build({entryPoints:[new URL('../src/index.js',import.meta.url).pathname],bundle:true,keepNames:true,platform:'neutral',format:'esm',write:false});
  const bundled=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  const request=new Request('https://example.test/',{headers:{accept:'text/html','x-client-id':'agenda-owner-corridor-browser-test'}});
  const html=await(await bundled.handleRequest(request,{AGENT_PROFILE:'kazakhstan',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'})).text();
  const box={value:JSON.stringify(WORKED_EXAMPLES.kazakhstan.request)};
  const context={URL,window:{location:{href:'https://example.test/',origin:'https://example.test'},crypto:globalThis.crypto},crypto:globalThis.crypto,
    document:{getElementById:id=>id==='profile-request'?box:null,createElement:()=>({set textContent(value){this.innerHTML=String(value);}})}};
  vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],context);
  const output=context.corridorOwnerActionsHtml(WORKED_EXAMPLES.kazakhstan.request,WORKED_EXAMPLES.kazakhstan.response,String);
  assert.match(output,/Suggested next actions/);assert.match(output,/Counterparty \/ compliance reviewer/);
});

test('pre-signature adapter holds on failures and never grants authority on a complete-looking result',async()=>{
  const {beforeSignature}=await import('../../../examples/kazakhstan-middle-corridor/before-signature.mjs');
  const input={...base,counterparties:[{role:'forwarder',name:'Example Forwarder'}]};
  const response=await call(input);
  const ok=await beforeSignature(input,async()=>response);
  assert.equal(ok.outcome,'human_review');assert.equal(ok.authorization_granted,false);assert.match(ok.next_one_thing,/registry extract/);
  for(const fake of [{...response,authorization_granted:true},{...response,route:'different route'},
    {...response,counterparties:[{role:'bank',name:'Other'}]},null]) {
    const result=await beforeSignature(input,async()=>fake);assert.equal(result.outcome,'hold');assert.equal(result.authorization_granted,false);
  }
  assert.equal((await beforeSignature({...input,decision_stage:'pre_shipment'},async()=>response)).outcome,'hold');
  assert.equal((await beforeSignature(input,async()=>{throw Error('quota');})).outcome,'hold');
  assert.equal((await beforeSignature(input,async()=>({...response,next_action:'block'}))).outcome,'hold');
  const complete={...response,minimum_sources_before_go:[],evidence_gaps:[],decision_readiness_score:100};
  const stillReview=await beforeSignature(input,async()=>complete);assert.equal(stillReview.outcome,'human_review');assert.equal(stillReview.authorization_granted,false);
});
