# ADR 0022 — GLEIF ownership enrichment for `cis_secondary_sanctions`

Status: accepted
Date: 2026-07-08

## Context

[ADR 0014](0014-per-profile-live-retrieval.md) allowed per-profile live retrieval and named sanctions-list upstreams (Snapshot, Watchman, OpenSanctions) for the `cis_secondary_sanctions` profile. Those upstreams answer one question: *does the counterparty name match a sanctions/watchlist entry?*

They do not answer the adjacent one the profile's own response repeatedly flags as a gap: *who owns this counterparty?* On the disclosed-ownership path the worker returns `evidence_gaps` such as "No ownership chain evidence supplied" and `minimum_sources_before_review` includes `ownership_chain_evidence`. Today those gaps only close when the caller manually attaches ownership evidence.

[GLEIF](https://www.gleif.org/) publishes the global LEI pool and the Level-2 "who owns whom" relationship data (direct parent, ultimate parent) free of charge under CC0-1.0, via a public JSON:API at `api.gleif.org` with **no API key and no host to run**. This is an openly licensed source for disclosed ownership that can auto-fill the ownership gap for any counterparty that holds an LEI.

ADR 0014 requires a fresh ADR when a new upstream changes the license model, attribution model, or rate-limit shape materially. GLEIF does all three relative to the existing sanctions upstreams (CC0-1.0 vs CC-BY/Apache; no-key public API), and it is a different *kind* of retrieval (ownership, not name-matching). Hence this ADR.

## Decision

Add **GLEIF as an ownership-enrichment upstream** for the `cis_secondary_sanctions` profile, under the ADR 0014 discipline, with these specifics:

1. **Runs alongside, never instead of, the sanctions upstream.** The active sanctions upstream (Snapshot / Watchman / OpenSanctions) and the GLEIF ownership lookup are independent; each may contribute auto-fetched evidence on its own. GLEIF is *not* added to the sanctions `upstream_options` selection list, so it can never be chosen as "the" sanctions upstream.
2. **Off by default.** Enabled only when `env.GLEIF_ENABLED` is truthy (and not `GLEIF_DISABLED`). While unset, behavior is unchanged and the worker never calls `api.gleif.org`. Activation is an operator step (like `WATCHMAN_URL`), and merging the code changes no live behavior.
3. **Disclosed ownership only.** GLEIF reports the parents an entity has declared. Contributed source types are `ownership_chain_evidence` (resolved entity + direct parent) and `beneficial_ownership_source` (ultimate parent). A counterparty with no LEI on file yields a successful, empty result — common for small CIS/forwarder counterparties.
4. **Same boundaries as ADR 0014 hold, unchanged.** `factual_verification: false`, `not_advice: true`, `human_review_required: true`. Resolving an LEI or a disclosed parent is not identity verification and not a determination. The existing agent-card boundary "does not traverse multi-layer beneficial-ownership graphs" remains true: GLEIF supplies disclosed direct/ultimate parent, not hidden or nominee multi-layer structures.
5. **Attribution + graceful degrade** per ADR 0014: GLEIF attribution (CC0-1.0) is surfaced in `limitations` whenever ownership records are merged; any network error, non-200 search, timeout, or unset flag merges no ownership sources and never fails the caller request.

## Consequences

### Positive

- Closes the disclosed-ownership evidence gap automatically for LEI-holding counterparties, at $0 with no host and no key.
- Keeps the sanctions and ownership retrievals cleanly separated: one can degrade without affecting the other.
- Establishes the "enrichment upstream that runs alongside" pattern; future ownership/trade sources (e.g. a paid deep-UBO or bill-of-lading upstream) plug in the same way.

### Negative

- Coverage is limited to entities with an LEI; many small CIS counterparties have none, so the gap often remains (surfaced honestly, not hidden).
- One more per-profile boundary-metadata variant; `SOURCE_POLICY.md` gains an ownership-enrichment row and note.

### Out of scope

- Deep/hidden beneficial-ownership resolution (nominee, multi-layer) — needs a paid corporate-intelligence upstream, added later via the same alongside-enrichment mechanism, gated on demand.
- A Python service-layer twin of the GLEIF adapter. This ADR ships the Cloudflare Worker path (which serves the live A2A endpoint); a Python parity adapter is a follow-up if the stdio/HTTP surfaces need the same enrichment.
