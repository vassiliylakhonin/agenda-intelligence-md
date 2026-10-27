# OpenResearch → Middle Corridor & Caspian Research Desk
Date: 27 October 2026. Evidence mode: current primary-source research plus inspected local code. Status: design recommendation, not implemented or commercially validated.

## Decision workspace
- Goal: decide what to borrow from OpenResearch and identify one useful agent-facing regional research service.
- Trusted evidence: pinned OpenResearch review; inspected Agenda/Corridor/regional sources; official World Bank, TITR, CAREC Institute, EDB and Cloudflare sources cited below.
- Suspected unreliable evidence: search snippets without full documents, old route forecasts, announcements mistaken for commissioned capacity, publication dates mistaken for observation dates, popularity mistaken for demand.
- Assumptions: clients need a reusable sourced result; official documents remain accessible under appropriate use terms; one bounded question can be answered with a controlled retrieval/model budget.
- Intended next action: document a bounded research-job design and source-backed commercial hypotheses.
- Stop/escalate if: a source cannot support a material conclusion; current route data are unavailable; source rights or private-document terms are unclear; a task requires operational commitment or publication without its owner's approval.

## Recommendation
Develop one experimental product surface, **Middle Corridor & Caspian Research Desk**, producing a dated research brief and subsequent update for a specific route, infrastructure project or policy question. Its agent interface returns both a readable artifact and structured evidence. The service sells useful research production and updates. It can be an agent-facing research desk while a named professional remains responsible for expert interpretation and consequential use.

Reuse existing canonical methods and transport/payment components. The missing capability is controlled source collection plus server-side research execution, not another domain prompt or evidence-readiness score. Start with one bounded brief; expand after acceptance and paid continuation are observed.

## What OpenResearch contributes
See [the detailed pinned source review](openresearch-source-review-2026-10-27.md), based on commit b3105858d1d9d8c9579eefa511ae33e542b6378a.

OpenResearch is a local-first Rust CLI/desktop harness integrating coding agents, scholarly discovery, experiment history, logs/artifacts and compute. [Pinned README](https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/README.md).

