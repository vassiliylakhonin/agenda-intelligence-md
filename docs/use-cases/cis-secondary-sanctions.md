# Use case: CIS counterparty secondary-sanctions exposure triage

Status: shipped 2026-05-26. Vertical worker profile `cis_secondary_sanctions`. Schema family v1, additive (non-breaking under [ADR 0003](../adr/0003-v1-compatibility-policy.md)). Live retrieval enabled per [ADR 0014](../adr/0014-per-profile-live-retrieval.md).

## What this is for

A clean sanctions screen does not, by itself, document a defensible secondary-sanctions determination. Under EU enhanced-due-diligence guidance on circumvention, an institution dealing with a CIS, Caucasus, or Central Asia counterparty still has to show a reasoned, documented exposure determination — what was checked, what is missing, why it was escalated. Enforcement programs are judged on that documented reasoning, not on a clean hit.

This worker produces that documented triage. It sits beside a screening or ownership-resolution tool, not instead of one.

## Who this is for

Compliance / sanctions / enhanced due-diligence analysts at:

- EU / UK / UAE / Singapore banks with CIS correspondent banking, trade-finance, or counterparty exposure.
- Trading houses, commodity desks, and freight forwarders moving goods through the Trans-Caspian, Caspian, Black Sea, or Central Asia.
- DFIs / IFIs running enhanced due diligence on Central Asia / Caucasus counterparties.
- Sanctions advisory firms producing client-facing exposure assessments.

The product does not target Kazakhstani or Uzbek operating companies as buyers — it targets institutions outside the CIS that need to demonstrate to their own regulators that a CIS, Caucasus, or Central Asia counterparty is not a front for sanctioned Russian flow.

## What the worker does

The `cis_secondary_sanctions` profile accepts a structured request describing a CIS, Caucasus, or Central Asia counterparty (name, jurisdiction, sector, optional ownership layers), the exposure facets under review (ownership, financial flows, transit / re-export, dual-use, correspondent banking, etc.), the jurisdictions whose regimes are in scope (OFAC, EU, UK OFSI, UN, FATF, EAG), and any dated source extracts the caller has already pulled.

