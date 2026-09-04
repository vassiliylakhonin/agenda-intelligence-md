# ADR 0020 — Activate the Snapshot upstream for `cis_secondary_sanctions` (live server-side name screening)

Status: accepted — reactivated 2026-09-04 against a self-owned published index; scoring posture settled 2026-09-04
Date: 2026-06-26
Updated: 2026-09-04

> Operational history. **2026-08-31:** the `SNAPSHOT_INDEX_URL` added by this decision was removed after the
> target returned 404 and no published index could be found. The root cause, established 2026-09-04, was that
> the index lived on the portfolio site at `vassiliylakhonin.github.io`, and that repository no longer exists
> on GitHub — so Pages stopped serving, the index 404'd, and the discovery alias hosted on the same domain
> started failing too. The dependency was on a host this project did not own.
>
> **2026-09-04:** reactivated. The index build (`scripts/sanctions_name_index.py`) and the published
> directory (`deploy/snapshot-site/`) now live in this repository, and the index is served from Cloudflare
> Pages at `https://sanctions-name-index.pages.dev/sanctions-name-index-compact.json` — the same account that
> already runs the worker fleet, so there is one less external party to lose. Rebuilt the same day from the
> four official sources: 84,367 names, verified through the adapter before the URL was set (`VTB BANK` →
> `eu_consolidated_extract`, `SBERBANK OF RUSSIA` and `MADURO MOROS, Nicolas` → `ofac_sdn_extract`, all
> exact; an invented company returns no match).

## Context

[ADR 0014](0014-per-profile-live-retrieval.md) gave the `cis_secondary_sanctions` profile an *opt-in* live-retrieval capability with the activation deferred: two upstreams were declared (Watchman self-host via `WATCHMAN_URL`, OpenSanctions hosted API via `OPENSANCTIONS_API_KEY`) but neither was configured, so the live `cis-secondary-sanctions-a2a` endpoint and the portfolio demo page operated on user-supplied evidence only and advertised "no live retrieval / server-side screening disabled".

Both deferred upstreams carry an activation cost the operator could not justify for a no-revenue portfolio demo: Watchman needs a long-running container (no robust free tier — Render/Fly cold-start reloads the full list set and blows the 6 s fetch budget; only an always-on VM is reliably free, which is real ops burden), and OpenSanctions is paid for commercial use.

A third upstream removes that cost. The portfolio site already builds and publishes a fresh public-list name index (`scripts/sanctions_name_index.py` → OFAC SDN + consolidated, EU consolidated, UK FCDO; 83k names). A compact derivative (`sanctions-name-index-compact.json`, 2.76 MB) is small enough for the worker to fetch and match **in-process**, with no external host and no per-call fee.

## Decision

Add and **activate** a third per-profile upstream, `Snapshot` (`deploy/cloudflare-worker/src/upstream_snapshot.js`), listed first ahead of Watchman and OpenSanctions. The worker fetches the published compact index (cached in module-global scope per isolate, 6 h TTL) and matches with exact normalized-name + significant-token overlap (no per-request Levenshtein; fuzzy stays browser-side). Activation is the declarative var `SNAPSHOT_INDEX_URL` in `wrangler.toml` for the `cis-secondary-sanctions` env, deployed 2026-06-26 (verified: `live_retrieval_status: success`, `upstream: Snapshot`, exact match on a known SDN entity).

This **flips the profile's public posture** from "no live retrieval" to "server-side name screening against a fresh public-list snapshot", which is why this is a recorded ADR and not a silent config change. The portfolio demo page copy and the agent-card text are updated in the same change.

## What a merged match is scored as (2026-09-04)

Activation left one question unanswered, and the two halves of the response answered it differently. The result
builder merges an auto-fetched match into `supplied_sources` — so `minimum_sources_before_review` shrinks and the
evidence half of the response reports the hit — while the exposure, triage, and readiness scorers all
short-circuited on `request.dated_sources`. Those were the same set when the scorers were written; live retrieval
made them different. Since the minimal first pass defaults `dated_sources` to `[]`, a name-only request against a
listed counterparty returned `auto_fetched_sources` naming an OFAC SDN entry under
`secondary_exposure_signal: unknown`, `triage_recommendation: insufficient_information`, and
`decision_readiness_score: 0`.

**Decision: the scorers gate on the effective evidence pack** — what the caller supplied plus what screening
merged — not on the caller's own array. A merged match therefore reaches the `high` branch, an
`escalate_before_*` triage, and a non-zero readiness score.

The alternative was to keep the guard and stop merging matches into `supplied_sources`, on the reasoning that a
snapshot name match is a possible string match rather than identity verification. It was rejected because it
contradicts what this ADR already decided (matches land in `supplied_sources` / `auto_fetched_sources`), it would
make server-side screening change no scored field at all, and it leaves the gate's error pointing the wrong way:
`unknown` / `0` / `insufficient_information` on a live OFAC SDN hit reads to a caller as *nothing was found*.

The posture change is in what the gate is willing to **score**, not in what it **claims**. `high` here means a
name on a public sanctions list resembles this counterparty and a reviewer must resolve it — not that the
counterparty is listed, and not identity, ownership, or 50 % rule resolution. A response carrying a merged match
now states that in `limitations` and names the screening result in the markdown artifact beside the signal, so
the verdict and the evidence say the same thing. `human_review_required` stays unconditionally true, and an
empty effective pack — nobody screened it, or screening matched nothing — still returns `unknown` /
`insufficient_information` / 0.

Only *sanctions-list* matches may raise the signal. Ownership enrichment ([ADR 0022](0022-gleif-ownership-enrichment-cis-secondary-sanctions.md))
contributes auto-fetched sources too, and those are counted separately: a disclosed LEI parent is evidence about
ownership, never a listing signal.

## Boundaries (unchanged)

Activation does **not** widen what the profile claims to do. A snapshot match is a **possible string match only** — not legal-entity identity verification, ownership resolution, 50 % rule determination, or a sanctions/legal/compliance determination. It is a *snapshot* (as fresh as the last index build), not a realtime list query. Human review remains required; `human_review_required` and `not_advice_notice` are still emitted; attribution is surfaced only when a match is actually merged. The core package (`evidence_mode` ∈ `reasoning_only` / `user_provided` / `mixed`) remains live-retrieval-free — Snapshot is a worker-layer upstream, not a core capability.

## Consequences

- While a verified Snapshot URL is configured, the live endpoint returns server-side name matches in `auto_fetched_sources` / `supplied_sources` with `live_retrieval_status: success`. With no configured upstream, it returns `disabled` and uses caller-supplied evidence only.
- Deactivation is one step: set `SNAPSHOT_DISABLED=1` (or remove the var) and redeploy → graceful degrade to evidence-only.
- The snapshot's freshness is bounded by whatever rebuilds `sanctions-name-index-compact.json`; staleness is the maintenance risk to watch.
- Cold-isolate parse of the 2.76 MB index is the one CPU risk; on failure the adapter degrades rather than failing the user request.
