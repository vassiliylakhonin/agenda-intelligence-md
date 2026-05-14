# EU Carbon Border Adjustment Mechanism (CBAM) — Source-backed Analysis

**Audience:** Non-EU industrial exporters, EU importers, trade compliance officers, carbon-intensive manufacturers.

**Claim:** EU Regulation 2023/956 introduces mandatory carbon reporting and certificate obligations for imports of carbon-intensive goods, creating a compliance barrier and cost uplift for non-EU exporters who lack verified carbon pricing data.

**Evidence JSON:** See `eu-cbam.evidence.json`.

---

## 1. Input event

The EU CBAM entered its transitional phase on 1 October 2023 and moves to its definitive phase on 1 January 2026, when importers must begin purchasing CBAM certificates. Covered sectors: steel, aluminium, cement, fertilisers, hydrogen, and electricity.

## 2. Baseline weak summary (what most agents emit by default)

> The EU is introducing a carbon border tax. It will affect imports of certain goods. Companies should prepare for additional costs and reporting requirements. This may create competitive disadvantages for some exporters.

Problems:
- no signal classification
- no separation of evidence-backed claims and inferences
- no main uncertainty
- no watch-next indicators
- no affected-actor specificity

## 3. Agenda-Intelligence-MD brief

```json
{
  "bottom_line": "EU CBAM (Reg. 2023/956) imposes embedded-carbon reporting now and certificate-purchase obligations from 2026; non-EU exporters without verified carbon data face direct cost uplift and potential market-access risk.",
  "signal_classification": "compliance_relevant_development",
  "what_changed": "CBAM transitional phase (Oct 2023 – Dec 2025) requires quarterly embedded-carbon reporting; definitive phase from Jan 2026 requires CBAM certificates priced at EU ETS carbon price.",
  "why_it_matters": "Non-EU exporters in covered sectors must quantify and verify embedded carbon or face import barriers; EU importers bear certificate-purchase cost and reporting liability.",
  "affected_actors": [
    "non-EU steel exporters",
    "non-EU aluminium exporters",
    "non-EU cement and fertiliser producers",
    "EU importers of covered goods",
    "carbon-intensive manufacturers in countries without carbon pricing"
  ],
  "main_uncertainty": "CBAM certificate price volatility (linked to EU ETS price) and enforcement strictness during the early definitive phase.",
  "scenarios": [
    {
      "name": "Smooth transition",
      "description": "Non-EU exporters build verified carbon accounting systems; CBAM cost is manageable and absorbed into pricing.",
      "indicators": ["high CBAM registry registration rates by Q3 2025", "EU ETS price stabilises below EUR 70/tCO2"]
    },
    {
      "name": "Enforcement crackdown",
      "description": "EU customs and national authorities pursue penalties for under-reporting; non-EU exporters without verified data lose EU market access.",
      "indicators": ["first penalty decisions published by national authorities", "EU Commission issues infringement notices", "sharp drop in imports from non-CBAM-compliant exporters"]
    }
  ],
  "watch_next": [
    "EU Commission CBAM registry launch and registration volumes (Q4 2025)",
    "EU ETS carbon price trajectory into 2026",
    "First enforcement actions or penalty decisions by national competent authorities",
    "Trading partner responses: bilateral agreements or WTO challenges"
  ],
  "evidence_mode": "live_source_backed"
}
```

## 4. Evidence pack

See [`eu-cbam.evidence.json`](eu-cbam.evidence.json).

## 5. Claim-level evidence audit

See [`eu-cbam.audit.json`](eu-cbam.audit.json).

## 6. Validation

```bash
agenda-intelligence check  examples/source-backed/eu-cbam/eu-cbam.brief.json
agenda-intelligence audit  examples/source-backed/eu-cbam/eu-cbam.evidence.json
agenda-intelligence report examples/source-backed/eu-cbam/eu-cbam.brief.json
```

## 7. What this example demonstrates

- Schema-valid brief with `live_source_backed` evidence mode
- Primary EU regulation and implementing regulation as anchor sources
- Transitional-to-definitive phase structure as a compliance signal
- Scenario branching on enforcement posture
- Claim-level audit with orphan-free evidence references
