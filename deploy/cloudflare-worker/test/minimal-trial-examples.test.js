import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../src/index.js';
import { validatePublishedInput } from '../src/input-validation.js';
import { TRIAL_PROFILES, trialPath } from '../src/trial-profiles.js';
import { cardExtensionParams } from '../src/card-extension.js';
import { validateAgentCard } from '../scripts/verify-agent-card.js';

const profiles = Object.entries(TRIAL_PROFILES);
const origin = 'https://example.test';

test('each fleet card and llms.txt publishes its schema-valid free-trial request example', async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    for (const [profile, trial] of profiles) {
      const env = { AGENT_PROFILE: profile, WORKER_FREE_TRIAL: '1', VIZIER_DISABLED: '1' };
      const cardResponse = await handleRequest(new Request(`${origin}/.well-known/agent-card.json`), env);
      const card = await cardResponse.json();
      assert.deepEqual(validateAgentCard(card, `${origin}/.well-known/agent-card.json`), [], `${profile}: valid AgentCard`);
      const extension = cardExtensionParams(card)?.x_agenda_intelligence;
      const example = extension?.free_trial_request_example;

      assert.equal(example.tool, trial.tool, `${profile}: example tool`);
      assert.equal(example.endpoint, `${origin}${trialPath(profile)}`, `${profile}: trial endpoint`);
      assert.equal(example.method, 'POST', `${profile}: method`);
      assert.equal(example.content_type, 'application/json', `${profile}: content type`);
      assert.equal(example.example_is_synthetic, true, `${profile}: synthetic marker`);
      assert.ok(example.request_body && typeof example.request_body === 'object', `${profile}: request body`);
      assert.equal(example.schema_url, example.endpoint, `${profile}: schema URL`);

      const validation = validatePublishedInput(profile, { tool: trial.tool, input: example.request_body }, true);
      assert.equal(validation.body.valid, true, `${profile}: example must pass the published input schema: ${JSON.stringify(validation.body.findings)}`);

      const termsResponse = await handleRequest(new Request(`${origin}${trialPath(profile)}`), env);
      const terms = await termsResponse.json();
      assert.deepEqual(example.request_body, terms.example_request, `${profile}: card must use the trial endpoint's canonical example`);

      const llmsResponse = await handleRequest(new Request(`${origin}/llms.txt`), env);
      const llms = await llmsResponse.text();
      assert.ok(llms.includes('## Minimal free-trial request example'), `${profile}: llms section`);
      assert.ok(llms.includes(`Tool: ${trial.tool}.`), `${profile}: llms tool`);
      assert.ok(llms.includes(JSON.stringify(example.request_body, null, 2)), `${profile}: llms request body`);
      assert.ok(llms.includes('This synthetic sample passes the published input schema'), `${profile}: llms caveat`);
    }
  } finally {
    console.log = originalLog;
  }
});
