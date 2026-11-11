import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest, agentCard} from '../src/index.js';
const req=path=>new Request('https://example.test'+path,{headers:{accept:'text/html'}});
test('OV advertises a separate numeric preflight, not a built-in fact check',async()=>{
  const env={AGENT_PROFILE:'agent_output_verification',WORKER_FREE_TRIAL:'1'};
  const card=agentCard(req('/'),env);
  assert.match(card.description,/separate opt-in Vizier/);
  const preflight=card.x_agenda_intelligence.numeric_preflight;
  assert.equal(preflight.endpoint,'https://vizier.agendamcp.dpdns.org/v1/numeric-consistency/scan');
  assert.match(preflight.review,/REVIEW \/ NUMERIC_INCONSISTENCY/);
  assert.match(preflight.scope,/not run by this worker/);
  assert.match(preflight.limit,/numeric_smoke_check only flags/);
  const html=await(await handleRequest(req('/'),env)).text();
  assert.match(html,/id="numeric-consistency"/);
  assert.match(html,/authority.constraints.numeric_consistency: true/);
  assert.match(html,/heuristic, not a fact check/);
  assert.match(html,/This page's citation and relay checks do not run it/);
  assert.match(html,/numeric_smoke_check/);
});
test('other profiles do not acquire numeric scan capability',async()=>{
  const env={AGENT_PROFILE:'cis_secondary_sanctions',WORKER_FREE_TRIAL:'1'};
  assert.equal(agentCard(req('/'),env).x_agenda_intelligence.numeric_preflight,undefined);
  assert.doesNotMatch(await(await handleRequest(req('/'),env)).text(),/id="numeric-consistency"/);
});
