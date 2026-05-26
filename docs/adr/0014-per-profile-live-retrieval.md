# ADR 0014 — Per-profile live retrieval (OpenSanctions for `cis_secondary_sanctions`)

Status: accepted
Date: 2026-05-26

## Context

Until v1.0.1, all surfaces of the runtime (MCP server, HTTP API, A2A adapter, Cloudflare Worker) declared the boundary `live_retrieval: false`. The `analyze` MCP tool and every vertical worker accepted only user-supplied sources via the `dated_sources` or `evidence_mode: user_provided` paths. This was a deliberate positioning choice (see [AGENTS.md](../../AGENTS.md) "It is NOT a live source retrieval engine") and reduced the surface area for adversarial inputs.

A gap analysis of the Agenstry agent marketplace (71,664 agents indexed 2026-05-26) identified **secondary-sanctions exposure scoring for CIS-domiciled counterparties** as an underserved niche (0 agents covering OFAC EO 14114 / EU 14th package / UK OFSI specifically for Kazakhstan, Uzbekistan, Georgia, etc. counterparties). To deliver a non-trivial product in this niche, the runtime needs to consult a canonical, regularly-updated sanctions dataset rather than ask the caller to attach SDN list extracts manually.

[OpenSanctions](https://www.opensanctions.org/) publishes a consolidated dataset (OFAC SDN, EU consolidated, UK OFSI, UN Security Council, EAG, and ~200 other sources) under CC-BY 4.0. It exposes a free public API at `api.opensanctions.org` with rate limits, plus downloadable bulk datasets. This is the only open canonical source for this niche.

## Decision

Allow **per-profile live retrieval** scoped to specific vertical-worker profiles. The default remains `live_retrieval: false`.

A profile that performs live retrieval MUST:

1. Declare `live_retrieval: true` in its agent card and in every `/status`, `/health`, and agent-manifest surface that exposes profile-level boundaries.
2. Name the upstream(s) it queries explicitly (no opaque retrieval).
3. Cache responses with attribution and TTL.
4. Tolerate upstream failure by gracefully degrading to user-supplied sources only, surfacing `live_retrieval_status: degraded` in the response.
5. Surface upstream attribution in every response that incorporates upstream data, per the upstream's license (e.g., CC-BY 4.0 for OpenSanctions).
6. Not retrieve PII or any data outside the published, openly-licensed scope of the named upstream.

The boundaries that remain unchanged for live-retrieval-enabled profiles:

- `factual_verification: false` — matching a counterparty name against a sanctions list extract is not the same as verifying that the matched entity is in fact the same legal entity as the caller's counterparty. The schema still requires `human_review_required: true`.
- `not_advice: true` — no legal, sanctions, compliance, financial, investment, insurance, or trading advice.
- `human_review_required: true` for the response.

The first profile under this decision is `cis_secondary_sanctions`, which queries the OpenSanctions consolidated dataset for the supplied counterparty name and adds matched entries as auto-fetched `dated_source` entries with `source_type: ofac_sdn_extract` / `eu_consolidated_extract` / `uk_ofsi_extract` (mapped from the OpenSanctions `datasets` field) and `notes: "Auto-fetched from OpenSanctions; CC-BY 4.0 attribution required"`. The full attribution string is also surfaced in the response `limitations` array.

## Consequences

### Positive

- The runtime can deliver `cis_secondary_sanctions_exposure` without requiring the caller to manually attach SDN list extracts on every call.
- The per-profile scope keeps `agenda` and `kazakhstan` profiles' public claims intact — no need to re-issue agent cards for already-deployed surfaces.
- The decision generalizes: future profiles can add other named upstreams (Sayari, ICIJ Offshore Leaks, etc.) through the same mechanism without re-opening this ADR.

### Negative

- New external dependency on OpenSanctions API availability and rate limits. Mitigated by graceful degrade (see SOURCE_POLICY).
- Per-profile boundary metadata is now non-uniform across the runtime. Agent cards, `/status`, `/health`, and any documentation that previously asserted a global `live_retrieval: false` must qualify the claim ("default false; enabled for named vertical-worker profiles — see manifest").
- License attribution requirement adds boilerplate to every response that incorporates upstream data.

### Out of scope

- Live retrieval inside the Cloudflare Worker JS runtime. The Python service layer ships first; worker-side live retrieval is a follow-up that requires bundling a JS HTTP client and adding KV-cache logic in `deploy/cloudflare-worker/src/index.js`. Until then, the worker forwards live-retrieval-enabled requests to the self-hosted HTTP API or returns `live_retrieval_status: degraded` with user-supplied-only triage.
- Additional upstreams beyond OpenSanctions for `cis_secondary_sanctions`. Adding any new upstream is a same-shape decision recorded as a CHANGELOG entry and a SOURCE_POLICY whitelist update; no new ADR required unless the upstream's license, attribution model, or rate-limit shape is materially different.

## Alternatives considered

- **Pre-fetch and vendor a snapshot of OpenSanctions inside the package.** Rejected: the dataset updates daily; vendored snapshots would go stale and create a false sense of currency. Also bloats the package.
- **Require the caller to attach SDN extracts via existing `dated_sources` (no boundary change).** Rejected: this is what every other compliance tool already does. The differentiator is auto-fetch with explicit attribution and degrade.
- **Add live retrieval globally (drop `live_retrieval: false` everywhere).** Rejected: invalidates existing agent-card claims; widens attack surface for adversarial inputs across profiles that don't need it.

## References

- [SOURCE_POLICY.md](../../SOURCE_POLICY.md) — updated to declare the per-profile whitelist and attribution / degrade requirements.
- [AGENTS.md](../../AGENTS.md) — "Honesty rules" section continues to forbid claims of live retrieval beyond what is actually implemented; this ADR documents the implementation.
- OpenSanctions API: https://api.opensanctions.org
- OpenSanctions data license: CC-BY 4.0 (https://www.opensanctions.org/licensing/).
