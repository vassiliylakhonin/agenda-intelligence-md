import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {CIS_WIZARD_SCRIPT,cisWizardHtml} from '../src/cis-wizard.js';
import {cisReviewView,cisReviewViewHtml} from '../src/cis-review-view.js';
import {handleRequest} from '../src/index.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {parseCounterpartyCsv,prepareBatch,summarizeBatch} from '../../../examples/cis-secondary-sanctions/batch-helper.mjs';

const schema=JSON.parse(readFileSync(new URL('../../../schemas/v1/cis-secondary-sanctions-request.schema.json',import.meta.url),'utf8'));
const base={name:'Example Trading',jurisdiction:'Kazakhstan',sector:'',ownership:'',facets:['ownership_or_control'],scopes:[],sources:[],risk_question:'What is missing before review?',decision_stage:'onboarding'};
const request=()=>({counterparty:{name:base.name,jurisdiction:base.jurisdiction},exposure_facets:base.facets,dated_sources:[],risk_question:base.risk_question,decision_stage:base.decision_stage});
const environment={AGENT_PROFILE:'cis_secondary_sanctions',BILLING_MODE:'freemium',VIZIER_DISABLED:'1',SNAPSHOT_DISABLED:'1',OPENSANCTIONS_DISABLED:'1',GLEIF_DISABLED:'1'};
const quiet=async action=>{const old=console.log;console.log=()=>{};try{return await action();}finally{console.log=old;}};
async function call(name,args){return quiet(async()=>{const req=new Request('https://example.test/mcp',{method:'POST',headers:{'content-type':'application/json','x-client-id':'agenda-owner-cis-workflow-test'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});const data=await(await handleRequest(req,environment)).json();assert.equal(data.result.isError,false);return data.result.structuredContent;});}

class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.value='';this.style={};this.textContent='';this.hidden=false;this.checked=false;}
  setAttribute(key,value){this.attributes[key]=value;} getAttribute(key){return this.attributes[key];}
  appendChild(element){element.parent=this;this.children.push(element);return element;}
  remove(){this.parent.children=this.parent.children.filter(item=>item!==this);} scrollIntoView(){}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(selector==='[data-field]'&&child.attributes['data-field']||selector==='input'&&child.tag==='input'?[child]:[]),...child.querySelectorAll(selector)]);}
}

test('actual wizard prepares single and batch requests without network or guessed sources',async()=>{
  const ids=['cis-wizard','cis-facets','cis-scopes','cis-sources','cis-add-source','cis-next-1','cis-next-2','cis-step-2','cis-step-3','cis-prepare','cis-name','cis-jurisdiction','cis-sector','cis-ownership','cis-question','cis-stage','cis-status','cis-batch-prepare','cis-batch-file','cis-batch-status','cis-batch-output','profile-request','profile-intake','profile-console'];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element('div')]));let updates=0;elements['profile-intake'].updateFromJson=()=>updates++;
  const context={document:{getElementById:id=>elements[id],createElement:tag=>new Element(tag)},parseCounterpartyCsv,prepareBatch};
  vm.runInNewContext(CIS_WIZARD_SCRIPT,context);context.mountCisWizard(schema);
  elements['cis-name'].value=base.name;elements['cis-jurisdiction'].value=base.jurisdiction;elements['cis-stage'].value=base.decision_stage;elements['cis-question'].value=base.risk_question;
  elements['cis-facets'].querySelectorAll('input').find(field=>field.value==='ownership_or_control').checked=true;
  elements['cis-prepare'].onclick();const result=JSON.parse(elements['profile-request'].value);
  assert.deepEqual(result.dated_sources,[]);assert.deepEqual(result.exposure_facets,['ownership_or_control']);assert.equal(updates,1);
  assert.match(elements['cis-status'].textContent,/No evaluation or upload occurred/);
  elements['cis-add-source'].onclick();const fields=Object.fromEntries(elements['cis-sources'].children[0].querySelectorAll('[data-field]').map(field=>[field.getAttribute('data-field'),field]));
  fields.id.value='s1';fields.source_type.value='ownership_chain_evidence';fields.title.value='Actual record';fields.date.value='2026-01-20';
  elements['cis-prepare'].onclick();assert.equal(JSON.parse(elements['profile-request'].value).dated_sources[0].title,'Actual record');
  fields.date.value='bad';const previous=elements['profile-request'].value;elements['cis-prepare'].onclick();
  assert.equal(elements['profile-request'].value,previous);assert.match(elements['cis-status'].textContent,/No request was sent/);
  elements['cis-batch-file'].files=[{name:'case.csv',size:40,text:async()=> 'name,jurisdiction\nEntity A,Kazakhstan\n'}];
  await elements['cis-batch-prepare'].onclick();
  const batch=JSON.parse(elements['cis-batch-output'].value);assert.equal(batch.requests[0].counterparty.name,'Entity A');
  assert.deepEqual(batch.requests[0].dated_sources,[]);assert.match(elements['cis-batch-status'].textContent,/No evaluation or upload occurred/);
  elements['cis-batch-file'].files=[{name:'case.json',size:30,text:async()=> '[{"name":"Entity B","jurisdiction":"Georgia"}]'}];
  await elements['cis-batch-prepare'].onclick();assert.equal(JSON.parse(elements['cis-batch-output'].value).requests[0].counterparty.name,'Entity B');
  const retained=elements['cis-batch-output'].value;let complete;
  elements['cis-batch-file'].files=[{name:'slow.csv',size:30,text:()=>new Promise(resolve=>{complete=resolve;})}];
  const pending=elements['cis-batch-prepare'].onclick();elements['cis-stage'].value='pre_transaction';complete('name,jurisdiction\nEntity C,Georgia');await pending;
  assert.equal(elements['cis-batch-output'].value,retained);assert.match(elements['cis-batch-status'].textContent,/settings changed/);
});

