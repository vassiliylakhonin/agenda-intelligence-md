# Critical Minerals & Strategic Raw Materials Due Diligence Gate

Use-case contract for Agenda Intelligence MD.

## Proposition

Bring a mineral commodity (lithium, rare earths, nickel, cobalt, copper, graphite, manganese, tungsten, gallium/germanium), extraction jurisdiction, processing and smelting route, counterparties, and dated sources. Get a deterministic due-diligence triage with origin traceability, strategic export quota flags, CSDDD compliance evidence gaps, top supply-chain risks, and human-review routing.

This is an evidence-readiness layer for critical minerals procurement, offtake agreements, and mining investment. It helps procurement directors, commodity traders, supply-chain analysts, and investment committees evaluate whether an offtake or investment dossier has sufficient traceability and legal documentation before binding commitments.

It is not legal, export-control, sanctions, customs, ESG certification, or investment advice. It does not perform live retrieval, assay testing, or factual verification.

## Target users

- Critical minerals procurement teams at EV, renewable energy, and aerospace manufacturers.
- Commodity trading desks evaluating offtake agreements and tolling contracts across Central Asia, Africa, and Latin America.
- Sovereign wealth and private equity funds assessing mining exploration and processing facility investments under the EU Critical Raw Materials Act (CRMA) and US Inflation Reduction Act (IRA).
- Compliance and trade counsel auditing supply chains for EU Corporate Sustainability Due Diligence Directive (CSDDD) compliance.

## Input shape

```json
{
  "project_name": "Central Asia Rare Earths Offtake",
  "commodity": "rare_earth_elements",
  "origin_jurisdiction": "Kazakhstan",
  "processing_jurisdiction": "Kazakhstan",
  "target_market": "eu",
  "decision_question": "Is the due diligence file complete for committee off-take approval?",
  "decision_stage": "pre_offtake_agreement",
  "supplied_sources": [
    {
      "source_type": "mining_concession_or_license_extract",
      "title": "Subsoil Use License #4812",
      "date": "2025-11-10"
    }
  ]
}
```

## Gate Decisions

| Decision | Meaning |
|---|---|
| `continue` | All required origin, assay, export quota, and CSDDD audit sources are supplied; file is ready for committee review. |
| `request_evidence` | Critical documents are missing (e.g. certified assay, beneficial ownership report, export quota clearance). |
| `stop` | Severe export quota restrictions or high-risk refining jurisdiction flags identified without required licenses. |
