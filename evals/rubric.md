# Heuristic Scoring Rubric for Agenda‑Intelligence Briefs

The rubric produces a deterministic heuristic score for structure, evidence discipline, and decision-readiness signals. It does not measure factual truthfulness or expert analytical correctness. Each brief is scored on a 0‑100 scale by aggregating the following dimensions.

| Dimension | Description | Weight |
|-----------|-------------|--------|
| **Relevance** | Does the brief address the original topic / signal? Are the selected indicators directly tied to the change? | 25% |
| **Evidence Support** | Are all factual statements backed by an **EVIDENCE** reference that exists in the source plan? Are unsupported claims flagged? Does decisive language match the provenance tag? Are source conflicts surfaced rather than silently resolved? | 25% |
| **Completeness** | Contains all required sections: Bottom line, Signal classification, What changed, Main uncertainty, Watch next, Affected flows, Institutional path, etc. No missing mandatory fields. | 20% |
| **Actionability** | Does the brief surface concrete “watch‑next” indicators and a clear decision‑making implication (e.g., trigger condition, risk level)? | 15% |
| **Clarity / Readability** | Concise language, no jargon overload, logical flow, and correct formatting (markdown headings, bullet lists). | 15% |

## Scoring Method
1. Each dimension receives a raw score from 0‑100.
2. Multiply by its weight and sum the results.
3. Round to the nearest integer → final heuristic score.

### Example Calculation
- Relevance: 90 → 22.5
- Evidence: 80 → 20.0
- Completeness: 70 → 14.0
- Actionability: 85 → 12.75
- Clarity: 95 → 14.25
- **Total = 83**

The deterministic CLI scorer, optional LLM judge, and human reviewer can use the same dimensions, but their results should be reported separately.
