# SOURCE_POLICY.md

Reasoning is not enough. Agenda-analysis agents need source discipline.

Use this policy before writing briefs about public agenda, policy, regulation, sanctions, elections, conflict, energy, trade, markets, technology, or strategic risk.

## Core rule

Generate a source plan before analysis when facts are current, contested, legal, financial, operational, or high-stakes.

If live retrieval fails or is not available, say so and downgrade evidence mode.

## Evidence modes

- **live_source_backed** — current sources were checked during the task.
- **user_provided** — analysis relies on sources/facts supplied by the user.
- **reasoning_only** — no live verification; answer is based on general knowledge and stated assumptions.
- **mixed** — combination of the above.

## Source hierarchy

Prefer:

1. Primary legal/official sources.
2. Regulator, central bank, court, parliament, procurement, sanctions-list, company filing, or standards sources.
3. Direct company/institution statements.
4. Reputable data sources and trade/market datasets.
5. Media, expert, think-tank, consultancy, or analyst commentary as supporting evidence.

Do not use commentary as a substitute for legal text, regulator guidance, filings, procurement records, enforcement actions, or official data when those are required.

## Claim discipline

For every important claim, identify:

- what source type would support it;
- whether the claim is supported, partially supported, or unsupported;
- what evidence would confirm, weaken, or falsify it.

## Do not claim without evidence

- Binding legal obligation without legal text or regulator guidance.
- Sanctions designation without official list or legal instrument.
- Enforcement trend without enforcement actions, penalties, seizures, customs detentions, or regulator statements.
- Market impact without price, filing, company behavior, tender/procurement, or transaction evidence.
- Election outcome or legitimacy shift without official results, polling methodology, legal challenge, or observer reporting.
- Conflict escalation without credible operational indicators.
- Energy disruption without production, shipping, pipeline, inventory, OPEC+, or market data.
- AI/technology policy implementation without legal text, budget, procurement, standards, infrastructure, or deployment evidence.

## Source plan workflow

1. Classify the task category.
2. Load the matching source requirement pack from `source-requirements/`.
3. Identify must-check source types.
4. Check primary sources first when available.
5. Mark unsupported claims explicitly.
6. Then write the brief using `Agenda-Intelligence.md`.

## Failure handling

If source access fails:

```text
Evidence access limited: live retrieval failed or was unavailable. Treat this as reasoning-only or mixed analysis, not source-backed analysis.
```

Then provide a source plan and the safest useful assessment.
