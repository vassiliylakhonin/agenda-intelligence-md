# Research quality acceptance — 2026-10-28

These are inspectable regression cases, not a benchmark of general factual accuracy or customer demand. Compact synthetic excerpts reproduce the relevant evidence structures; they are not represented as verbatim live operator quotations. The preserved live replay is separately labelled as owner-generated evaluation data.

| Case | Retain / calculate | Withhold or leave incomplete |
| --- | --- | --- |
| Route coordination | Report the described timetable mechanism and a concrete absence of measured impact | A claimed two-day saving absent from the evidence |
| Aktau project stage | Preserve trial-operation date and exact phase | Full operation inferred from a trial; capacity treated as observed flow |
| Historical indicators | Total cargo +17.4%; all containers −25.8%; route subset −39.5%, each from its own annual pair | Wrong unit/scope/scale, swapped years, flattened headers, ratio labelled growth, or missing baseline |

Primary-source teaching examples and their provenance: [route](corridor-demo-route.md), [project stage](corridor-demo-project-stage.md), [indicators](corridor-demo-indicators.md), [acquisition review](corridor-operator-primary-sources-2026-10-28.md).

The original failed owner-marked live response is preserved in [the replay fixture](../../tests/fixtures/corridor_research/live_numeric_replay.json). Its broad numeric finding is now withheld. It is not silently corrected and relabelled as the original model's successful output.

The model can no longer supply a growth percentage through numeric prose: quantity claims are assembled from retained observation records, and arithmetic is computed in code. The code does not reconstruct arbitrary tables, infer hidden observation years, certify authenticity, or establish semantic entailment. A syntax-valid number in a corrupt source remains potentially wrong.

Question coverage is bounded to punctuation/newline-delimited parts, annual comparisons and requested recognized units. Missing evidence produces a source-specific gap; an unexplained omission cannot earn `checks_passed`. A model-linked qualitative claim can still be semantically weak, so every artifact keeps `human_review_required=true` and an explicit check scope.

Run the regression cases with:

```sh
cd deploy/cloudflare-worker
node --test test/research-quality.test.js test/corridor-research.test.js
npm test
npm run test:research-runtime
```

The complete execution regression validates both a retained 17.4% comparison and a wrong-unit proposal that finishes with `quality.status=blocked`, zero public findings and no retained working/model text. It also checks stored 1.0 artifacts against the extended response schema. Native-runtime fixtures make no paid model calls.