test('wizard keeps missing evidence missing and requires explicit facets',()=>{
  const context={};vm.runInNewContext(CIS_WIZARD_SCRIPT,context);
  const prepared=JSON.parse(JSON.stringify(context.cisAssemble(base,schema)));
  assert.deepEqual(prepared.dated_sources,[]);assert.deepEqual(prepared.exposure_facets,['ownership_or_control']);
  assert.deepEqual(prepared.counterparty,{name:base.name,jurisdiction:base.jurisdiction});assert.ok(!Object.hasOwn(prepared,'jurisdiction_review_scope'));
  const exact={...base,ownership:'Parent A\nUnknown owner',scopes:['ofac','eu'],sources:[{id:'s1',source_type:'ownership_chain_evidence',title:'Existing extract',date:'2026-01-20'}]};
  const result=JSON.parse(JSON.stringify(context.cisAssemble(exact,schema)));
  assert.deepEqual(result.counterparty.ownership_layers,['Parent A','Unknown owner']);assert.equal(result.dated_sources[0].title,'Existing extract');
  for(const bad of [{...base,facets:[]},{...base,facets:['invented']},{...base,scopes:['invented']},{...base,sources:[{id:'x',source_type:'ofac_sdn_extract',title:'record',date:'2026-02-30'}]}]) assert.throws(()=>context.cisAssemble(bad,schema));
  assert.match(cisWizardHtml(schema),/no files are uploaded or fetched/i);
});

test('view makes requested scope explicitly unassessed, reports only actual screening and handles untrusted text',async()=>{
  const req={...request(),jurisdiction_review_scope:['ofac','eu']},response=await call('cis_secondary_sanctions_exposure',req);
  const before=JSON.stringify(response),view=cisReviewView(req,response);
  assert.deepEqual(view.scopes,['ofac','eu']);assert.equal(view.screening_status,'not_assessed');assert.equal(view.match_count,null);
  assert.equal(view.actions[0].owner,'Sanctions / compliance reviewer');
  assert.equal(view.next_one_thing,view.actions[0].action);
  const escape=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const html=cisReviewViewHtml({...req,jurisdiction_review_scope:['<script>bad</script>']},response,escape);
  assert.match(html,/Not assessed/);assert.ok(!html.includes('<script>bad</script>'));assert.match(html,/not assess legal applicability/i);
  assert.equal(JSON.stringify(response),before);assert.equal(cisReviewView(req,{error:'offline'}),null);
  const dual=cisReviewView(req,{...response,exposure_facets:['ict_or_dual_use_goods'],supplied_sources:[]});
  assert.ok(dual.actions.some(action=>action.source_type==='dual_use_export_evidence'));
  const enriched={...response,screening_assessment:{status:'name_screen_only',freshness:'fresh',name_matches:2},
    live_retrieval_status:'static_snapshot',auto_fetched_sources:[{source_type:'ofac_sdn_extract',title:'Possible <script>match</script>'}]};
  const display=cisReviewViewHtml(req,enriched,escape);assert.match(display,/possible matches: 2/);assert.ok(!display.includes('<script>match</script>'));
  assert.match(display,/not identity verification/);
  assert.match(cisReviewViewHtml(req,{...response,auto_fetched_sources:[]},escape),/does not distinguish disabled/);
});

test('CSV preparation is local, explicit, bounded and does not fabricate evidence',()=>{
  const parsed=parseCounterpartyCsv('name,jurisdiction\r\n"Example, LLC",Kazakhstan\r\n"Another ""LLC""",Georgia\r\n');
  assert.deepEqual(parsed,[{name:'Example, LLC',jurisdiction:'Kazakhstan'},{name:'Another "LLC"',jurisdiction:'Georgia'}]);
  const batch=prepareBatch(parsed,{facets:['ownership_or_control'],decisionStage:'onboarding',riskQuestion:'What remains?'});
  assert.equal(batch.requests.length,2);assert.deepEqual(batch.requests[0].dated_sources,[]);
  for(const facet of schema.$defs.exposure_facet.enum) assert.equal(prepareBatch(parsed,{facets:[facet],decisionStage:'onboarding',riskQuestion:'Review'}).requests.length,2);
  for(const stage of schema.properties.decision_stage.enum) assert.equal(prepareBatch(parsed,{facets:['other'],decisionStage:stage,riskQuestion:'Review'}).requests.length,2);
  for(const scope of schema.properties.jurisdiction_review_scope.items.enum) assert.deepEqual(prepareBatch(parsed,{facets:['other'],decisionStage:'other',riskQuestion:'Review',scopes:[scope]}).requests[0].jurisdiction_review_scope,[scope]);
  for(const bad of ['name,jurisdiction,extra\nA,KZ,x','name,jurisdiction\n"unclosed,KZ','name,jurisdiction\nA','name,jurisdiction\n'+Array(11).fill('A,KZ').join('\n')]) assert.throws(()=>parseCounterpartyCsv(bad));
  assert.throws(()=>prepareBatch(parsed,{facets:[],decisionStage:'onboarding',riskQuestion:'What remains?'}));
});