Borrow:
1. Bounded discovery → deduplicate → read supporting sources → synthesize, with explicit publication windows and recorded failures. [Literature skill](https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/agent-skills/orx-lit-review/SKILL.md).
2. A durable record of each research run and its artifacts, adapted from experiment metadata to scope, sources, claims, costs, versions and output. [Run store](https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/store.rs#L230-L266), [report procedures](https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/agent-skills/orx-reports/SKILL.md).
3. Preserve completed results and branch updates with an explicit evidence/conclusion delta. The source's experiment-tree immutability is an instruction pattern; do not claim database-enforced immutability. [Experiment skill](https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/agent-skills/orx-experiment-tree/SKILL.md).

The inspected discovery providers are scholarly sources (alphaXiv/OpenAlex/bioRxiv/PubMed). Their presence does not supply a regional port, railway, customs or procurement source engine. Full-text coverage varies by provider. Repository MIT permission does not grant third-party content/service rights. The full desktop/shell/experiment-compute process is not a drop-in Worker module. No downloaded code or research API was executed during this assessment.

## Existing portfolio seams
Inspected local revisions:
- Agenda: 5547161c4380a7dbc174cf99ab3e9151a1f44b47.
- Corridor: 928d92d86a3bb4ed9e71a5c5fa3fe0be2e653721.
- Central Asia & Caspian: 4946de0361361c528e668f65b640de62cfb7ac5c.

| Component | Existing contribution | Research-service addition |
|---|---|---|
| Global Think Tank Analyst | Memo structure, alternatives, assumptions, uncertainty and evidence handoff | Run the method against newly retrieved, dated evidence |
| Central Asia & Caspian | Regional mechanisms and primary-source classes | Implement source connectors and freshness handling separately |
| Corridor Bankability Analyst | Document templates, method bundle, private bounded jobs and reviewer submissions | A separate research-job contract feeding produced documents |
| Agenda | Deterministic supplied-evidence checks and reference normalization | Check the assembled source/claim packet before output |
| Vizier | Scoped permissions and approval for consequential actions | Optional exact-version approval for publication/export to external systems |

Agenda product.py explicitly has no live source retrieval; deep_dive is a stub. It can call Anthropic when configured or return host-completion scaffolding. The separate Corridor document_jobs.py explicitly says the calling agent writes/reviews the document; its server records submissions and does not run a model/audit. Its inline-source contract does not fetch caller URLs. These are important distinctions from a hosted researcher which independently collects sources.

Canonical regional reasoning stays in the existing skill repositories. No new canonical regional method was created here. Existing proposal-compliance-review jobs retain their closed supplied-pack boundary; adding live sources to that workflow silently would violate its purpose.

## Three outputs, one product
| Proposed mode | Example question | Produced result | Buyer hypothesis |
|---|---|---|---|
| Research brief — first priority | What changed on the Aktau/Kuryk–Alat–Poti route in the past 30 days, and which constraints matter for this project? | 2–4 page dated memo, source/claim table, conflicting evidence, missing operational data | Advisory firms, programme teams, logistics strategy teams |
| Update an existing brief | Which findings changed since this approved version, and why? | Added/changed/withdrawn claims, new evidence, unchanged-but-stale findings, new version | The same team preparing recurring committee or client updates |
| Project evidence note | What stage is this terminal/rail/port project actually at, and what blocks the next decision? | Announced/financed/tendered/contracted/under-construction/operational status with individual dated support; implications and questions for the owner | Project preparation advisers, EPC/business-development teams, IFI subcontractors |

A source saying a project is planned is not evidence that financing is committed or operations have started. Preserve overlapping route definitions, cargo/container differences, TEU versus tonnes, design versus observed capacity, observation period and revision history. An online tariff is not an executable quote or a confirmed slot.

## Why the topic is timely — observed sources versus inference
1. On **28 September 2026**, the World Bank published a new regional corridor report emphasizing operations, service delivery, cross-border coordination and digital information alongside infrastructure. Its recommendations include a shared digital corridor entry point and performance monitoring. These are signals for coordination/documentation research; they are not a mandate to build our product or proof of a buyer. [Press release](https://www.worldbank.org/en/news/press-release/2026/09/28/trans-caspian-transport-corridor-investments-spur-growth-and-create-millions-jobs), [report overview](https://www.worldbank.org/en/region/eca/publication/world-class-trade-logistics-along-trans-caspian-transport-corridor).
2. TITR publishes distinct **2026** feeder-via-Alat, feeder-via-Govsan, ferry-container and wagon tariff tables. This gives a concrete initial official document family with meaningful scope/effective-date differences. No tariff amounts or transit SLA were validated in this assessment. [Official tariff index](https://middlecorridor.com/en/for-clients/tariffs).
3. On **17 September 2026**, CAREC Institute announced a joint ADB consulting study on AI in transport, reference E-048335-002 / selection 227922. This supports that institutions commission work at the AI/transport intersection. The CMS assignment details, deadline and present open/closed status were not checked; this is not represented as an available lead. [Official announcement](https://www.carecinstitute.org/news/call-for-applicants-flagship-study-on-ai-in-transportation-in-carec-region/).
4. CAREC's **23 June 2026** dialogue used **2024** CPMM data and discussed operational/data-sharing gaps. This illustrates why a retrieval service must distinguish publication time from the period observed. [Official account](https://www.carecinstitute.org/news/carec-institute-hosts-cpmm-policy-dialogue-to-advance-regional-connectivity/).
5. Existing substitutes are substantial: EDB already publishes a project observatory and interactive map, updated from open sources, with a 2026 report. A generic project directory would overlap with an established public product. The inferred opportunity is a question-specific, source-linked deliverable and update, rather than completeness of a map. [EDB observatory](https://www.eabr.org/en/analytics/all-publications/transport-corridors-infrastructure/).

No current customer, payment, product-market fit or willingness-to-pay claim follows from these sources. ADB's project 58055-001 page and a UNECE page returned 403 in direct browsing; no unavailable project detail is relied on here.

## Proposed execution design
A first experimental iteration can use an operator-controlled existing agent with browser/retrieval tools to create three demonstration briefs. OpenResearch may be useful as that operator's local workspace. It should not be presented as an already-deployed server backend.

For a hosted service:
1. Worker validates question, geography, time window, language, output type, optional prior brief and explicit cost ceiling. Creates a private idempotent research job.
2. A durable orchestration layer collects a bounded set of allowlisted primary source classes and optionally scholarly material, records failures, deduplicates documents and stores snapshots/excerpts.
3. One bounded synthesis stage uses canonical portfolio methods. Conflicting sources remain separate; unsupported conclusions remain unknown.
4. Deterministic reference/quote/number checks run on the evidence packet. These checks do not certify truth or make a source authoritative.
5. Return a JSON artifact plus Markdown/PDF-ready memo and source ledger; retain the version and its update lineage.

Cloudflare Workflows is a candidate for restartable multi-step orchestration and waiting on APIs. It persists state and supports retries/events; it retains Worker CPU/storage limits. Long-lived network waiting is not unlimited compute. Large/long-lived documents belong in separate object storage. The inspected Agenda config has D1/KV/service bindings, but no research Workflows/Queue/R2 bindings; adding those is proposed work, not existing capacity. Reuse storage concepts without mixing research documents into the payment ledger. [Workflows overview](https://developers.cloudflare.com/workflows/), [limits](https://developers.cloudflare.com/workflows/reference/limits/).

Suggested additive MCP operations: research_brief, get_research, update_brief, get_source. A2A can expose the same job/artifact lifecycle. The supplied-source verification tools remain intact. A first hosted release can support explicit updates on demand; recurring monitoring is separate opt-in scope.

Minimum record fields: research_id, parent_version, question/scope, requested_as_of, source publication/observation/effective/retrieval dates, source_id, URL/locator/excerpt/hash, access failures, claim status and references, contradictions, method/model versions, cost ledger, artifact digest, and review status. A cached source retaining an old observation date must not be relabeled current.

## Commercial and evaluation sequence
Sell a bounded produced brief, followed by an update for the same subject. Keep reviewer-assisted work distinguishable from automated outputs. Price research jobs from measured retrieval, extraction, model and review costs with a hard budget; the existing price of a deterministic check does not establish a sustainable research price. Payment channels can include the existing signed flow for agents and normal professional invoicing for consulting assignments.

First evaluate three real public-source cases: one route constraint brief, one project-stage note and one conflicting-data comparison. Evaluate correct source support, version/period/unit handling, material unsupported claims, human correction time, run cost and latency. If baseline exists, compare the same questions/source access against an ordinary research assistant; do not infer lift from structure alone.

Commercial promotion requires a named reviewer accepting a paid deliverable, then a paid repeat/update. Stop building additional connectors when they are not used in those workflows. No standing crawler, autonomous outreach, external publication, new account, model call, dependency installation or deployment was performed for this research.
