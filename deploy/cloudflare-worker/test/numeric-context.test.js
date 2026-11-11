import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewAnswer} from '../src/answer-review.js';
import {numericFactKeys} from '../src/numeric-context.js';

// Bounded numeric context diagnostics, including positive conversion controls.
// Mirrors tests/test_numeric_context_units.py for the hosted worker port.
const review = (claim, source, extra={}) =>
  reviewAnswer({answer: `${claim} [source]`, sources: [{source_id: 'source', text: source}], numeric_context_check: true, ...extra});

for (const [claim, source] of [
  ['The Hazel container weighs 1 kg.', 'The Hazel container weighs 1000 grams.'],
  ['The Orchid cable spans 2 km.', 'The Orchid cable spans 2000 meters.'],
  ['The Fern session lasts 2 hours.', 'The Fern session lasts 120 minutes.'],
  ['The Thorn dose is 3 grams.', 'The Thorn dose is 3000 milligrams.'],
  ['Груз Лилия весит 2 килограмма.', 'Груз Лилия весит 2000 граммов.'],
  ['The Ash balance is -62 dollars.', 'The Ash balance is negative 62 dollars.'],
]) {
  test(`supported dimensional conversion does not require revision: ${claim}`, () => {
    const result = review(claim, source);
    assert.equal(result.route, 'human_review');
    assert.equal(result.factuality, 'not_assessed');
    assert.equal(result.semantic_support, 'not_assessed');
    assert.equal(result.units[0].support_status, 'supported');
    assert.deepEqual(result.units[0].unmatched_numbers, []);
  });
}

for (const [claim, source] of [
  ['The Lotus crate weighs 72 kilograms.', 'The Lotus crate weighs 72 grams.'],
  ['The Lotus crate weighs 72 meters.', 'The Lotus crate weighs 72 grams.'],
  ['The Ash balance is positive 62 dollars.', 'The Ash balance is negative 62 dollars.'],
  ['The Oak session lasts 6 hours.', 'The Oak session lasts 6 minutes.'],
  ['The Olive branch employs 96 staff.', 'The Olive branch employs 48 staff. The Hawthorn branch employs 96 staff.'],
  ['The Olive branch employs 96 staff.', 'The Olive branch employs 48 staff and the Hawthorn branch employs 96 staff.'],
  ['The Olive branch employs 96 staff.', 'The Hawthorn branch employs 96 staff.'],
  ['The Olive branch employs 96 staff.', 'The Olive branch employs 48 staff and uses 96 desks.'],
]) {
  test(`wrong unit, sign, entity or attribute requires review: ${claim}`, () => {
    const result = review(claim, source);
    assert.equal(result.route, 'revise');
    assert.equal(result.units[0].support_status, 'contradicted');
    assert.ok(result.units[0].unmatched_numbers.length);
    assert.equal(result.findings[0].code, 'number_absent_from_cited_sources');
  });
}

test('explicit multiple claims keep their own numeric context', () => {
  const result = review(
    'The Olive branch employs 48 staff and the Hawthorn branch employs 96 staff.',
    'The Olive branch employs 48 staff. The Hawthorn branch employs 96 staff.',
  );
  assert.equal(result.route, 'human_review');
  assert.equal(result.units[0].support_status, 'supported');
});

test('measurement parser does not steal currency scales', () => {
  assert.deepEqual(numericFactKeys('-$5M'), numericFactKeys('-5000000 USD'));
  assert.deepEqual(numericFactKeys('5m USD'), numericFactKeys('5000000 USD'));
  assert.deepEqual(numericFactKeys('5 m'), numericFactKeys('500 cm'));
});

test('dates, percent and thousands separators canonicalize', () => {
  assert.deepEqual(numericFactKeys('closed on 2026-03-05'), numericFactKeys('closed on 05.03.2026'));
  assert.deepEqual(numericFactKeys('a 12 percent fee'), numericFactKeys('a 12% fee'));
  assert.deepEqual(numericFactKeys('12,000 grams'), numericFactKeys('12000 grams'));
  assert.deepEqual(numericFactKeys('1 200 boxes'), numericFactKeys('1200 boxes'));
  assert.notDeepEqual(numericFactKeys('8 percent'), numericFactKeys('8 dollars'));
});
