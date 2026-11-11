// Regression corpora (2026-11-09 sets) against the hosted worker's reviewAnswer.
// Usage: node evals/ov-numeric-context-2026-11-11/evaluate-regression.mjs <outname> [flag]
import {readFileSync, writeFileSync} from 'node:fs';
import {reviewAnswer} from '../../deploy/cloudflare-worker/src/answer-review.js';
const here = new URL('.', import.meta.url);
const prior = new URL('../ov-numeric-context-2026-11-09/', here);
const old56 = JSON.parse(readFileSync(new URL('regression-after.json', prior), 'utf8'))
  .map(x => ({id: x.id, group: x.group, expected: x.group === 'supported' ? 'supported' : 'unsupported',
    answer: x.result.answer_units.map(u => u.text).join('\n'), sources: x.result.packet.sources}));
const frozen32 = JSON.parse(readFileSync(new URL('validation.json', prior), 'utf8'))
  .map(x => ({id: x.id, group: 'frozen_validation', ...x}));
const out = process.argv[2] || 'rerun-regression';
const flag = process.argv[3] || 'numeric_context_check';
const run = cases => cases.map(x => {
  const result = reviewAnswer({answer: x.answer, sources: x.sources, [flag]: true});
  return {id: x.id, group: x.group, expected: x.expected, flagged: result.route === 'revise', findings: result.findings};
});
const results = {old56: run(old56), frozen32: run(frozen32)};
writeFileSync(new URL(`${out}.json`, here), JSON.stringify(results, null, 1) + '\n');
for (const [name, cases] of Object.entries(results)) {
  const by = {};
  for (const x of cases) {
    const key = `${x.group}/${x.expected}`;
    by[key] = by[key] || {n: 0, flagged: 0};
    by[key].n++; by[key].flagged += x.flagged ? 1 : 0;
  }
  console.log(out, name, JSON.stringify(by));
}
