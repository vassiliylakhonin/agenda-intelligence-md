# Hosted-worker numeric-context evaluation, 2026-11-11

Fresh evaluator-authored synthetic validation: 32 cases frozen before the hosted worker port was written, SHA256 in VALIDATION-FREEZE.txt. Labels were not changed after results. Source was inspected before case authorship, so this is not a blind independent evaluation, real user evidence, or demand validation. The 2026-11-09 sets (56 old + 32 frozen) are regression here.

| Hosted worker review_answer (numeric check on) | Before (literal smoke) | Candidate (numeric context) |
| --- | --- | --- |
| New validation: unsupported claims flagged | 6/16 | 16/16 |
| New validation: supported claims falsely held | 9/16 | 1/16 |
| Old regression: semantic errors flagged | 3/24 | 9/24 |
| Old regression: supported answers falsely held | 1/16 | 0/16 |
| Old regression: structural errors flagged | 12/12 | 12/12 |
| 2026-11-09 frozen: unsupported claims flagged | 1/16 | 15/16 |
| 2026-11-09 frozen: supported claims falsely held | 7/16 | 0/16 |

The remaining fresh-set false hold is `W_good_two_cited_lines`: the claim says "The Birch kiln", the source's second sentence says only "The kiln", and the bounded `the Name` anchor heuristic conservatively skips that sentence; the Python `review_rag_answer` produces the identical verdict and unmatched numbers on this input. The remaining 2026-11-09 frozen miss is `V_bad_modal_boundary` (`may reopen` changed to `will reopen`): modal wording is not numeric and is out of scope. Missed semantic categories that are not numeric (negation, cause, comparison, role, scope, exception) remain unassessed by the worker; the numeric check does not compare wording. No tuning was done after the first candidate validation run.

Changes are bounded: the worker's review_answer replaces the literal-token numeric_smoke_check with a port of the Python numeric-context pipeline (canonical mass/length/time units, scales, currencies, dates, negative wording, closest number-bearing sentence/clause matching with `the Name` anchors). numeric_smoke_check remains as a deprecated alias. Per-line citation_status, source_status and support_status (supported/contradicted/unknown; default unknown; never a clearance) are additive. Route, findings codes, factuality/semantic_support "not_assessed", human review, pricing, admission and trial counters are unchanged.

Only the hosted worker (deploy/cloudflare-worker), its schemas, generated artifacts and tests are changed. Python source, production data formats and billing are unchanged.

## Reproduce

From the repo checkout, run `node evals/ov-numeric-context-2026-11-11/evaluate.mjs rerun` and `node evals/ov-numeric-context-2026-11-11/evaluate-regression.mjs rerun-regression`. Baseline files were generated from the pre-change worker with the numeric_smoke_check flag (`baseline-fresh.json`, `baseline-regression.json`). Run `npm test` in deploy/cloudflare-worker for developer regression cases (test/numeric-context.test.js, test/answer-review.test.js). No remote evaluation or model API is used.
