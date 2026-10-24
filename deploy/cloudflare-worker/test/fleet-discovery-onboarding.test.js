import {routingToolForProfile} from '../src/pricing-policy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { agentCard, handleRequest, toSpecWireCard } from '../src/index.js';
import { validateAgentCard } from '../scripts/verify-agent-card.js';
import { PROFILE_TASKS } from '../src/agent-onboarding.js';
import { TRIAL_PROFILES } from '../src/trial-profiles.js';

const origin = 'https://example.test';
test('task-first cards expose only enabled trials and stay valid A2A cards', () => {
  const starts = new Set();
  for (const profile of Object.keys(TRIAL_PROFILES)) {
    const env = { AGENT_PROFILE: profile, BILLING_MODE: 'pay_per_call', WORKER_FREE_TRIAL: '1' };
    const card = agentCard(new Request(origin), env);
    const plan = card.x_agenda_intelligence.onboarding;
    starts.add(card.description.split('.')[0]);
    assert.ok(card.description.startsWith(PROFILE_TASKS[profile]), profile);
    assert.deepEqual(validateAgentCard(toSpecWireCard(card)), [], profile);
    assert.equal(plan.first_evaluation.tool, TRIAL_PROFILES[profile].tool);
    assert.equal(plan.first_evaluation.attempts_per_network, profile === 'agent_output_verification' ? 5 : 2);
    if (routingToolForProfile(profile)) {
      assert.match(card.description,/free/);
      assert.equal(plan.first_call.tool,routingToolForProfile(profile));
      assert.equal(plan.first_call.trial_attempt_consumed,false);
    } else assert.match(card.description, /free live attempts on your own input/);
    assert.doesNotMatch(card.x_agenda_intelligence.free_a2a_triage.scope, /heartbeat only/);
    const disabled = agentCard(new Request(origin), {...env, WORKER_FREE_TRIAL: '0'});
    assert.equal(disabled.x_agenda_intelligence.onboarding.first_evaluation, undefined);
    assert.doesNotMatch(disabled.description, /free live attempts/);
  }
  assert.equal(starts.size, Object.keys(TRIAL_PROFILES).length);
});

test('configured Bearer remains required by the advertised first evaluation', async () => {
  const env = { AGENT_PROFILE: 'cis_secondary_sanctions', WORKER_FREE_TRIAL: '1',
    BILLING_MODE: 'pay_per_call', CIS_SECONDARY_SANCTIONS_API_KEY: 'synthetic-private-key' };
  const plan = agentCard(new Request(origin), env).x_agenda_intelligence.onboarding;
  assert.equal(plan.authentication, 'bearer_required');
  for (const [url, options] of [[plan.first_evaluation.url, {method:'POST', body:'{}'}],
    [plan.first_evaluation.availability_url, {}]]) {
    assert.equal((await handleRequest(new Request(url, options), env)).status, 401);
  }
});

test('MCP clients learn the trial body format, selected tool and correct docs', async () => {
  const env = { AGENT_PROFILE:'dual_use_technology_export', BILLING_MODE:'pay_per_call', WORKER_FREE_TRIAL:'1' };
  const response = await handleRequest(new Request(origin+'/mcp/agent', {method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}), env);
  const tools = (await response.json()).result.tools;
  assert.match(tools[0].description, /GET that URL for input_schema and example_request/);
  assert.match(tools[0].description, /not an MCP\/A2A envelope/);
  const server = await (await handleRequest(new Request(origin+'/.well-known/mcp/server-card.json'),env)).json();
  assert.ok(server.description.startsWith(PROFILE_TASKS.dual_use_technology_export));
  assert.equal(server.onboarding.first_evaluation.tool, 'dual_use_technology_export');
  const fleet = await (await handleRequest(new Request(origin+'/.well-known/fleet.json'),env)).json();
  const gate = fleet.gates.find(gate=>gate.profile==='dual_use_technology_export');
  assert.match(gate.documentation_url, /use-cases\/dual-use-technology-export.md$/);
  assert.equal(gate.workflow, 'trade-and-project-evidence');
});
