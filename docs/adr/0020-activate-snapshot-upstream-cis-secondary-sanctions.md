# ADR 0020 — Activate the Snapshot upstream for `cis_secondary_sanctions` (live server-side name screening)

Status: accepted
Date: 2026-06-26

## Context

[ADR 0014](0014-per-profile-live-retrieval.md) gave the `cis_secondary_sanctions` profile an *opt-in* live-retrieval capability with the activation deferred: two upstreams were declared (Watchman self-host via `WATCHMAN_URL`, OpenSanctions hosted API via `OPENSANCTIONS_API_KEY`) but neither was configured, so the live `cis-secondary-sanctions-a2a` endpoint and the portfolio demo page operated on user-supplied evidence only and advertised "no live retrieval / server-side screening disabled".

Both deferred upstreams carry an activation cost the operator could not justify for a no-revenue portfolio demo: Watchman needs a long-running container (no robust free tier — Render/Fly cold-start reloads the full list set and blows the 6 s fetch budget; only an always-on VM is reliably free, which is real ops burden), and OpenSanctions is paid for commercial use.

A third upstream removes that cost. The portfolio site already builds and publishes a fresh public-list name index (`scripts/sanctions_name_index.py` → OFAC SDN + consolidated, EU consolidated, UK FCDO; 83k names). A compact derivative (`sanctions-name-index-compact.json`, 2.76 MB) is small enough for the worker to fetch and match **in-process**, with no external host and no per-call fee.

## Decision

Add and **activate** a third per-profile upstream, `Snapshot` (`deploy/cloudflare-worker/src/upstream_snapshot.js`), listed first ahead of Watchman and OpenSanctions. The worker fetches the published compact index (cached in module-global scope per isolate, 6 h TTL) and matches with exact normalized-name + significant-token overlap (no per-request Levenshtein; fuzzy stays browser-side). Activation is the declarative var `SNAPSHOT_INDEX_URL` in `wrangler.toml` for the `cis-secondary-sanctions` env, deployed 2026-06-26 (verified: `live_retrieval_status: success`, `upstream: Snapshot`, exact match on a known SDN entity).

This **flips the profile's public posture** from "no live retrieval" to "server-side name screening against a fresh public-list snapshot", which is why this is a recorded ADR and not a silent config change. The portfolio demo page copy and the agent-card text are updated in the same change.

## Boundaries (unchanged)

Activation does **not** widen what the profile claims to do. A snapshot match is a **possible string match only** — not legal-entity identity verification, ownership resolution, 50 % rule determination, or a sanctions/legal/compliance determination. It is a *snapshot* (as fresh as the last index build), not a realtime list query. Human review remains required; `human_review_required` and `not_advice_notice` are still emitted; attribution is surfaced only when a match is actually merged. The core package (`evidence_mode` ∈ `reasoning_only` / `user_provided` / `mixed`) remains live-retrieval-free — Snapshot is a worker-layer upstream, not a core capability.

## Consequences

- The live `cis-secondary-sanctions-a2a` endpoint now returns server-side name matches in `auto_fetched_sources` / `supplied_sources` with `live_retrieval_status: success`.
- Deactivation is one step: set `SNAPSHOT_DISABLED=1` (or remove the var) and redeploy → graceful degrade to evidence-only.
- The snapshot's freshness is bounded by whatever rebuilds `sanctions-name-index-compact.json`; staleness is the maintenance risk to watch.
- Cold-isolate parse of the 2.76 MB index is the one CPU risk; on failure the adapter degrades rather than failing the user request.
