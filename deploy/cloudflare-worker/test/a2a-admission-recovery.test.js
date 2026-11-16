import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {handleRequest} from '../src/index.js';
const origin='https://example.test';
const profiles=[...fs.readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8').matchAll(/^AGENT_PROFILE = "(.*)"/gm)].map(m=>m[1]);
const env=profile=>({AGENT_PROFILE:profile,BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1'});
async function post(profile,body,headers={}) {
  const log=console.log; console.log=()=>{};
  try {
    const response=await handleRequest(new Request(origin+'/message/send',{method:'POST',headers:{'content-type':'application/json','a2a-version':'1.0',...headers},body:JSON.stringify(body)}),env(profile));
    const json=await response.json(); return {status:response.status,json,data:json.error?.data||json};
  } finally {console.log=log;}
}
const call=(capability,parts)=>({jsonrpc:'2.0',id:'test',method:'SendMessage',params:{capability,message:{messageId:'test',role:'ROLE_USER',parts}}});
for (const profile of profiles) {
  test(`${profile}: public card extension and refused-request examples pass input admission`,async()=>{
    const card=await (await handleRequest(new Request(origin+'/.well-known/agent-card.json'),env(profile))).json();
    const extension=card.capabilities.extensions.find(e=>e.params?.x_tool_contracts);
    assert.ok(extension,'discovery stays in the spec extension, not an extra root field');
    assert.equal(card.x_agenda_intelligence,undefined);
    const tools=extension.params.x_tool_contracts.a2a_examples.map(e=>({name:e.tool,a2a_example:e.request}));
    assert.ok(tools.length);
    for (const tool of tools) {
      const invalid=await post(profile,call(tool.name,[]));
      if (invalid.data.code!=='invalid_paid_request') continue;
      assert.equal(invalid.data.validation.category,'invalid_message');
      assert.equal(invalid.data.free_recheck.payment_required,false);
      assert.match(invalid.data.request_hint.documentation,/agent-contract.json$/);
      assert.equal(invalid.data.request_hint.example_is_synthetic,true);
      assert.deepEqual(invalid.json.self_correction,invalid.data.self_correction,'keep legacy aliases');
      const example=invalid.data.self_correction.minimal_valid_example;
      assert.ok(example);
      for (const body of [example,tool.a2a_example]) {
        const admitted=await post(profile,body,{'x-payment-tx':'0xdeadbeef'});
        assert.notEqual(admitted.data.code,'invalid_paid_request',`${profile}/${tool.name}: ${JSON.stringify(admitted.data.errors)}`);
        assert.ok(['invalid_payment_tx','payment_not_applicable'].includes(admitted.data.code),'synthetic payment grants no access: '+tool.name);
      }
    }
  });
}
test('bankability data and JSON text both use the same admission and execution input',async()=>{
  const input={project_name:'Synthetic Aktau project',corridor_leg:'Aktau-Baku',capex_usd_m:100,ifi_debt_usd_m:60,dscr_min:1.3};
  for (const part of [{data:input,mediaType:'application/json'},{text:JSON.stringify(input)}]) {
    const body=call('corridor_bankability_screen',[part]);
    const result=await post('agenda',body);
    assert.equal(result.status,200,'existing free preview is preserved');
    assert.equal(result.json.result.task.status.state,'TASK_STATE_COMPLETED');
    const refused=await post('agenda',body,{'x-payment-tx':'0xdeadbeef'});
    assert.equal(refused.data.code,'invalid_payment_tx');
  }
});