test('batch projection keeps unresolved and unknown entries ahead of known low signals',()=>{
  const item=(index,signal)=>({index,status:'completed',counterparty:{name:'Entity '+index,jurisdiction:'Kazakhstan'},response:{counterparty:{name:'Entity '+index,jurisdiction:'Kazakhstan'},secondary_exposure_signal:signal,human_review_required:true,authorization_granted:false,evidence_gaps:['Review source']}});
  const batch={batch_id:'demo',total:4,completed:3,failed:1,human_review_required:true,authorization_granted:false,results:[item(0,'low'),item(1,'high'),{index:2,status:'invalid_request'},item(3,'unknown')]};
  const result=summarizeBatch(batch);assert.deepEqual(result.items.map(x=>x.index),[2,3,1,0]);assert.equal(result.items[0].status,'unresolved');
  assert.ok(result.items.every(x=>x.authorization_granted===false));
  assert.throws(()=>summarizeBatch({...batch,completed:4,failed:0,results:[item(0,'low'),item(0,'high'),item(2,'low'),item(3,'low')]}));
  assert.throws(()=>summarizeBatch({...batch,authorization_granted:true}));
});

test('prepared batch reaches real local batch handler without live retrieval or authorization',async()=>{
  const batch=prepareBatch([{name:'Sample A',jurisdiction:'Kazakhstan'},{name:'Sample B',jurisdiction:'Georgia'}],{facets:['ownership_or_control'],decisionStage:'onboarding',riskQuestion:'What evidence is missing?'});
  const actual=await call('cis_secondary_sanctions_batch',batch);
  assert.equal(actual.total,2);assert.equal(actual.completed,2);assert.equal(actual.human_review_required,true);
  const summary=summarizeBatch(actual);assert.equal(summary.items.length,2);assert.ok(summary.items.every(row=>row.authorization_granted===false));
});

test('trial page exposes wizard, five source categories and batch admission boundary',async()=>quiet(async()=>{
  const req=new Request('https://example.test/',{headers:{accept:'text/html','x-client-id':'agenda-owner-cis-page-test'}});
  const html=await(await handleRequest(req,{...environment,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'})).text();
  for(const text of ['id="cis-wizard"','ownership chain evidence','bank correspondent evidence','single-case free trial does not cover it','id="cis-review-view"','Adding fake records: gaps remain']) assert.ok(html.includes(text),text);
  const fixture=WORKED_EXAMPLES.cis_secondary_sanctions;
  assert.equal(fixture.follow_up.kind,'precomputed_synthetic_placeholders');
  assert.deepEqual(fixture.follow_up.response.minimum_sources_before_review,fixture.response.minimum_sources_before_review);
  assert.ok(fixture.follow_up.response.source_record_review.issues.length>=fixture.response.minimum_sources_before_review.length);
  assert.equal(fixture.follow_up.response.authorization_granted,false);
}));

test('bundled Worker exposes CIS view functions without missing browser helpers',async()=>quiet(async()=>{
  const built=await build({entryPoints:[new URL('../src/index.js',import.meta.url).pathname],bundle:true,keepNames:true,platform:'neutral',format:'esm',write:false});
  const bundled=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  const html=await(await bundled.handleRequest(new Request('https://example.test/',{headers:{accept:'text/html'}}),{...environment,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'})).text();
  const box={value:'{}'};const context={URL,TextEncoder,window:{location:{href:'https://example.test/',origin:'https://example.test'},crypto:globalThis.crypto},crypto:globalThis.crypto,
    document:{getElementById:id=>id==='profile-request'?box:null,createElement:()=>({set textContent(x){this.innerHTML=String(x);}})}};
  vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],context);
  const result=await call('cis_secondary_sanctions_exposure',request());
  assert.match(context.cisReviewViewHtml({...request(),jurisdiction_review_scope:['ofac']},result,String),/Not assessed/);
  const rows=context.parseCounterpartyCsv('name,jurisdiction\nEntity,Kazakhstan\n');
  const batch=context.prepareBatch(rows,{facets:['ownership_or_control'],decisionStage:'onboarding',riskQuestion:'Review'});
  assert.equal(batch.requests[0].counterparty.name,'Entity');assert.equal(batch.requests[0].dated_sources.length,0);
}));
