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
 if(profile==='agent_output_verification') {
  const corrected=structuredClone(args);corrected.claims=corrected.claims.filter(claim=>claim.claim_id!=='customer-count');
  const repair=await(await call({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:tool.name,arguments:corrected}})).json();
  if(repair.error||repair.result?.isError)throw Error('invalid corrected fixture '+profile);
  examples[profile].follow_up={kind:'precomputed_synthetic_correction',request:corrected,response:repair.result.structuredContent};
 }
}
console.log=log;
fs.writeFileSync(fileURLToPath(new URL('../src/worked-examples.js',import.meta.url)),'// Generated locally from published synthetic MCP examples. No live upstream or payment.\nexport const WORKED_EXAMPLES = '+JSON.stringify(examples,null,2)+';\n');console.log(Object.keys(examples).length+' fixtures generated');
