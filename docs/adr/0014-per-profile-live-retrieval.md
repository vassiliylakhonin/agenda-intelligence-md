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

## Update 2026-05-27 — runtime activation deferred (capability remains)

The architectural pattern in this ADR (per-profile capability declaration, env-derived runtime activation, graceful degrade) stays in force. **Runtime activation of OpenSanctions live retrieval is deferred indefinitely** for the following reasons surfaced after the original ADR shipped:

1. **The OpenSanctions hosted API is paid (€0.10/call, pay-as-you-go).** The earlier assumption that the public match API was free was wrong. A 30-day business-email trial exists, but ongoing use is metered.
2. **Cost-per-probe is meaningful.** Agenstry uptime probes from BE hit the existing workers ~24 times/week per worker (observed in `/stats`). Activating live retrieval without a cost-guard would burn ~€10/month per worker on probes alone, against zero confirmed buyers.
3. **Self-host of bulk OpenSanctions CC-BY data is real engineering work** (~3-6 hours) and gives meaningfully worse matching than Yente (no transliteration / fuzzy match / cross-list dedupe / scoring). Compliance practitioners specifically distrust homebrew matching engines — that's exactly what they pay vendors like Refinitiv / Dow Jones / Castellum / Sayari for. Self-host would undermine the positioning we're trying to build.
4. **There is no confirmed buyer for `cis_secondary_sanctions` today.** `/stats` shows zero external non-probe traffic for the seven days since the profile shipped. Paying a per-call vendor fee for a product with no demand is the classic sunk-cost trap that AGENTS.md "Honesty rules" and the global CFO discipline tell us to refuse.

### What changes in code

- `LIVE_RETRIEVAL_PROFILES` in both `src/agenda_intelligence/a2a_adapter.py` and `deploy/cloudflare-worker/src/index.js` now declares **capability** rather than activation. Two new fields: `activation_env_var` and `disable_env_var`.
- New helper `is_live_retrieval_active(profile)` (Python) / `isLiveRetrievalActive(profile, env)` (JS) returns `True` iff the activation env var is set and the disable env var is not. Currently always returns `False` since `OPENSANCTIONS_API_KEY` is unset on all deployed workers.
- Agent card `x_agenda_intelligence.per_profile_live_retrieval` and `x_agenda_intelligence.live_retrieval` blocks now expose `{capability_declared, active, ...}` instead of `{live_retrieval: True, ...}`. Active is env-derived.
- `/status` `boundaries.live_retrieval` reflects actual activation (`false` until a key is wired). When deferred, `/status` includes a `live_retrieval.deferral_note` explaining why.

### What does NOT change

- The schemas under `schemas/v1/cis-secondary-sanctions-*.schema.json` — additive contract preserved.
- The service function `services.cis_secondary_sanctions_exposure` — still works on user-supplied evidence, still graceful-degrades on missing key (just always degrades now).
- The `cis_secondary_sanctions` A2A profile and the deployed `cis-secondary-sanctions-a2a` Cloudflare Worker — both still live, still accept structured requests, still return auditable triage.
- The SOURCE_POLICY whitelist — OpenSanctions remains the named upstream for this profile when activation eventually happens.

### Path to re-activation

Re-activate by configuring `OPENSANCTIONS_API_KEY` (either as an env var for the Python service or via `wrangler secret put OPENSANCTIONS_API_KEY --env cis-secondary-sanctions` for the Worker). No redeploy or new ADR needed. Before doing so, the operator SHOULD have:

1. A defensible answer to "who will use this and what does it cost per month at our expected call volume?"
2. A cost-guard that skips OpenSanctions fetch on `likely_probe === true` requests (not implemented yet; trivial follow-up).
3. A monthly spend cap (Cloudflare-side via tail-log monitoring, or a daily-counter KV gate, or simply by relying on OpenSanctions's billing cap).

If those conditions are not met, leave the capability deferred. A `live_retrieval: false` claim that is true is worth more than a `live_retrieval: true` claim backed by a paid API the project can't afford to keep running.

### Alternatives reconsidered

- **Self-host bulk OpenSanctions data (CC-BY 4.0).** Architecturally sound for zero ongoing cost, but rejected for now: (a) much weaker matching engine than Yente; (b) compliance buyers distrust homebrew matching as a class; (c) sunk-cost risk — once built, hard to abandon even without buyers. Kept on the roadmap as an option if and when a concrete buyer materializes who is willing to validate the matching quality is "good enough" for their use case.
- **Pay €0.10/call from day one against trial allowance.** Rejected: 30 days of trial gives illustrative matches but no buyer-validation signal; after trial we'd either keep paying or revert anyway.
