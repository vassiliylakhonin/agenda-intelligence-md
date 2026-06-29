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
| `valid_card` — schema-validates against A2A v1.0 | 10 | ✅ | `/.well-known/agent-card.json` on each domain |
| `live_jsonrpc` — `message/send` responds < 10s | 25 | ✅ | live smoke examples in [demo-pack.md](demo-pack.md) |
| `protocol_version` — declares `"1.0"` (string) | 10 | ✅ | `protocolVersion: "1.0"`; response body is genuinely A2A v1.0-shaped (member-discriminated parts + `mediaType`, `TASK_STATE_*` enums) per [ADR 0017](../adr/0017-a2a-wire-contract-v1.md) — the score is earned, not just asserted |
| `jws_signature` — card carries valid ES256 JWS | 10 | ✅ | detached JWS per RFC 7515 §3.1 + RFC 7797, JCS RFC 8785; public key at `/.well-known/jwks.json` (see [ADR 0014](../adr/0014-per-profile-live-retrieval.md) is unrelated; signing flow in [deploy/cloudflare-worker/README.md](../../deploy/cloudflare-worker/README.md)) |
| `uptime_track` — ≥90% probe success / 30d | 15 | ⏳ accumulating | Cloudflare Workers; recovers automatically after the Agenstry probe-library gzip bug was fixed 2026-05-27 |
| `skills_declared` — non-empty `skills[]` with id+name | 10 | ✅ | each card declares its product skill(s) |
| `provider_attribution` — `provider.name` + `provider.url` | 10 | ✅ | Vassiliy Lakhonin / vassiliylakhonin.github.io |
| `freshness` — last probe < 24h | 5 | ✅ | continuous probing |
| `business_identity` — LEI / KvK / Companies House matched | 5 | ❌ | individual publisher, no legal-entity registration; not pursued |

**Expected grade:** ~B (≈80–95/100 depending on uptime window). The only structural miss is `business_identity` (−5), which is intentional — published as an individual, not a company.

## Ownership verification

Per [Damiën / Agenstry, 2026-05-27], three ownership-proof methods:

- `vassiliylakhonin.github.io` — verified via `well_known` (`/.well-known/agenstry-verify`). ✅
- Worker domains — verified via `jws` (JWKS round-trip against the card signature; no token, no file). The strongest method.

## Boundaries (declared on every card / `/status`)

- `not_advice: true` — no legal / compliance / sanctions / financial / investment advice.
- `factual_verification: false` — schemas enforce structure, not truth.
- `live_retrieval: false` by default; active only for `cis_secondary_sanctions` through the $0 Snapshot upstream, with Watchman / OpenSanctions as optional alternates — see [ADR 0014](../adr/0014-per-profile-live-retrieval.md), [ADR 0020](../adr/0020-activate-snapshot-upstream-cis-secondary-sanctions.md), and [SOURCE_POLICY.md](../../SOURCE_POLICY.md).
- `human_review_required: true` on every vertical-worker response.

## Not done (deliberate)

- **No payments / wallet rails.** No x402 pricing block, no Stripe Connect. The workers are free; monetization is not wired and no first-paying-customer hypothesis is on file. Payment-readiness would be evidence-before-action triage, not settlement — out of scope until a real caller materializes.
- **No business identity (LEI/KvK).** Individual publisher.
