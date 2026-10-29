# Use case: Gulf maritime sanctions and chokepoint-disruption exposure triage

Status: shipped 2026-06-03. Vertical worker profile `gulf_maritime_exposure`. Schema family v1, additive (non-breaking under [ADR 0003](../adr/0003-v1-compatibility-policy.md)). The local service uses caller-supplied references; the hosted Worker can also use a configured Vizier maritime screen. Its availability and results must be inspected for each run.

## What this is for

A vessel or voyage transiting the Strait of Hormuz, Persian/Arabian Gulf, Gulf of Oman, Bab-el-Mandeb, or Red Sea can carry sanctions exposure (Iran-origin oil, Russia price-cap, dark-fleet patterns, ship-to-ship concealment) and chokepoint-disruption risk at the same time. The decision-maker has to show a documented, reasoned exposure determination before fixing or sailing — what was checked, what is missing, why it was escalated.

This worker produces triage on caller-supplied references. The hosted Worker may also use its configured Vizier maritime screen; a match is a lead, not identity or clearance. The local service does not screen names. Neither resolves vessel ownership or substitutes for a specialized maritime-intelligence tool.

## Who this is for

- Marine and war-risk underwriters and P&I clubs assessing a voyage before binding cover.
- Commodity / energy trading and chartering desks fixing tanker voyages through the Gulf or Red Sea.
- Shipowner / operator compliance and sanctions teams clearing a vessel before fixture.
- Bunkering and ship-agency compliance exposed to dark-fleet and STS-transfer risk.

## What the worker does

The `gulf_maritime_exposure` profile accepts a structured request describing the vessel (name, flag, type — optional), the voyage (chokepoint, origin, destination), cargo, counterparties (registered/beneficial owner, operator, charterer, insurer/P&I club, flag registry, bunker supplier), the exposure facets under review, the jurisdictions in scope (OFAC, EU, UK OFSI, UN), and any dated source extracts the caller has pulled.

The response is an auditable triage shape:

- `triage_recommendation` ∈ {`insufficient_information`, `escalate_before_fixture`, `escalate_before_voyage`, `not_decision_ready`, `ready_for_human_review`}
- `exposure_signal` ∈ {`low`, `medium`, `medium_high`, `high`, `unknown`}
- `decision_readiness_score` 0–100 + `decision_readiness_label`
- `supplied_sources`, `minimum_sources_before_review`, `evidence_gaps`
- `top_exposure_dimensions` — named, schema-vocabulary risk dimensions
- `chokepoint_disruption_watch` — chokepoint-specific leading indicators to monitor
- `watch_next` — sanctions/listing/cover leading indicators
- `human_review_required: true` — always
- `not_advice_notice` — explicit boundary
- `limitations` — caller-supplied-only and identity-verification caveats

## Voyage intake and gate

The hosted trial page can prepare a voyage request locally: enter caller-declared IMO, MMSI, name and flag, route, insurer and explicitly selected facets and document references. Preparation does not upload or evaluate the case. The existing structured JSON, MCP and A2A paths remain available. These identifiers are not authenticated; a declared IMO or name plus flag satisfies an intake check, not vessel identity verification. MMSI is supplemental and cannot by itself satisfy that check.

The additive `voyage_gate` object contains `verdict`, `readiness_level`, `blocking_reasons` and `ais_quality`. `BLOCK_PRE_FIXTURE` is a recommendation for the caller's policy, not enforcement of a chartering system. For other stages the equivalent is `EVIDENCE_BLOCKED`; a complete metadata packet can at most be `HUMAN_REVIEW_REQUIRED`. An integration must enforce any hold and obtain its own independent approval.

- Unknown, absent or placeholder P&I club/insurer produces `P_AND_I_UNKNOWN` and is the first evidence gap, even if a P&I reference was supplied.
- Missing ownership or sanctions references produce `OWNERSHIP_OPAQUE` or `SANCTIONS_SCREEN_MISSING`; STS selected without its history reference produces `STS_WITHOUT_HISTORY`.
- `AIS_ONLY_FILE` identifies an AIS-only usable reference list; `VESSEL_IDENTITY_MISSING` identifies the absence of both a declared IMO and a declared name-plus-flag; `REQUIRED_SOURCE_MISSING` preserves the baseline checklist. A configured unavailable or matching upstream screen is called out separately when reported by the hosted Worker.
- Any blocking reason caps the metadata readiness score at 49 and prevents a ready-for-human-review route. The four `readiness_level` values are workflow prompts, not ratings of actual source quality or permission to sign.

The five baseline categories are registry, P&I, ownership, sanctions and AIS. For the STS facet, add a transfer-history reference. A declared insurer, identifiers and all reference types do not establish that documents are real, current, cover this voyage or support a decision. Explicitly marked synthetic examples and placeholders cannot close gaps; the metadata filter cannot detect every fabricated record. The saved page demo shows an AIS-only file and a synthetic follow-up whose gaps remain. `ais_quality: not_assessed` is deliberate: the gate does not calculate gap hours, detect spoofing or establish STS patterns. Review those with an appropriate source and specialist.

The page offers prompts for Hormuz crude, Red Sea containers, Bab-el-Mandeb transit and Gulf of Oman STS. They are suggested questions, not automatically evaluated playbook-specific requirements. For a CIS-linked counterparty, sensitive cargo or agent-directed payment, consider the separate CIS Secondary Sanctions, Dual-Use Export or Financial Guard gate respectively; those links do not transfer case data or provide clearance.

## Exposure facets

