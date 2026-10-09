import test from 'node:test';
import assert from 'node:assert/strict';
import { trialFeedbackMailto } from '../src/trial-feedback.js';

test('feedback drafts include only product, bounded status and unanswered questions', () => {
  const link = trialFeedbackMailto('cis_secondary_sanctions', 200, 'support@example.test');
  const url = new URL(link);
  const body = url.searchParams.get('body');
  assert.equal(url.protocol, 'mailto:');
  assert.match(body, /Product: cis_secondary_sanctions/);
  assert.match(body, /Check: Completed/);
  assert.match(body, /What was missing or confusing/);
  assert.match(body, /Useful next step: Not answered/);
  const escrow = new URL(trialFeedbackMailto('m2m_escrow_arbiter', null, 'support@example.test'));
  assert.equal(escrow.searchParams.get('subject'), 'Trial feedback: m2m_escrow_arbiter');
  assert.match(escrow.searchParams.get('body'), /Product: m2m_escrow_arbiter/);
  assert.match(decodeURIComponent(trialFeedbackMailto('agenda', 200, 'support@example.test', 'useful_next_step')), /Useful next step: Useful next step/);
  assert.match(decodeURIComponent(trialFeedbackMailto('agenda', 200, 'support@example.test', 'still_blocked')), /Useful next step: Still blocked/);
  assert.match(trialFeedbackMailto('agenda', 429, 'support@example.test'), /Allowance%20reached/);
  const unsafe = decodeURIComponent(trialFeedbackMailto('bad\nprivate-input', 'secret-error', 'support@example.test'));
  assert.ok(!unsafe.includes('private-input'));
  assert.ok(!unsafe.includes('secret-error'));
  assert.ok(!unsafe.includes('Yes'));
});
