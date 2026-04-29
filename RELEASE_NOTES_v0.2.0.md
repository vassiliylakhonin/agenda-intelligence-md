# v0.2.0 — AnalysisBank reasoning memory layer

v0.2.0 adds **AnalysisBank**, a ReasoningBank-inspired memory layer for Agenda-Intelligence.md.

## Added

- `analysis-bank/README.md` — how to store and retrieve reasoning memories.
- `analysis-bank/MEMORY_FORMAT.md` — memory-card format.
- Failure memory cards:
  - `vague-monitoring.md`
  - `overconfident-sanctions-upgrade.md`
  - `eu-rhetoric-treated-as-law.md`
- Success memory card:
  - `sanctions-routing-signal-classification.md`
- Induction prompts:
  - `induce-success-memory.md`
  - `induce-failure-memory.md`
  - `induce-contrast-memory.md`
- `scripts/eval_before_after.py` — lightweight before/after scoring harness.

## Eval results

```text
eu-ai-act.md:          before 3/16  → after 14/16
red-sea-shipping.md:  before 1/16  → after 13/16
sanctions-routing.md: before 2/16  → after 14/16
```

The validator now runs the eval script in CI.

## Why this matters

Agenda-Intelligence.md is no longer just a static protocol. It now has a lightweight mechanism for accumulating reusable reasoning lessons from successes and failures.
