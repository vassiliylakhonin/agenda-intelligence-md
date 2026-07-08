# SOURCE_POLICY.md

Reasoning is not enough. Agenda-analysis agents need source discipline.

Use this policy before writing briefs about public agenda, policy, regulation, sanctions, elections, conflict, energy, trade, markets, technology, or strategic risk.

## Core rule

Generate a source plan before analysis when facts are current, contested, legal, financial, operational, or high-stakes.

If live retrieval fails or is not available, say so and downgrade evidence mode.

## Evidence modes

- **live_source_backed** — current sources were checked during the analysis workflow, not necessarily by this package.
- **user_provided** — analysis relies on sources/facts supplied by the user.
- **reasoning_only** — no live verification; answer is based on general knowledge and stated assumptions.
- **mixed** — combination of the above.

## Source hierarchy

Prefer:

1. Primary legal/official sources.
2. Regulator, central bank, court, parliament, procurement, sanctions-list, company filing, or standards sources.
3. Direct company/institution statements.
4. Reputable data sources and trade/market datasets.
5. Media, expert, think-tank, consultancy, or analyst commentary as supporting evidence.

Do not use commentary as a substitute for legal text, regulator guidance, filings, procurement records, enforcement actions, or official data when those are required.

## Claim discipline

For every important claim, identify:

- what source type would support it;
- whether the claim is supported, partially supported, or unsupported;
- what evidence would confirm, weaken, or falsify it.

Tag claims inline in markdown output using the provenance system from `references/evidence-discipline.md`:
- Axis A (one per claim): `[primary]` `[secondary]` `[user-provided]` `[inference]` `[analyst-judgment]`
- Axis B (optional): `[verify]` `[stale-risk: YYYY-MM]`

Tags are additive to document-level evidence mode. Use both.

## Do not claim without evidence

- Binding legal obligation without legal text or regulator guidance.
- Sanctions designation without official list or legal instrument.
- Enforcement trend without enforcement actions, penalties, seizures, customs detentions, or regulator statements.
- Market impact without price, filing, company behavior, tender/procurement, or transaction evidence.
- Election outcome or legitimacy shift without official results, polling methodology, legal challenge, or observer reporting.
- Conflict escalation without credible operational indicators.
- Energy disruption without production, shipping, pipeline, inventory, OPEC+, or market data.
- AI/technology policy implementation without legal text, budget, procurement, standards, infrastructure, or deployment evidence.

## Source plan workflow

1. Classify the task category.
2. Load the matching source requirement pack from `source-requirements/`.
3. Identify must-check source types.
4. Check primary sources first when available.
5. Mark missing `must_check` source types as evidence gaps.
6. Mark unsupported claims explicitly.
7. Then write the brief using `Agenda-Intelligence.md`.

Missing `must_check` coverage is diagnostic before v1.0. It should weaken or block a claim when the missing source is load-bearing, but it is not a base schema-validation failure unless a future strict source-plan gate is explicitly used.

## Failure handling

If source access fails:

```text
Evidence access limited: live retrieval failed or was unavailable. Treat this as reasoning-only or mixed analysis, not source-backed analysis.
```

Then provide a source plan and the safest useful assessment.

## Per-profile live retrieval (vertical workers)

The product runtime defaults to `live_retrieval: false`. Specific vertical-worker profiles may opt in to live retrieval against a named upstream from the whitelist below, per ADR 0014.

### Upstream whitelist

| Upstream | License | Used by profile | Activation status | Purpose |
|---|---|---|---|---|
| Snapshot (compact public-list name index, fetched from the portfolio site) | Public official lists (OFAC SDN + consolidated, EU, UK FCDO) | `cis_secondary_sanctions` (preferred, $0) | **Active** — `SNAPSHOT_INDEX_URL` set, deployed 2026-06-26 (ADR 0020) | Counterparty name → exact + token-overlap matches against a fresh public-list snapshot, matched in-worker (no external host) |
| Watchman (`moov-io/watchman`, self-host) | Apache-2.0 | `cis_secondary_sanctions` (self-host option) | **Deferred** until operator sets `WATCHMAN_URL` (self-host on free-tier container) | Counterparty name → matched OFAC SDN / EU consolidated / UK OFSI / UN entries with `match` score |
| OpenSanctions consolidated dataset (`api.opensanctions.org`) | CC-BY 4.0 (data); hosted API is paid €0.10/call | `cis_secondary_sanctions` (paid fallback) | **Deferred** until operator sets `OPENSANCTIONS_API_KEY` | Counterparty name → matched SDN / EU consolidated / UK OFSI / UN entries with Yente fuzzy match scoring |
| GLEIF LEI relationship pool (`api.gleif.org`) | CC0-1.0 (public domain, no key) | `cis_secondary_sanctions` (ownership enrichment, $0) | **Deferred** until operator sets `GLEIF_ENABLED` (no key, no host) | Counterparty name → resolved LEI + disclosed direct/ultimate parent as `ownership_chain_evidence` / `beneficial_ownership_source`; disclosed relationships only, not hidden or multi-layer beneficial ownership |

Adding a new upstream requires a CHANGELOG entry and a row in this table. A new ADR is required only when the new upstream changes the license model, attribution model, or rate-limit shape materially.

Ownership-enrichment upstreams (currently GLEIF, per ADR 0022) run **alongside** the sanctions-list upstream, not instead of it: the sanctions match and the ownership lookup are independent, and either may contribute auto-fetched evidence on its own. GLEIF changes the license model (CC0-1.0) and the retrieval kind (disclosed ownership rather than sanctions-list name matching), which is why it is recorded as its own ADR rather than a bare whitelist row.

**Activation status** indicates whether the runtime actually consults the upstream. `Deferred` means the capability is wired in code and declared in the agent card, but the operator has not configured the relevant credential env var (e.g. `OPENSANCTIONS_API_KEY`). In that state the profile responds with `live_retrieval_status: disabled` and triage falls back to user-supplied evidence only — exactly as specified in the graceful-degrade requirements below.

### Requirements for live-retrieval-enabled profiles

1. **Declare**: `live_retrieval: true` in agent card, `/status`, `/health`, and agent-manifest. Name the upstream(s) consulted. No opaque retrieval.
2. **Cache**: Cache responses with TTL appropriate to the upstream's update cadence (daily for OpenSanctions). Honor `Cache-Control` headers when present.
3. **Attribute**: Surface the upstream's license attribution in every response that incorporates upstream data. For CC-BY 4.0 this MUST include the upstream's name, a link to the upstream, and the license identifier.
4. **Degrade gracefully**: On upstream failure (network error, 429, 5xx, timeout), the profile MUST NOT fail the request. It MUST return its normal triage shape with `live_retrieval_status: degraded` and a note that the response is based on user-supplied evidence only.
5. **Stay in scope**: Only retrieve data within the published, openly-licensed scope of the named upstream. Do not retrieve PII, do not bypass rate limits, do not store retrieved content beyond the cache TTL.

### Boundaries that remain unchanged for live-retrieval-enabled profiles

- `factual_verification: false` — name match against a sanctions list is not legal-entity identity verification.
- `not_advice: true` — no legal / compliance / sanctions / financial / investment / insurance / trading advice.
- `human_review_required: true` for the response.

### Live retrieval status values

- `not_attempted` — profile does not use live retrieval; baseline for `live_retrieval: false` profiles.
- `success` — upstream returned a usable response; results merged into evidence.
- `degraded` — upstream returned an error, timeout, or no match; response based on user-supplied evidence only.
- `disabled` — profile supports live retrieval but the caller or operator disabled it for this call (e.g., via header or env flag).
