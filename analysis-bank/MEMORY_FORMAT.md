# AnalysisBank Memory Format

AnalysisBank stores short reasoning memories distilled from successful and failed agenda-analysis outputs.

The memory is not a transcript, source archive, or full example. It is a reusable lesson an agent can retrieve before a similar future task.

## Memory card

```md
# Memory: <short title>

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
