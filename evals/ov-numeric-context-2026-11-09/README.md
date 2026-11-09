# Numeric-context evaluation, 2026-11-09

Fresh evaluator-authored synthetic validation: 32 cases frozen before implementation, SHA256 in VALIDATION-FREEZE.txt. Labels were not changed after results. Source was inspected before case authorship, so this is not a blind independent evaluation, real user evidence, or demand validation. The original 56-case benchmark is regression now.

| Python review_rag_answer | Before | Candidate |
| --- | --- | --- |
| New validation: unsupported claims flagged | 3/16 | 15/16 |
| New validation: supported claims falsely held | 9/16 | 1/16 |
| Old regression: semantic errors flagged | 11/24 | 15/24 |
| Old regression: supported answers falsely held | 7/16 | 6/16 |

The remaining fresh-set miss is `may reopen` changed to `will reopen`. The remaining false hold is the paraphrase `50 percent` to `one half`. No tuning was done after the first candidate validation run. Any subsequent changes need another fresh validation set; this one becomes regression too.

Changes are bounded: canonical mass/length/time units; negative/minus numeric wording; closest numeric sentence/clause context instead of a union of weakly related sentences; explicit English `the Name` anchors. This is not general entity resolution, unit inference, arithmetic, semantic entailment or source authentication. English and some Russian unit spellings are supported, not all languages or units. `m` denotes length unless a currency marker identifies a scale; ambiguous unsupported uses require human inspection. General synonym/paraphrase handling is unchanged. `human_review` still requires a human and does not establish factual truth or authorize action.

Only Python source is changed. Worker review_answer/free_trial, production deployment, published PyPI wheels, schemas, prices and billing are unchanged.

## Reproduce

From an installed checkout, run `python evals/ov-numeric-context-2026-11-09/evaluate.py /absolute/path/to/checkout rerun`. The script evaluates frozen validation.json with the checkout's actual `review_rag_answer` and writes rerun.json in this folder. Baseline files were generated from e3036bb0a0c77012fc348807660ba89f98646a80. The candidate source is the commit carrying this directory. Full outputs are retained for both versions. Run `pytest tests/test_numeric_context_units.py` for developer regression cases. No remote evaluation or model API is used.