`iran_oil_exposure`, `russia_oil_price_cap`, `dark_fleet_indicators`, `sts_transfer`, `flag_hopping`, `insurance_or_pi_gap`, `ais_manipulation`, `ownership_or_control`, `dual_use_cargo`, `chokepoint_disruption`.

## What it is NOT

- Not legal, sanctions, compliance, financial, investment, insurance, or trading advice.
- Not vessel-identity or legal-entity verification. The schema enforces `human_review_required: true` always.
- Not an ownership-resolution engine or live AIS feed. The optional hosted Vizier screen can report matches or degradation; it does not establish identity, ownership or clearance. Obtain and independently review current registry, AIS, insurance and sanctions records.

## Source taxonomy

Source-requirement plan: [source-requirements/gulf-maritime-exposure.json](../../source-requirements/gulf-maritime-exposure.json).

`required_before_go`:

| Source type | Why required |
|---|---|
| `vessel_registry_extract` | Vessel identity and registration baseline. |
| `pi_insurance_certificate` | Confirmation of P&I / war-risk cover — a primary dark-fleet discriminator. |
| `ownership_or_control_evidence` | Registered/beneficial owner and control chain (caller-disclosed or independently obtained). |
| `sanctions_list_extract` | Dated OFAC / EU / UK OFSI vessel or entity list check. |
| `ais_track_record` | A reference to AIS history for independent review; this gate does not assess gap hours, spoofing or activity patterns. |

`helpful_context`: `flag_registry_record`, `sts_transfer_evidence`, `classification_society_record`, `port_state_control_record`, `cargo_or_bl_evidence`, `adverse_media_evidence`, `prior_incident_or_detention`, `price_cap_attestation_or_recordkeeping`.

When `russia_oil_price_cap` is among the exposure facets and no `price_cap_attestation_or_recordkeeping` evidence is supplied, `top_exposure_dimensions` flags that the per-loading price-cap attestation and itemized ancillary-cost recordkeeping are not yet evidenced (the OFAC tiered safe-harbor artifact). This is an evidence-gap flag routed to human review — never a determination that the cap was met or breached. It is intentionally `helpful_context`, not `required_before_go`, so supplying it does not change the `decision_readiness_score`.

## Boundaries

- `live_retrieval: false` for this profile. Caller-supplied evidence only.
- `factual_verification: false`. `not_advice: true`. `human_review_required: true`.

## Calling the worker

HTTP:

```bash
curl -sS -X POST http://localhost:8080/v1/gulf-maritime/exposure \
  -H "content-type: application/json" \
  --data @examples/gulf-maritime-exposure/contract/escalate_before_fixture.request.json
```

A2A (JSON-RPC over the worker `/message/send` endpoint):

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "capability": "gulf_maritime_exposure",
    "request": {
      "voyage": {"chokepoint": "strait_of_hormuz"},
      "exposure_facets": ["iran_oil_exposure", "dark_fleet_indicators"],
      "dated_sources": [{"id": "g1", "source_type": "ais_track_record", "title": "AIS", "date": "2026-05-28"}],
      "risk_question": "Escalate before fixture?",
      "decision_stage": "pre_fixture"
    }
  }
}
```

## Supporting research (empirical context)

The dark-fleet, ship-to-ship, and AIS-manipulation facets this worker flags are not hypothetical: recent maritime-detection research documents both their prevalence and the difficulty of detecting them, which is why a documented evidence-readiness check is warranted *before* fixing or sailing. This is empirical corroboration of the practices — it is **not** the regulatory basis (that remains OFAC / EU / UK OFSI / UN guidance), and the worker implements none of these detection methods; it consumes caller-supplied dated evidence and flags what is missing.

- **Dark ship-to-ship transfers** — "Automatic Detection of Dark Ship-to-Ship Transfers using Deep Learning and Satellite Imagery" ([arXiv:2404.07607](https://arxiv.org/abs/2404.07607)) detected over 400 dark transshipment events in the Kerch Strait since 2022 from satellite imagery cross-referenced with vessel tracking, in the context of the EU ban on port access for vessels suspected of STS-transferring Russian-origin cargo. Grounds the `sts_transfer` facet and the `ais_track_record` source requirement.
- **Dark (AIS-off) vessels** — "Sea-cret Agents: Maritime Abduction for Region Generation to Expose Dark Vessel Trajectories" ([arXiv:2502.01503](https://arxiv.org/abs/2502.01503)) uses abduction and logic programming to locate vessels that disable AIS to conceal illicit activity. Corroborates the `dark_fleet_indicators` facet and why an AIS-continuity gap is a review trigger, not a benign artifact.
- **AIS / GNSS spoofing** — "SeaSpoofFinder – Potential GNSS Spoofing Event Detection Using AIS" ([arXiv:2602.16257](https://arxiv.org/abs/2602.16257)) flags implausible vessel movements and cross-validates anomalies across ships to distinguish spoofing from single-vessel artifacts. Corroborates the `ais_manipulation` facet — spoofing, not only signal gaps.

## Honest traction note

As of 2026-06-03, this worker has zero paying customers, zero named pilot users, and no usage above operator smoke tests. It is shipped as a portfolio-grade, topical vertical worker — a concrete artifact for technical evaluators and a contract real practitioners can inspect — not a claim of production traction. The deployed Cloudflare Worker A2A endpoint and its `wrangler` env are a deploy-time follow-up; the Python service, HTTP route, and A2A profile are live in-package.


## Hosted connection

For remote MCP initialization, free discovery and A2A heartbeat, see the
[hosted quickstart](../deployment/hosted-quickstart.md). Hosted evaluation of your own input requires
the signed payment flow; the saved worked example on the site is free.
