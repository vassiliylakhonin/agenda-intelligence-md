# AnalysisBank Memory Format

AnalysisBank stores short reasoning memories distilled from successful and failed agenda-analysis outputs.

The memory is not a transcript, source archive, or full example. It is a reusable lesson an agent can retrieve before a similar future task.

## Memory card

```md
# Memory: <short title>

## Lifecycle
- lesson_id: <stable kebab-case id>
- version: 1
- status: active | stale | superseded | rejected
- created_at: YYYY-MM-DD
- last_validated_at: YYYY-MM-DD
- stale_after_days: 365
- supersedes: none | <lesson_id>
- confidence: high | medium | low
- evidence_basis: <what examples, reviews, failures, or tests support the lesson>

## Trigger
When this memory should be considered.

## Pattern
The success or failure pattern this memory captures.

## Better reasoning
The transferable reasoning move to apply next time.

## Apply when
Concrete task conditions where this memory is useful.

## Do not apply when
Boundary conditions that prevent overuse.

## Watch indicators
Observable evidence that should confirm, weaken, or falsify the assessment.

## Example rewrite
A short before/after rewrite showing the improvement.
```

## Rules

- Prefer concrete, actionable lessons over abstract principles.
- Do not store private user data, secrets, or raw source dumps.
- Do not copy one-off facts that will go stale.
- Store both success and failure memories.
- Keep each card short enough to retrieve with at most two other cards.
- Do not apply stale, superseded, or rejected lessons as recommendation support
  without revalidation.
- Treat `stale_after_days` as an expiry guard: an active lesson must be
  revalidated before that window closes.
