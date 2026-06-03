# Walkthrough: one Middle Corridor deal, end to end

This walks a single deal through the gate, step by step, naming the service
function that runs at each step and the artifact it produces. Every artifact in
this folder is a fixture you can open and inspect. The point of the gate is that
each routing decision carries an inspectable reason for every gap behind it.

This is pre-screening evidence triage. It is not legal, compliance, sanctions,
insurance, financial, or investment advice. It does not verify factual truth and
does not retrieve sources on its own. Human review is required before any
commercial action.

## The deal

A forwarder is about to sign a transit contract:

- Route: `Altynkol -> Aktau/Kuryk -> Baku -> Poti`
- Cargo: industrial equipment
- Counterparties: shipper, forwarder, consignee
- Question: should this be escalated before contract signature?

The caller brings three dated sources: a port operator notice (2026-05-20), a
sanctions-list extract with no exact match (2026-05-21), and a carrier routing
note (2026-05-22).

## Step 1 — request

The caller submits route, cargo, counterparties, risk question, and only the
sources they actually hold.

Artifact: [`01-request.json`](01-request.json)

Nothing is retrieved. The gate works on caller-supplied evidence by default.

## Step 2 — source coverage

`source_coverage` checks the supplied sources against the required-before-go
source set for a corridor deal and reports what is present versus missing.

Artifacts: [`02-dated-sources.json`](02-dated-sources.json),
[`03-evidence-pack.json`](03-evidence-pack.json),
[`05-evidence-gaps.json`](05-evidence-gaps.json)

```json
"coverage_status": "insufficient",
"missing_required_sources": [
  "counterparty_registry_extract",
  "beneficial_ownership_source",
  "customs_or_regulatory_source",
  "insurance_clause_or_underwriter_note",
  "independent_vessel_or_carrier_history"
]
```

Five load-bearing source types are absent. The gate names them rather than
papering over the gap.

## Step 3 — evidence lint

`validate_evidence` and `audit_claims` check that each claim traces to a dated
source, and flag claims that rest on too thin a base.

The sanctions-adjacent conclusion rests only on a caller-supplied
no-exact-match extract. That dependency is surfaced, not hidden inside fluent
prose.

## Step 4 — memo

`middle_corridor_deal_risk` drafts a memo only after the lint runs. It separates
facts from assessment, lists the evidence gaps, and ends with watch-next
indicators.

Artifact: [`04-risk-memo.md`](04-risk-memo.md)

```text
Triage recommendation: escalate before signature.
```

## Step 5 — decision-readiness score

`score_output` scores the file for handoff. A failing gate means the file does
not go to committee yet.

Artifact: [`06-score.json`](06-score.json)

```json
"quality_gate": "fail",
"score": 68,
"human_review_required": true
```

The score is a structural-completeness heuristic (0-100), uncalibrated against
expert judgment. It measures whether the evidence set is complete and traceable,
not whether any claim is true in the world.

## Step 6 — the outward view

The same gap picture, reframed for the other actor. The internal chain answers
"should we escalate?" The `counterparty_readiness` object answers "how complete
is the dossier I must present to a bank, insurer, or counterparty under enhanced
due diligence?"

Artifact: [`07-counterparty-readiness.json`](07-counterparty-readiness.json)

```json
"status": "partial",
"required_total": 6,
"supplied_count": 1,
"missing_count": 5
```

It tracks dossier-completeness only. It is not clearance, approval, a sanctions
determination, or compliance advice.

## Where this sits

This is not a replacement for a sanctions-screening engine (Watchman,
OpenSanctions) or a GRC platform. It is the evidence-discipline layer those
tools sit on: it decides whether the evidence pack behind a deal is complete and
traceable enough to route to human review, before a screening hit or a committee
sign-off is even worth the analyst's time.

A screening tool answers "does this name match a list?" This gate answers "is
the file behind this deal ready for a human to decide at all?" Different
questions, different layers.

## What changes

Without the gate, a corridor deal reaches a reviewer as a fluent summary with
the gaps buried. With it, the deal reaches the reviewer only when the
required-before-go evidence set is complete, and every outstanding item is named
with the reason it blocks the file. The reviewer spends attention on judgment,
not on reconstructing what evidence is missing.

## Run it live

See [`README.md`](README.md) for the live A2A endpoint and a repeatable curl
against the deployed worker.
