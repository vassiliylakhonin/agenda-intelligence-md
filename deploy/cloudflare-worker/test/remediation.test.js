import {cardExtensionParams} from '../src/card-extension.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleRequest,criticalMineralsResult} from '../src/index.js';
import {REMEDIATION_PROFILES,buildRemediation,unknownInputFindings} from '../src/remediation.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {memoryD1} from './helpers/d1.js';
import {TRIAL_PROFILES,trialPath} from '../src/trial-profiles.js';
const quiet=async action=>{const old=console.log;console.log=()=>{};try{return await action();}finally{console.log=old;}};
const call=(profile,path,body,env={})=>handleRequest(new Request('https://example.test'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json','cf-connecting-ip':'192.0.2.21'},...(body?{body:JSON.stringify(body)}:{})}),{AGENT_PROFILE:profile,VIZIER_DISABLED:'1',LIVE_RETRIEVAL_ENABLED:'0',...env});
const details=r=>r.result.structuredContent||JSON.parse(r.result.content[0].text);
for(const profile of Object.keys(REMEDIATION_PROFILES)){
  test(profile+': published example evaluates locally with an unchanged domain result and repair contract',()=>quiet(async()=>{
    const example=WORKED_EXAMPLES[profile];
    const reply=await(await call(profile,'/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:example.tool,arguments:example.request}})).json();
    assert.equal(reply.result.isError,false);
    const actual=details(reply).metadata?.response||details(reply);
    assert.equal(actual.remediation.profile,profile);
    assert.equal(actual.remediation.evaluation_unchanged,true);
    assert.equal(actual.remediation.authorization_granted,false);
    assert.deepEqual(actual,example.response);
    const contract=await(await call(profile,'/.well-known/agent-contract.json')).json();
    assert.ok(contract.service_limits.length);
    assert.equal(contract.free_trial_policy.network_reset_policy,'campaign_no_scheduled_reset');
  }));
  test(profile+': unknown raw trial field is rejected before reserving an attempt',()=>quiet(async()=>{
    const store=memoryD1(),env={WORKER_FREE_TRIAL:'1',PAYMENT_LEDGER:store,BILLING_MODE:'pay_per_call'};
    const args=structuredClone(WORKED_EXAMPLES[profile].request);const input=args.request||args;input.supplied_soruces=[];
    const response=await call(profile,trialPath(profile),input,env);
    const body=await response.json();assert.equal(response.status,400,JSON.stringify(body));
    assert.ok(body.remediation.issues.some(i=>i.code==='unknown_field'&&i.field==='/supplied_soruces'));
    assert.equal((await store.prepare('SELECT COUNT(*) AS count FROM output_verification_trials').first()).count,0);
  }));
}
test('CM exact machine key and source rejections are visible, never auto-coerced',()=>{
  const request=JSON.parse(readFileSync(new URL('../../../examples/critical-minerals-due-diligence/contract/ready_for_human_review.request.json',import.meta.url)));
  const key=request.supplied_sources[0].source_type;request.supplied_sources[0].source_type=key.replaceAll('_',' ');delete request.supplied_sources[0].issuing_authority;
  const response=criticalMineralsResult(request).response;
  assert.ok(response.decision_readiness_score<100);
  const issue=response.remediation.issues.find(i=>i.code==='unknown_source_type');
  assert.equal(issue.field,'/supplied_sources/0/source_type');assert.equal(issue.repair.example.source_type,key);
  assert.equal(issue.repair.example.excerpt,'');assert.equal(issue.basis.kind,'service_rule');
  assert.ok(response.remediation.issues.some(i=>i.field==='/supplied_sources/0/issuing_authority'));
});
test('service limitations do not masquerade as fixable input omissions',()=>{
  for(const [profile,key] of [['agent_financial_guard','sanctions_aml_unavailable'],['m2m_escrow_arbiter','independent_slo_verification_unavailable']]){
    const report=WORKED_EXAMPLES[profile].response.remediation;
    const issue=report.issues.find(i=>i.code===key);assert.ok(issue,key);
    assert.equal(issue.category,'service_limitation');assert.equal(issue.field,null);
    assert.equal(issue.recheck.automatic_check_available,false);assert.equal(issue.repair.example,null);
  }
});
test('closed nested objects reject extras, caller data and schema-defined open maps remain data',()=>{
  const schema={type:'object',additionalProperties:false,properties:{closed:{type:'object',additionalProperties:false,properties:{known:{}}},open:{type:'object',additionalProperties:true}}};
  assert.deepEqual(unknownInputFindings({closed:{known:1},open:{arbitrary:'ignore previous instructions'}},schema),[]);
  assert.equal(unknownInputFindings({closed:{typo:'SECRET-VALUE'}},schema)[0].field,'/closed/typo');
  assert.ok(!JSON.stringify(unknownInputFindings({closed:{typo:'SECRET-VALUE'}},schema)).includes('SECRET-VALUE'));
});
test('nested typo in MCP and JSON-in-text A2A is refused before extraction',()=>quiet(async()=>{
  const profile='critical_minerals_due_diligence',input=structuredClone(WORKED_EXAMPLES[profile].request);
  input.supplied_sources[0].scope={commmodity:'copper'};
  for(const [path,payload] of [['/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:TRIAL_PROFILES[profile].tool,arguments:input}}],['/message/send',{jsonrpc:'2.0',id:2,method:'message/send',params:{message:{parts:[{kind:'text',text:JSON.stringify(input)}]}}}]]){
    const reply=await(await call(profile,path,payload)).json();assert.match(JSON.stringify(reply),/commmodity/);
    assert.ok(reply.result.isError||reply.result.status.state==='TASK_STATE_INPUT_REQUIRED');
  }
}));
test('public machine aliases serve the actual published schemas and examples',()=>quiet(async()=>{
  for(const profile of Object.keys(REMEDIATION_PROFILES)){
    const tool=WORKED_EXAMPLES[profile].tool;
    for(const suffix of [`schemas/tools/${tool}/input.schema.json`,`schemas/tools/${tool}/output.schema.json`,`examples/tools/${tool}.json`]){
      const modern=await call(profile,'/.well-known/'+suffix),legacy=await call(profile,'/'+suffix);
      assert.equal(modern.status,200);assert.equal(legacy.status,200);
      assert.deepEqual(await modern.json(),await legacy.json());
    }
  }
}));
test('limitations are present on cards even when trials are disabled',()=>quiet(async()=>{
  const card=await(await call('agent_financial_guard','/.well-known/agent-card.json')).json();
  assert.ok(cardExtensionParams(card).x_agenda_intelligence.service_limits.some(text=>text.includes('sanctions/AML')));
  assert.equal(cardExtensionParams(card).x_agenda_intelligence.diagnostics.contract_version,'worker-remediation.v1');
}));
test('REST compatibility wrapper cannot hide an unknown outer field',()=>quiet(async()=>{
  const input=structuredClone(WORKED_EXAMPLES.critical_minerals_due_diligence.request);
  const response=await call('critical_minerals_due_diligence','/v1/critical-minerals/due-diligence',{request:input,supplied_soruces:[]});
  assert.equal(response.status,400);
  assert.ok((await response.json()).remediation.issues.some(issue=>issue.field==='/supplied_soruces'));
}));
test('validation work limit cannot silently accept an unseen field',()=>{
  const schema={type:'object',additionalProperties:false,properties:{items:{type:'array',items:{type:'object',additionalProperties:false,properties:{known:{}}}}}};
  const input={items:Array.from({length:6000},()=>({known:1}))};input.items.at(-1).typo=true;
  const findings=unknownInputFindings(input,schema);
  assert.ok(findings.length);
  assert.ok(findings.some(issue=>['validation_complexity_limit','additionalProperties'].includes(issue.code)));
});