When `OPENSANCTIONS_API_KEY` is set, the worker queries the [OpenSanctions](https://www.opensanctions.org) consolidated dataset for the counterparty name and merges direct matches into the evidence pack as auto-fetched `dated_source` entries with proper attribution. When the API key is missing or upstream fails, the worker degrades gracefully and returns `live_retrieval_status: degraded` / `disabled`.

The response is an auditable triage shape:

- `triage_recommendation` ∈ {`insufficient_information`, `escalate_before_onboarding`, `escalate_before_transaction`, `not_decision_ready`, `ready_for_human_review`}
- `secondary_exposure_signal` ∈ {`low`, `medium`, `medium_high`, `high`, `unknown`}
- `decision_readiness_score` 0–100 + `decision_readiness_label`
- `supplied_sources`, `minimum_sources_before_review`, `evidence_gaps`
- `top_exposure_dimensions` — named, schema-vocabulary risk dimensions
- `typology_refs` — optional mapping to FATF / EAG / OFAC / EU typology codes
- `watch_next` — leading-indicator categories the human reviewer should monitor
- `human_review_required: true` — always
- `limitations` — attribution, degrade reasons, identity-verification caveat
- `not_advice_notice` — explicit boundary

## What it is NOT

- Not legal, sanctions, compliance, financial, investment, insurance, or trading advice.
- Not legal-entity identity verification. A direct name match against an OFAC SDN entry is not the same as confirming that the matched entity is in fact the same legal entity as the caller's counterparty. The schema enforces `human_review_required: true` always.
- Not a substitute for a sanctions-list vendor (Refinitiv World-Check, Dow Jones, Sayari, Castellum, etc.). It is an evidence-discipline layer over the open OpenSanctions dataset, designed for structured triage and audit-trail discipline.
- Not a beneficial-ownership resolver. It does not traverse or reconstruct multi-layer (5–7 deep) ownership graphs. It consumes caller-supplied or OpenSanctions-matched ownership evidence and flags what is missing under the 50% rule; resolving the ownership chain itself is the job of specialized ownership/OSINT tooling (Sayari, Castellum, OxINT, Moody's).

## Source taxonomy

Source-requirement plan: [source-requirements/cis-secondary-sanctions.json](../../source-requirements/cis-secondary-sanctions.json).

`required_before_go`:

| Source type | Why required |
|---|---|
| `ofac_sdn_extract` | Primary US designation list (OFAC SDN + Consolidated). |
| `eu_consolidated_extract` | Primary EU consolidated sanctions list (covers EU 14th package and successors). |
| `ownership_chain_evidence` | Counterparty-disclosed or independently obtained ownership chain up to UBO. |
| `bank_correspondent_evidence` | Correspondent banking chain for the counterparty's settlement path. |
| `transit_or_invoice_evidence` | Recent transit / invoice / customs documents demonstrating actual flow. |

`helpful_context`: `uk_ofsi_extract`, `un_security_council_extract`, `dual_use_export_evidence`, `adverse_media_evidence`, `typology_reference`, `customs_data_evidence`, `national_regulator_filing`.

## Typology mapping (informational)

The response may include `typology_refs` pointing at publicly published FATF, EAG, OFAC, or EU typology codes. This is a reference for the human reviewer, not a finding. Categories the triage commonly surfaces:

- FATF trade-based money laundering typologies (third-party intermediation, false invoicing, transit re-routing).
- EAG (Eurasian Group on Combating Money Laundering) typology reports on Russia-CIS evasion patterns.
- OFAC EO 14114 (October 2024) — secondary-sanctions exposure for non-US financial institutions facilitating Russia-related transactions.
- EU 14th sanctions package — secondary-sanctions provisions for non-EU subsidiaries.
- European Commission enhanced-due-diligence guidance on circumvention, naming EAEU circumvention hubs (Armenia, Kazakhstan, Kyrgyzstan, Uzbekistan) and expecting EDD where activity may indirectly facilitate circumvention even in non-sanctioned countries.

## Boundaries (per ADR 0014)

- `live_retrieval: true` for this profile only. Other profiles (`agenda`, `kazakhstan`) remain `live_retrieval: false`.
- `factual_verification: false`. `not_advice: true`. `human_review_required: true`.
- Upstream: OpenSanctions only. Adding additional upstreams requires a CHANGELOG entry and a row in [SOURCE_POLICY.md](../../SOURCE_POLICY.md) per-profile live retrieval whitelist.

## Calling the worker

HTTP:

```bash
curl -sS -X POST http://localhost:8080/v1/cis-secondary-sanctions/exposure \
  -H "content-type: application/json" \
  --data @examples/cis-secondary-sanctions/contract/escalate_before_onboarding.request.json
```

A2A (JSON-RPC over the worker `/message/send` endpoint):

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "capability": "cis_secondary_sanctions_exposure",
    "message": {
      "data": {
        "counterparty": {"name": "Example KZ Trading LLP", "jurisdiction": "Kazakhstan"},
        "exposure_facets": ["ownership_or_control"],
        "dated_sources": [{"id": "s1", "source_type": "ofac_sdn_extract", "title": "SDN", "date": "2026-05-20"}],
        "risk_question": "...",
        "decision_stage": "onboarding"
      }
    }
  }
}
```

## Honest traction note

As of 2026-05-26, the worker has zero paying customers, zero named pilot users, and no usage above operator smoke tests. The `cis_secondary_sanctions` profile is shipped as a portfolio-grade vertical worker — useful as a concrete artifact for technical evaluators and as a contract that real practitioners can inspect, not as a claim of production traction. See [`docs/announcements/`](../announcements/) for current status updates.
