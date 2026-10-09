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
  assert.match(body, /Would you use this again/);
  assert.match(trialFeedbackMailto('agenda', 429, 'support@example.test'), /Allowance%20reached/);
  const unsafe = decodeURIComponent(trialFeedbackMailto('bad\nprivate-input', 'secret-error', 'support@example.test'));
  assert.ok(!unsafe.includes('private-input'));
  assert.ok(!unsafe.includes('secret-error'));
  assert.ok(!unsafe.includes('Yes'));
});
