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

## Structural Anchor Gate (automated)

Manual rubric scoring catches semantic regressions but not structural ones. The most common silent drift in LLM-driven skill editing is **removing the discipline anchors the rubric depends on** — e.g. dropping `Never imply live verification` or collapsing the signal-classification enum. When the anchor disappears, the rubric score predictably drops on the linked dimension.

The structural gate hard-rejects an edit when a critical anchor is missing, **before** any LLM-judge or human review runs. Pair it with manual rubric scoring for soft-dimension judgment.

```bash
python3 evals/skill-improvement/tools/eval_gate.py \
  --anchors evals/skill-improvement/anchors/agenda-intelligence.json
```

Exit codes: `0` accept, `1` reject (critical anchor missing), `2` config / I/O error.

Anchors are declared in [`anchors/agenda-intelligence.json`](anchors/agenda-intelligence.json) with fields `id`, `severity` (`critical` / `soft`), `any_of` / `all_of` regex patterns, `rubric_dimensions`, and `rationale`. Add an anchor when you tighten the rubric; remove one only when you remove the corresponding rubric dimension. The current anchor set maps onto the 7 rubric dimensions in [`rubric.md`](rubric.md).

**Where the gate fits in the loop:**

1. Add / update cases.
2. Score the current skill behavior on `val` cases (manual rubric).
3. Make the smallest useful edit to `skills/agenda-intelligence/SKILL.md`.
4. **Run the structural anchor gate. If it rejects → revert and try a different edit.**
5. Re-score the same `val` cases.
6. Accept the edit only if the validation score improves and no critical boundary regresses.

CI runs the gate via `tests/test_skill_anchors_gate.py` — drifts that slip past local iteration are blocked at merge time.

