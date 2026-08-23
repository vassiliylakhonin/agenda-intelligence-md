# Agenstry conformance checklist

How the Agenda Intelligence A2A workers map onto Agenstry's published 9-criterion conformance scoring ([schema](https://agenstry.com/api/schemas/conformance.json)). Factual snapshot, not a marketing claim — re-check against the live `/agents/<domain>` page, which is the source of truth.

Workers (all on `*.vassiliy-lakhonin.workers.dev`):

| Worker | Domain | Profile |
|---|---|---|
| General triage | `agenda-intelligence-a2a` | `agenda` |
| Middle Corridor Deal Risk Gate | `middle-corridor-deal-risk-gate-a2a` | `kazakhstan` |
| CIS Secondary-Sanctions Exposure | `cis-secondary-sanctions-a2a` | `cis_secondary_sanctions` |
| Agentic Interaction Trust Gate | `agentic-interaction-trust-a2a` | `agentic_interaction_trust` |
| Gulf Maritime Exposure | `gulf-maritime-exposure-a2a` | `gulf_maritime_exposure` |
| Kazakhstan Market-Entry Readiness | `kazakhstan-market-entry-readiness-a2a` | `market_entry_readiness` |

## Criteria (weight) → status

| Criterion | Weight | Status | Where |
|---|---:|---|---|
| `valid_card` — schema-validates against A2A v1.0 | 10 | ✅ since 2026-08-23 | Failed until then: the card carried `support`, `x_agenda_intelligence` and a top-level `signature` at the root plus `provider.legalEntity`, none of which the A2A v1 `AgentCard` schema defines. An independent scan on 2026-08-23 caught it. Vendor data now travels in `capabilities.extensions[]`; checked by `npm run verify:agent-card` and by unit test against the closed field set |
| `live_responds` — answers its version-negotiated A2A message method | 25 | ✅ | live smoke examples in [demo-pack.md](demo-pack.md) |
| `protocol_version` — declares `protocolVersion = "1.0"` (string) | 10 | ⚠ see note | The A2A v1 `AgentCard` schema has no root `protocolVersion`; version is declared per interface in `supportedInterfaces[].protocolVersion`, which every card sets to `"1.0"`. A root field cannot be added back without failing `valid_card` |
| `signature` — JWS signature that verifies against the published JWKS | 10 | ✅ | `signatures` per A2A v1 §8.4.2 (JWS RFC 7515, JCS RFC 8785); public key at `/.well-known/jwks.json`; signing flow in [deploy/cloudflare-worker/README.md](../../deploy/cloudflare-worker/README.md) |
| `uptime` — share of Agenstry probes succeeding over 30d | 15 | ⏳ accumulating | Cloudflare Workers; recovers automatically after the Agenstry probe-library gzip bug was fixed 2026-05-27 |
| `skills` — non-empty `skills[]` with id + name | 10 | ✅ | each card declares its product skill(s) |
| `verified_identity` — provider attribution plus authoritative-registry match | 10 | ❌ | individual publisher, no legal-entity registration; not pursued |
| `freshness` — recent upstream sighting plus capability flags | 5 | ✅ | continuous probing |
| `security` — declared security scheme | 5 | partial | `securityRequirements: []` — deliberately public, which the criterion scores 2 of 5 |

Criterion ids and weights above were re-read from the live schema (version 1.1) on 2026-08-23. An earlier version of this table used ids Agenstry no longer publishes (`jws_signature`, `provider_attribution`, `business_identity`, `uptime_track`) and asserted `valid_card` as met when it was not.

**Expected grade:** not computed here. Five of the nine criteria are scored from Agenstry's own measurement record rather than from the card, so a total worked out from this table would not match theirs. The one deliberate structural miss is `verified_identity` (−10): published as an individual, not a company.

## Ownership verification

Per [Damiën / Agenstry, 2026-05-27], three ownership-proof methods:

- `vassiliylakhonin.github.io` — verified via `well_known` (`/.well-known/agenstry-verify`). ✅
- Worker domains — verified via `jws` (JWKS round-trip against the card signature in `signatures`; no token, no file). The strongest method.

## Boundaries (declared on every card / `/status`)

- `not_advice: true` — no legal / compliance / sanctions / financial / investment advice.
- `factual_verification: false` — schemas enforce structure, not truth.
- `live_retrieval: false` by default; active only for `cis_secondary_sanctions` through the $0 Snapshot upstream, with Watchman / OpenSanctions as optional alternates — see [ADR 0014](../adr/0014-per-profile-live-retrieval.md), [ADR 0020](../adr/0020-activate-snapshot-upstream-cis-secondary-sanctions.md), and [SOURCE_POLICY.md](../../SOURCE_POLICY.md).
- `human_review_required: true` on every vertical-worker response.

## Not done (deliberate)

- **No payments / wallet rails.** No x402 pricing block, no Stripe Connect. The workers are free; monetization is not wired and no first-paying-customer hypothesis is on file. Payment-readiness would be evidence-before-action triage, not settlement — out of scope until a real caller materializes.
- **No business identity (LEI/KvK).** Individual publisher.
