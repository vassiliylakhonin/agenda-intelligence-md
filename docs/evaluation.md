# Evaluation

Agenda-Intelligence-MD is an **eval layer**, not a fact-checker. The toolkit
explicitly distinguishes evaluation layers and is honest about which ones it
implements today.

## Layers

| Layer | What it answers | Status |
|---|---|---|
| Structural validation | Does the brief conform to the schema? | Implemented (`validate-brief`) |
| Evidence discipline (schema) | Does the evidence pack conform? | Implemented (`validate-evidence`) |
| Evidence discipline (claim-level) | Is each important claim traceable with a support level? | Experimental — see [`schemas/evidence-audit.schema.json`](../schemas/evidence-audit.schema.json) |
| Brief scoring (heuristic) | How structurally complete is a JSON brief? | Implemented (`score brief.json`, 0-100) |
| Evidence-linked scoring | Are claims actually supported by the evidence pack? | Implemented (`score brief.json --evidence pack.json`) |
| Before/after scoring | Marker-based before/after example harness | Implemented (`score path.md`) |
| Factual truthfulness | Are the claims true in the world? | **Not implemented.** Out of scope today. |

> Current scoring does **not** verify factual truth. It evaluates structure,
> completeness, evidence labeling, and decision-readiness signals.

## Assets

| Asset | Location | Purpose |
|---|---|---|
| Scoring rubric | `evals/rubric.md` | 5-dimension quality rubric |
| LLM judge prompt | `evals/llm_judge_prompt.txt` | Optional LLM grader prompt |
| Human review checklist | `evals/human_checklist.md` | Manual review aid |
| Sample cases | `evals/cases/*.json` | Baseline cases |
| Benchmark seed | `evals/benchmark_set.json` | Starting point — not validated results |

## Running checks

```bash
agenda-intelligence validate-brief brief.json                       # structural validation
agenda-intelligence validate-evidence evidence.json                 # evidence-pack schema check
agenda-intelligence score brief.json                                # heuristic 0-100 brief score
agenda-intelligence score brief.json --evidence evidence.json       # evidence-linked scoring
agenda-intelligence score before-after.md                           # before/after harness
```

The Python module `agenda_intelligence.mcp_server.score_output(brief)`
exposes the same heuristic score for agent workflows.

## Benchmark roadmap (target, not a results claim)

| Item | Target |
|---|---|
| Public cases | 10–30 |
| Per case | baseline LLM output, structured-prompt output, Agenda-Intelligence-MD output, human checklist |
| Metrics | unsupported-claim count, missing-uncertainty count, watch-next quality |

Contributions of new cases are the most valuable contribution. See
[`evals/cases/`](../evals/cases/).

## Honest limits

- No factuality verification.
- Heuristic score is intentionally simple; do not treat the number as authoritative.
- LLM-judge prompt is provided; LLM-judge results are not benchmarked.
- No benchmark numbers are published yet. Do not cite them.
