# EU AI Act — Flagship Example

**Audience:** AI engineers building policy / compliance / risk-monitoring agents.

**Disclaimer:** the URLs in `eu-ai-act.evidence.json` are **illustrative
placeholders**, not live citations. The point of this example is the *shape*
of evidence-backed reasoning, not factual reporting on the EU AI Act.

---

## 1. Input event

A regulator publishes new obligations for high-risk AI systems, with a
phased enforcement schedule.

## 2. Baseline weak summary (what most agents emit by default)

> The EU is finalizing the AI Act. It will impose new rules on high-risk AI.
> Companies should prepare. The act includes obligations around transparency,
> data governance, and human oversight. This will likely affect many
> industries and require investment in compliance.

Problems:
- no signal classification
- no separation of evidence-backed claims and inferences
- no main uncertainty
- no watch-next indicators
- no decision implication

## 3. Agenda-Intelligence-MD brief

```json
{
  "bottom_line": "EU AI Act tightens obligations on high-risk AI systems with a phased enforcement schedule; affected operators need a compliance roadmap aligned to phase dates.",
  "signal_classification": "compliance_relevant_development",
  "what_changed": "New high-risk categories defined and enforcement deadlines published.",
  "why_it_matters": "Operators of high-risk AI must demonstrate conformity (risk mgmt, data governance, human oversight) before phase-in dates or face penalties and market-access risk.",
  "affected_actors": [
    "high-risk AI system providers",
    "deployers in regulated sectors",
    "EU notified bodies",
    "non-EU vendors selling into the EU market"
  ],
  "main_uncertainty": "Sector-specific guidance and the exact enforcement posture of national competent authorities are not yet public.",
  "scenarios": [
    {
      "name": "Strict enforcement",
      "description": "Authorities pursue early, visible enforcement actions to set precedent.",
      "indicators": ["first published sanctions decisions", "test cases against major providers"]
    },
    {
      "name": "Soft start",
      "description": "Authorities prioritize guidance and audits over penalties for the first phase.",
      "indicators": ["public guidance documents", "voluntary audit programs"]
    }
  ],
  "watch_next": [
    "Publication of sector-specific implementing guidance",
    "First mandatory conformity assessments for high-risk providers",
    "First public enforcement action by a national competent authority"
  ],
  "evidence_mode": "user_provided"
}
```

## 4. Evidence pack

See [`eu-ai-act.evidence.json`](eu-ai-act.evidence.json).
URLs are placeholders; sources are illustrative.

## 5. Claim-level evidence audit (experimental)

```json
{
  "topic": "EU AI Act",
  "claims": [
    {
      "claim_id": "c1",
      "claim": "EU AI Act tightens obligations on high-risk AI systems.",
      "claim_type": "regulatory_change",
      "evidence_ids": ["e1"],
      "support_level": "direct",
      "uncertainty": "Final text vs. trilogue compromise wording.",
      "risk_if_wrong": "Compliance program scope mis-sized."
    },
    {
      "claim_id": "c2",
      "claim": "Enforcement is phased.",
      "claim_type": "regulatory_change",
      "evidence_ids": ["e1"],
      "support_level": "partial",
      "uncertainty": "Per-sector phase dates may differ from headline schedule.",
      "risk_if_wrong": "Deadline slippage in compliance roadmap."
    }
  ],
  "evidence": [
    {
      "evidence_id": "e1",
      "name": "EU Commission AI Act proposal (illustrative)",
      "url": "https://example.com/ai-act-proposal",
      "source_type": "illustrative_placeholder",
      "supports": ["High-risk obligations", "Phased enforcement"],
      "limits": ["Placeholder URL; not a live citation"]
    }
  ],
  "unsupported_claims": [
    "Exact per-sector enforcement dates"
  ]
}
```

## 6. Validation / scoring

```bash
agenda-intelligence validate-brief examples/source-backed/eu-ai-act.brief.json
agenda-intelligence validate-evidence examples/source-backed/eu-ai-act.evidence.json
agenda-intelligence report examples/source-backed/eu-ai-act.brief.json
```

The `report` output summarizes structural validity and decision-readiness
signals — *not* factual truth.

## 7. What this example demonstrates

- Schema-valid brief shape
- Explicit uncertainty and watch-next
- Separate evidence pack
- Experimental claim-level audit with `support_level` and `risk_if_wrong`
- CLI workflow that drops cleanly into CI
