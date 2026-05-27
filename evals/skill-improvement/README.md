# Skill Improvement Evals

This folder is a lightweight SkillOpt-style loop for improving the packaged runtime skills in this repo without introducing a prompt-optimization framework or new runtime dependency.

It is different from the existing benchmark layers:

- `evals/baselines/` scores bundled structured examples.
- `evals/agent-eval/` compares agent output shape with and without the product shell.
- `evals/skill-improvement/` evaluates proposed edits to `skills/*/SKILL.md` before accepting them.

The goal is to keep skill changes evidence-disciplined: write cases first, score the current skill, make a small skill edit, then accept only if validation cases improve without regressions.

## Files

- `cases/agenda-intelligence.jsonl` - validation cases for `skills/agenda-intelligence/SKILL.md`.
- `rubric.md` - manual scoring rubric for skill responses.
- `runs/agenda-intelligence-baseline.md` - first baseline against the current skill.
- `tools/validate_cases.py` - local JSONL format validator.

## Workflow

1. Add or update cases before changing the skill.
2. Score the current skill behavior on `val` cases.
3. Make the smallest useful edit to `skills/agenda-intelligence/SKILL.md`.
4. Re-score the same `val` cases.
5. Accept the edit only if the validation score improves and no critical boundary regresses.

## Acceptance Rule

Accept a skill edit only when all are true:

- Average `val` score improves by at least `0.5` on the 10-point rubric, or a critical boundary failure is fixed.
- No `val` case drops by more than `1.0`.
- The edit preserves the project boundary: no live retrieval claim, no factuality verification claim, no advice claim.
- The edit stays short enough that the skill remains usable at runtime.

## Validate Cases

```bash
python3 evals/skill-improvement/tools/validate_cases.py \
  evals/skill-improvement/cases/agenda-intelligence.jsonl
```

