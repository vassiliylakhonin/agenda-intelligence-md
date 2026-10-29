import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {handleRequest} from '../src/index.js';
import {GULF_WIZARD_SCRIPT,gulfGateHtml} from '../src/gulf-wizard.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
const schema=JSON.parse(readFileSync(new URL('../../../schemas/v1/gulf-maritime-exposure-request.schema.json',import.meta.url),'utf8'));
const env={AGENT_PROFILE:'gulf_maritime_exposure',BILLING_MODE:'freemium',MARITIME_VIZIER_DISABLED:'1'};
const sourceTypes=['vessel_registry_extract','pi_insurance_certificate','ownership_or_control_evidence','sanctions_list_extract','ais_track_record'];
const request={vessel:{name:'Review Vessel',flag:'Panama',mmsi:'123456789'},voyage:{chokepoint:'strait_of_hormuz'},counterparties:[{role:'insurer_or_pi_club',name:'Declared Club'}],exposure_facets:['ownership_or_control'],decision_stage:'pre_fixture',dated_sources:sourceTypes.map((source_type,i)=>({id:'s'+i,source_type,title:source_type,date:'2026-05-28'})),risk_question:'What is missing?'};
async function call(input){const old=console.log;console.log=()=>{};try{const req=new Request('https://example.test/mcp',{method:'POST',headers:{'content-type':'application/json','x-client-id':'agenda-owner-gulf-test'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'gulf_maritime_exposure',arguments:input}})});const body=await(await handleRequest(req,env)).json();assert.equal(body.result.isError,false,JSON.stringify(body));return body.result.structuredContent.metadata?.response || body.result.structuredContent;}finally{console.log=old;}}
test('hosted gate blocks unknown cover and STS gaps even with all baseline references',async()=>{
 const input=structuredClone(request);input.counterparties[0].name='Unknown';input.exposure_facets=['sts_transfer'];
 const response=await call(input);assert.equal(response.voyage_gate.verdict,'BLOCK_PRE_FIXTURE');assert.deepEqual(response.voyage_gate.blocking_reasons,['P_AND_I_UNKNOWN','STS_WITHOUT_HISTORY']);assert.equal(response.voyage_gate.ais_quality,'not_assessed');assert.ok(response.decision_readiness_score<=49);assert.equal(response.triage_recommendation,'escalate_before_fixture');assert.equal(response.authorization_granted,false);assert.match(response.evidence_gaps[0],/unknown/i);
 input.counterparties[0].name='Declared Club';input.dated_sources.push({id:'sts',source_type:'sts_transfer_evidence',title:'Transfer record',date:'2026-05-28'});const next=await call(input);assert.equal(next.voyage_gate.verdict,'HUMAN_REVIEW_REQUIRED');assert.equal(next.human_review_required,true);assert.equal(next.authorization_granted,false);
});
test('AIS-only and fake evidence cannot turn a thin file into a pass',async()=>{
 const input=structuredClone(request);input.dated_sources=input.dated_sources.filter(x=>x.source_type==='ais_track_record');input.counterparties=[];const before=await call(input);assert.ok(before.voyage_gate.blocking_reasons.includes('AIS_ONLY_FILE'));
 input.dated_sources.push(...sourceTypes.filter(x=>x!=='ais_track_record').map((source_type,i)=>({id:'fake'+i,source_type,title:'Synthetic demo evidence',date:'2026-05-28'})));const after=await call(input);assert.deepEqual(after.minimum_sources_before_review,before.minimum_sources_before_review);assert.equal(after.voyage_gate.verdict,'BLOCK_PRE_FIXTURE');
 assert.equal(WORKED_EXAMPLES.gulf_maritime_exposure.follow_up.response.authorization_granted,false);assert.ok(WORKED_EXAMPLES.gulf_maritime_exposure.follow_up.response.minimum_sources_before_review.length);
});
test('wizard preserves unknowns and requires explicit references without sending requests',()=>{
 const ctx={};vm.runInNewContext(GULF_WIZARD_SCRIPT,ctx);const value={name:'',imo:'',mmsi:'123456789',flag:'',vessel_type:'',origin:'',destination:'',cargo:'',insurer:'',chokepoint:'strait_of_hormuz',stage:'pre_fixture',question:'What is missing?',facets:['sts_transfer'],sources:[]};
 const output=JSON.parse(JSON.stringify(ctx.gulfAssemble(value,schema)));assert.deepEqual(output.vessel,{mmsi:'123456789'});assert.deepEqual(output.dated_sources,[]);assert.equal(output.counterparties,undefined);
 assert.throws(()=>ctx.gulfAssemble({...value,facets:[]},schema));assert.throws(()=>ctx.gulfAssemble({...value,sources:[{id:'x',source_type:'ais_track_record',title:'x',date:'2026-02-30'}]},schema));
 const html=gulfGateHtml({voyage_gate:{verdict:'<img>',readiness_level:'internal_review',ais_quality:'not_assessed',blocking_reasons:['<script>'],notice:'<bad>'}},x=>String(x).replaceAll('<','&lt;').replaceAll('>','&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
test('public landing includes voyage form, document checklist, and honest AIS boundary',async()=>{
 const old=console.log;console.log=()=>{};try{const response=await handleRequest(new Request('https://gulf-maritime-exposure.agendamcp.dpdns.org/',{headers:{accept:'text/html'}}),{...env,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'});const html=await response.text();for(const text of ['id="gulf-wizard"','id="gulf-imo"','id="gulf-mmsi"','id="gulf-review-view"','AIS quality is not assessed','Gulf of Oman STS'])assert.ok(html.includes(text),text);}finally{console.log=old;}
});

test('bundled Worker page initializes browser helpers and prepares a voyage without sending',async()=>{
 const {build}=await import('esbuild');
 const built=await build({entryPoints:[new URL('../src/index.js',import.meta.url).pathname],bundle:true,keepNames:true,platform:'neutral',format:'esm',write:false});
 const bundled=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 const old=console.log;console.log=()=>{};
 try{
  const html=await(await bundled.handleRequest(new Request('https://example.test/',{headers:{accept:'text/html'}}),{...env,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'})).text();
  const box={value:'{}'},context={URL,TextEncoder,window:{location:{href:'https://example.test/',origin:'https://example.test'},crypto:globalThis.crypto},crypto:globalThis.crypto,document:{getElementById:id=>id==='profile-request'?box:null,createElement:()=>({set textContent(x){this.innerHTML=String(x);}})}};
  vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],context);
  const input={name:'',imo:'1234567',mmsi:'',flag:'',vessel_type:'',origin:'',destination:'',cargo:'',insurer:'',chokepoint:'red_sea',stage:'pre_fixture',question:'Review voyage',facets:['chokepoint_disruption'],sources:[]};
  const value=context.gulfAssemble(input,schema);assert.equal(value.vessel.imo,'1234567');assert.equal(value.dated_sources.length,0);
  const output=context.gulfGateHtml({voyage_gate:{verdict:'BLOCK_PRE_FIXTURE',readiness_level:'screening_only',ais_quality:'not_assessed',blocking_reasons:['P_AND_I_UNKNOWN'],notice:'Human review'}},String);assert.match(output,/P_AND_I_UNKNOWN/);
 }finally{console.log=old;}
});

test('voyage form populates the existing request editor locally',()=>{
 class Element{constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.value='';this.style={};this.textContent='';this.checked=false;}setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}appendChild(e){this.children.push(e);e.parent=this;return e;}remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}scrollIntoView(){}querySelectorAll(selector){return this.children.flatMap(x=>[...(selector==='input'&&x.tag==='input'||selector==='[data-field]'&&x.attributes['data-field']?[x]:[]),...x.querySelectorAll(selector)]);}}
 const ids=['gulf-wizard','gulf-facets','gulf-add-source','gulf-sources','gulf-prepare','gulf-status','profile-request','profile-intake','profile-console',...['name','imo','mmsi','flag','vessel_type','origin','destination','cargo','insurer','chokepoint','stage','question'].map(k=>'gulf-'+k)];
 const elements=Object.fromEntries(ids.map(id=>[id,new Element('div')]));let updates=0;elements['profile-intake'].updateFromJson=()=>updates++;
 const context={document:{getElementById:id=>elements[id],createElement:tag=>new Element(tag)}};vm.runInNewContext(GULF_WIZARD_SCRIPT,context);context.mountGulfWizard(schema);
 elements['gulf-imo'].value='1234567';elements['gulf-chokepoint'].value='red_sea';elements['gulf-stage'].value='pre_fixture';elements['gulf-question'].value='Review before fixture';elements['gulf-facets'].querySelectorAll('input')[0].checked=true;
 elements['gulf-prepare'].onclick();const input=JSON.parse(elements['profile-request'].value);assert.equal(input.vessel.imo,'1234567');assert.deepEqual(input.dated_sources,[]);assert.equal(updates,1);assert.match(elements['gulf-status'].textContent,/No evaluation/);
 const previous=elements['profile-request'].value;elements['gulf-question'].value='';elements['gulf-prepare'].onclick();assert.equal(elements['profile-request'].value,previous);assert.match(elements['gulf-status'].textContent,/No request was sent/);
});
