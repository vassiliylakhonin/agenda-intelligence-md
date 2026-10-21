import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {handleRequest} from '../src/index.js';
import {prepareHandoff,projectHandoffValue,HANDOFF_CLIENT_SCRIPT} from '../src/handoff.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
const headers={'accept':'text/html','x-client-id':'agenda-owner-service-adoption'};
test('handoff copies known values without inventing fields or dropping adverse evidence inside records',()=>{
  const schema={type:'object',required:['subject','decision_stage'],properties:{subject:{type:'string'},decision_stage:{type:'string',enum:['review']},sources:{type:'array',items:{type:'object',properties:{id:{type:'string'},text:{type:'string'}}}}}};
  const input={subject:'Actual subject',decision_stage:'unsupported',secret:'never transfer',sources:[{id:'r1',text:'Ownership disputed'}]};
  const result=prepareHandoff(input,schema);
  assert.deepEqual(result.input,{subject:input.subject,sources:input.sources});
  assert.deepEqual(result.required_fields_to_complete,['decision_stage']);
  assert.ok(!JSON.stringify(result).includes('never transfer'));
  assert.deepEqual(prepareHandoff({...input,sources:[{...input.sources[0],unmapped_adverse_fact:'retain'}]},schema).input,{subject:input.subject});
  assert.throws(()=>prepareHandoff([],schema));assert.throws(()=>prepareHandoff({},{}));
  assert.equal(input.decision_stage,'unsupported');
});
test('browser handoff prepares only local JSON and a canonical link, without a fetch or storage',()=>{
  const elements=Object.fromEntries(['handoff-status','handoff-input','handoff-open','handoff-target','profile-request'].map(id=>[id,{}]));
  elements['handoff-target'].value='target';elements['profile-request'].value=JSON.stringify({subject:'Actual subject',secret:'private'});
  const context=vm.createContext({document:{getElementById:id=>elements[id]},agendaHandoffTargets:[{profile:'target',origin:'https://cis-secondary-sanctions.agendamcp.dpdns.org',schema:{type:'object',required:['subject','stage'],properties:{subject:{type:'string'},stage:{type:'string'}}}}]});
  vm.runInContext(projectHandoffValue.toString()+'\n'+prepareHandoff.toString()+'\n'+HANDOFF_CLIENT_SCRIPT,context);
  vm.runInContext('prepareSpecialistHandoff()',context);
  assert.deepEqual(JSON.parse(elements['handoff-input'].value),{subject:'Actual subject'});
  assert.match(elements['handoff-status'].textContent,/stage/);
  assert.equal(elements['handoff-open'].href,'https://cis-secondary-sanctions.agendamcp.dpdns.org/');
  assert.doesNotMatch(elements['handoff-open'].href,/Actual|private/);
  elements['profile-request'].value='{';vm.runInContext('prepareSpecialistHandoff()',context);
  assert.equal(elements['handoff-input'].hidden,true);assert.equal(elements['handoff-open'].hidden,true);
});
test('actual landing presents scoped services and free handoff; Minerals leads with document requests',async()=>{
  for(const profile of ['agenda','corridor_sanctions_assistant','critical_minerals_due_diligence','agent_output_verification']) {
    const html=await(await handleRequest(new Request('https://example.test/?owner_test=1',{headers}),{AGENT_PROFILE:profile,WORKER_FREE_TRIAL:'1'})).text();
    assert.match(html,/Project Document Desk/);assert.match(html,/Agent Workflow Acceptance/);
    assert.match(html,/written quote/);assert.match(html,/not validated customer outcomes/);
    if(['agenda','corridor_sanctions_assistant'].includes(profile)) {
      assert.match(html,/Prepare the next request/);assert.doesNotMatch(html,/>undefined<\/option>/);assert.match(html,/Required top-level fields/);
      assert.match(html,/subject|counterparty/);
    }
    if(profile==='critical_minerals_due_diligence') {
      assert.ok(html.indexOf('id="mineral-workflow"')<html.indexOf('id="profile-summary"'));
      assert.match(html,/Document request draft — review before sending/);
    }
  }
});
test('saved escrow demonstrates intact and changed content while retaining human review',()=>{
  const example=WORKED_EXAMPLES.m2m_escrow_arbiter;
  assert.equal(example.response.arbitration_ruling.check_status.hash,'passed');
  assert.equal(example.follow_up.response.arbitration_ruling.check_status.hash,'failed');
  assert.equal(example.response.arbitration_ruling.human_review_required,true);
  assert.equal(example.follow_up.response.arbitration_ruling.human_review_required,true);
});
