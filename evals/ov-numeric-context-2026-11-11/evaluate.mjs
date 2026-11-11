// Evaluate the hosted worker's reviewAnswer on this frozen set. No remote
// evaluation or model API is used.
// Usage: node evals/ov-numeric-context-2026-11-11/evaluate.mjs <outname> [flag]
// flag defaults to numeric_context_check; pass numeric_smoke_check to record
// the pre-port baseline behavior of the same frozen cases.
import {readFileSync, writeFileSync} from 'node:fs';
import {reviewAnswer} from '../../deploy/cloudflare-worker/src/answer-review.js';
const here = new URL('.', import.meta.url);
const cases = JSON.parse(readFileSync(new URL('validation.json', here), 'utf8'));
const out = process.argv[2] || 'rerun';
const flag = process.argv[3] || 'numeric_context_check';
const results = cases.map(x => {
  const result = reviewAnswer({answer: x.answer, sources: x.sources, [flag]: true});
  return {id: x.id, expected: x.expected, flagged: result.route === 'revise', findings: result.findings, units: result.units};
});
writeFileSync(new URL(`${out}.json`, here), JSON.stringify(results, null, 1) + '\n');
for (const label of ['supported', 'unsupported']) {
  const bucket = results.filter(x => x.expected === label);
  console.log(out, label, bucket.length, 'flagged', bucket.filter(x => x.flagged).length);
}
