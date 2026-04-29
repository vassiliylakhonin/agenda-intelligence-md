# AnalysisBank

AnalysisBank is the ReasoningBank-inspired layer for Agenda-Intelligence.md.

It stores compact reasoning memories from good and bad agenda-analysis outputs so agents can improve across tasks.

## What to store

Store lessons like:

- a failure pattern that caused a weak analysis;
- a success pattern that made an output decision-useful;
- a boundary condition that prevents overconfident signal classification;
- a concrete watch-next indicator set that generalizes.

Do not store:

- raw private conversations;
- stale facts;
- source dumps;
- full chain-of-thought;
- legal conclusions.

## Retrieval rule

Before a high-stakes or ambiguous agenda-analysis task:

1. Identify domain and region.
2. Search AnalysisBank by trigger terms.
3. Load at most 3 relevant memory cards.
4. Apply only if the boundary conditions match.
5. Prefer memories that prevent known failure modes.

## Update rule

After a useful or failed analysis:

1. Decide whether the lesson is generalizable.
2. Add one memory card if it will improve future outputs.
3. Put failures in `failures/` and successes in `successes/`.
4. Keep the card short and retrieval-friendly.

## Current memory cards

Failures:

- `failures/vague-monitoring.md`
- `failures/overconfident-sanctions-upgrade.md`
- `failures/eu-rhetoric-treated-as-law.md`

Successes:

- `successes/sanctions-routing-signal-classification.md`
