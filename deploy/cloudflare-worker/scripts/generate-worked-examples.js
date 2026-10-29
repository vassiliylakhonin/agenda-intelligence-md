import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {handleRequest} from '../src/index.js';
const profiles=['agenda','kazakhstan','cis_secondary_sanctions','agentic_interaction_trust','agent_output_verification','gulf_maritime_exposure','market_entry_readiness','critical_minerals_due_diligence','dual_use_technology_export','corridor_sanctions_assistant','agent_financial_guard','m2m_escrow_arbiter'];
const examples={};const log=console.log;console.log=()=>{};
for(const profile of profiles){
 const env={AGENT_PROFILE:profile,VIZIER_DISABLED:'1',LIVE_RETRIEVAL_ENABLED:'0'};
 const call=body=>handleRequest(new Request('https://example.test/mcp',{method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json','user-agent':'agenda-intelligence-fixture-generator/1.0'}}),env);
 const list=await (await call({jsonrpc:'2.0',id:1,method:'tools/list'})).json();
 const tool=list.result.tools.find(t=>!['fleet_directory','decision_policies_list','decision_verify','corridor_bankability_screen'].includes(t.name));
 const args=profile==='agent_output_verification'
  ? JSON.parse(fs.readFileSync(new URL('../../../examples/output-verification/request.json',import.meta.url),'utf8'))
  : tool._meta['com.agenda/readiness'].example_arguments;
 const response=await(await call({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:tool.name,arguments:args}})).json();
 if(response.error||response.result?.isError)throw Error('invalid fixture '+profile);
 examples[profile]={kind:'precomputed_synthetic_fixture',tool:tool.name,request:args,response:response.result.structuredContent?.metadata?.response || response.result.structuredContent};
 if(profile==='m2m_escrow_arbiter') {
  const tampered=structuredClone(args);(tampered.request || tampered).delivery_submission.artifact_data.records=2;
  const changed=await(await call({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:tool.name,arguments:tampered}})).json();
  if(changed.error||changed.result?.isError)throw Error('invalid tampered fixture '+profile);
  examples[profile].follow_up={kind:'precomputed_synthetic_tamper',label:'Changed artifact: hash mismatch, still human review',request:tampered,response:changed.result.structuredContent?.metadata?.response || changed.result.structuredContent};
 }
 if(profile==='agent_output_verification') {
  const corrected=structuredClone(args);corrected.claims=corrected.claims.filter(claim=>claim.claim_id!=='customer-count');
  const repair=await(await call({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:tool.name,arguments:corrected}})).json();
  if(repair.error||repair.result?.isError)throw Error('invalid corrected fixture '+profile);
  examples[profile].follow_up={kind:'precomputed_synthetic_correction',request:corrected,response:repair.result.structuredContent};
 }
 if(profile==='agentic_interaction_trust') {
  const filled=structuredClone(args), request=filled.request || filled;
  const missing=examples[profile].response.minimum_sources_before_action;
  request.dated_sources.push(...missing.map((source_type,i)=>({id:'fixture-'+i,source_type,title:'Synthetic fixture '+source_type,date:'2026-01-01'})));
  const checked=await(await call({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:tool.name,arguments:filled}})).json();
  if(checked.error||checked.result?.isError)throw Error('invalid placeholder fixture '+profile);
  examples[profile].follow_up={kind:'precomputed_synthetic_placeholders',label:'Adding fake records: gaps remain',request:filled,response:checked.result.structuredContent?.metadata?.response || checked.result.structuredContent};
 }
 if(profile==='kazakhstan') {
  const filled=structuredClone(args), request=filled.request || filled;
  const missing=examples[profile].response.minimum_sources_before_go;
  request.dated_sources.push(...missing.map((source_type,i)=>({id:'fixture-'+i,source_type,title:'Synthetic fixture '+source_type,date:'2026-01-01'})));
  const checked=await(await call({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:tool.name,arguments:filled}})).json();
  if(checked.error||checked.result?.isError)throw Error('invalid placeholder fixture '+profile);
  examples[profile].follow_up={kind:'precomputed_synthetic_placeholders',label:'Adding fake records: gaps remain',request:filled,response:checked.result.structuredContent?.metadata?.response || checked.result.structuredContent};
 }
 if(profile==='gulf_maritime_exposure') {
  const filled=structuredClone(args), request=filled.request || filled;
  const missing=examples[profile].response.minimum_sources_before_review;
  request.dated_sources.push(...missing.map((source_type,i)=>({id:'fixture-'+i,source_type,title:'Synthetic fixture '+source_type,date:'2026-01-01'})));
  const checked=await(await call({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:tool.name,arguments:filled}})).json();
  if(checked.error||checked.result?.isError)throw Error('invalid placeholder fixture '+profile);
  examples[profile].follow_up={kind:'precomputed_synthetic_placeholders',label:'Adding fake records: gaps remain',request:filled,response:checked.result.structuredContent?.metadata?.response || checked.result.structuredContent};
 }
 if(profile==='cis_secondary_sanctions') {
  const filled=structuredClone(args), request=filled.request || filled;
  const missing=examples[profile].response.minimum_sources_before_review;
  request.dated_sources.push(...missing.map((source_type,i)=>({id:'fixture-'+i,source_type,title:'Synthetic fixture '+source_type,date:'2026-01-01'})));
  const checked=await(await call({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:tool.name,arguments:filled}})).json();
  if(checked.error||checked.result?.isError)throw Error('invalid placeholder fixture '+profile);
  examples[profile].follow_up={kind:'precomputed_synthetic_placeholders',label:'Adding fake records: gaps remain',request:filled,response:checked.result.structuredContent?.metadata?.response || checked.result.structuredContent};
 }
}
console.log=log;
const target=fileURLToPath(new URL('../src/worked-examples.js',import.meta.url));
const content='// Generated locally from published synthetic MCP examples. No live upstream or payment.\nexport const WORKED_EXAMPLES = '+JSON.stringify(examples,null,2)+';\n';
if(process.argv.includes('--check')) {
 if(fs.readFileSync(target,'utf8')!==content) {
  console.error('Saved worked examples differ from actual handlers. Run node scripts/generate-worked-examples.js.');
  process.exitCode=1;
 } else console.log(Object.keys(examples).length+' worked examples match actual handlers');
} else {fs.writeFileSync(target,content);console.log(Object.keys(examples).length+' fixtures generated');}
