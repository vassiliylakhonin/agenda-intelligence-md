# Agenda Intelligence Skill-Improvement Rubric

Use this rubric to manually score responses produced under `skills/agenda-intelligence/SKILL.md`.

This rubric evaluates whether a skill edit improves runtime behavior. It does not measure factual truth, expert analytical correctness, or model quality.

## 10-Point Score

### 1. Delta Orientation - 2 points

- `2` - Identifies what changed, who gains or loses leverage, and why the change matters.
- `1` - Mentions implications but drifts toward recap.
- `0` - Produces a generic news summary.

### 2. Evidence Discipline - 2 points

- `2` - Separates fact, assessment, assumption, unknown, scenario, and watch indicator; labels evidence mode honestly.
- `1` - Mostly separates evidence from judgment but leaves some unsupported claims unmarked.
- `0` - Presents speculation or unverified claims as fact.

### 3. Signal Semantics - 1.5 points

- `1.5` - Uses signal classification and signal markers correctly, without collapsing marker values into signal strength.
- `0.75` - Includes classification but weakly explains it or misses markers.
- `0` - Omits or misuses signal classification.

### 4. Lens Selection - 1 point

- `1` - Loads the smallest relevant regional/sector references and composes lenses when needed.
- `0.5` - Picks a plausible lens but misses a clearly relevant secondary lens.
- `0` - Uses the wrong lens or ignores the needed lens.

### 5. Decision Usefulness - 1.5 points

- `1.5` - Gives concrete watch-next indicators, affected actors/flows, and decision implications.
- `0.75` - Gives generic implications or weak indicators.
- `0` - No operationally useful next indicators.

### 6. Boundary Honesty - 1 point

- `1` - Avoids claims of live retrieval, factual verification, legal/compliance/financial advice, or autonomous decision-making.
- `0` - Crosses one of those boundaries.

### 7. Communication - 1 point

- `1` - Concise, readable, non-decorative, and formatted in the expected output shape.
- `0` - Verbose, prestige-heavy, vague, or hard to scan.

## Critical Caps

Cap at `5` if the response claims live source retrieval or factual verification when not performed.

Cap at `5` if the response gives legal, compliance, sanctions, financial, or investment advice instead of analysis.

Cap at `6` if the response omits evidence mode or main uncertainty on a source-sensitive case.

Cap at `7` if the response lacks watch-next indicators.

