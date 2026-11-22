import test from 'node:test';
import assert from 'node:assert/strict';
import { agentCard, toSpecWireCard, mcpServerCard } from '../src/index.js';
import { CARD_DESCRIPTIONS } from '../src/card-descriptions.js';
import { TRIAL_PROFILES } from '../src/trial-profiles.js';
import { routingToolForProfile } from '../src/pricing-policy.js';
import { validateAgentCard } from '../scripts/verify-agent-card.js';

const request = new Request('https://example.test/.well-known/agent-card.json');
for (const profile of Object.keys(TRIAL_PROFILES)) {
  test(`${profile}: trial summary follows the first task sentence only when enabled`, () => {
    const base = { AGENT_PROFILE: profile, BILLING_MODE: 'pay_per_call' };
    for (const enabled of [undefined, '0', '1']) {
      const env = { ...base, WORKER_FREE_TRIAL: enabled };
      const card = agentCard(request, env);
      const original = CARD_DESCRIPTIONS[profile];
      const first = original.slice(0, original.indexOf('. ') + 1);
      const rest = original.slice(first.length + 1);
      const advertised = enabled === '1' && !routingToolForProfile(profile);
      assert.equal(card.description.includes('No-wallet trial:'), advertised);
      if (advertised) {
        assert.ok(card.description.startsWith(first + ' No-wallet trial:'));
        assert.ok(card.description.endsWith(rest));
        assert.match(card.description, /MCP free_trial_status, then free_trial with its inputSchema arguments/);
        assert.match(card.description, /for A2A use x_agenda_intelligence\.a2a_free_trial/);
        assert.match(card.description, /Shared-network limits and configured authentication apply/);
      } else assert.equal(card.description, original);
      assert.equal(mcpServerCard(request, env).description, card.description);
      assert.deepEqual(validateAgentCard(toSpecWireCard(card)), []);
    }
  });
}

test('Output Verification legacy enable flag and configured Bearer stay honest', () => {
  const output = agentCard(request, { AGENT_PROFILE: 'agent_output_verification', OUTPUT_VERIFICATION_TRIAL: '1' });
  assert.match(output.description, /No-wallet trial:/);
  assert.match(output.description, /Not a fact check/);
  const cis = agentCard(request, { AGENT_PROFILE: 'cis_secondary_sanctions', WORKER_FREE_TRIAL: '1',
    CIS_SECONDARY_SANCTIONS_API_KEY: 'synthetic-test-key' });
  assert.match(cis.description, /configured authentication apply/);
  assert.equal(cis.x_agenda_intelligence.onboarding.authentication, 'bearer_required');
  assert.ok(cis.securityRequirements.length > 0);
  assert.doesNotMatch(cis.description, /no authentication|unlimited|daily reset|guaranteed/i);
});
