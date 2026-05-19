# Claim-level evidence audit

Status: **stable schema contract**. Schema lives at
[`schemas/evidence-audit.schema.json`](../schemas/evidence-audit.schema.json),
validated by `agenda-intelligence audit-claims <path>`.

This contract is for agents that want to make their own claims auditable.
It is intentionally narrow — it tells you whether the *form* of the claim →
evidence link is sound. It does **not** verify factual truth.

## The shape

```json
{
  "topic": "<freeform topic>",
  "claims": [
    {
      "claim_id": "c1",
      "claim": "<one sentence claim>",
      "claim_type": "regulatory_change | sanctions_event | market_event | geopolitical_event | capability_claim | ...",
      "evidence_ids": ["e1", "e2"],
      "support_level": "direct | partial | weak | unsupported",
      "uncertainty": "<what is still unsure even if supported>",
      "risk_if_wrong": "<decision-level cost if claim is wrong>"
    }
  ],
  "evidence": [
    {
      "evidence_id": "e1",
      "name": "<source name>",
      "url": "<url, may be illustrative_placeholder>",
      "source_type": "official_document | regulator_announcement | news | analyst_report | primary_data | illustrative_placeholder",
      "freshness": "<date or label>",
      "supports": ["<what this evidence supports>"],
      "limits": ["<what this evidence does not cover>"]
    }
  ],
  "unsupported_claims": [
    "<important claims the analyst could not back with evidence>"
  ]
}
```

## How agents use this contract

A reasonable agent loop:

1. Draft a brief in the `agenda-brief` shape.
2. For each load-bearing sentence in the brief, emit a `claim` with a
   stable `claim_id` (e.g. `c1`, `c2`).
3. For each cited source, emit an `evidence` item with a stable
   `evidence_id`.
4. Wire claims to evidence via `evidence_ids`.
5. Set `support_level` honestly. **`unsupported` is allowed and useful.**
6. Add `uncertainty` and `risk_if_wrong` for any claim with `support_level`
   weaker than `direct`.
7. List things the agent wanted to claim but could not back into
   `unsupported_claims`.
8. Run:
   ```bash
   agenda-intelligence audit-claims claims.json
   agenda-intelligence audit-claims claims.json --format json
   ```

## What `audit-claims` checks

- Schema validity (claim shape, evidence shape, allowed `support_level`).
- `evidence_ids` referenced by claims actually exist in `evidence` —
  orphan refs are flagged on stderr.
- Distribution of `support_level` across claims (printed summary).
- Count of explicitly listed `unsupported_claims`.

## What `audit-claims` does NOT check

- Whether the cited URL actually says what `supports` claims it says.
- Whether the source is reputable.
- Whether the claim is true.
- Whether the agent over-claimed `support_level`.

These are downstream concerns for a future truthfulness layer. Today the
contract just makes it possible to *spot* missing or weak evidence
mechanically.

## Honest limits

The schema contract is stable, but it is still a traceability layer. It does
not verify factual truth, source reputation, or whether a claimed
`support_level` is semantically justified. `evidence-pack.schema.json` remains
the primary evidence-pack contract; `evidence-audit.schema.json` adds
claim-level traceability when that granularity is needed.
