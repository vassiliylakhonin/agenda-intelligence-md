# OpenResearch source review — 27 October 2026

**Assessment:** reuse the discovery discipline, run provenance and artifact workflow for a bounded Middle Corridor + Caspian research service. Treat OpenResearch as a reference implementation and optional scholarly connector, rather than a ready regional intelligence backend.

## Scope and provenance

Reviewed the public repository at immutable commit [`b3105858d1d9d8c9579eefa511ae33e542b6378a`](https://github.com/alphaXiv/OpenResearch/commit/b3105858d1d9d8c9579eefa511ae33e542b6378a), dated 2026-10-26 23:16:45 UTC, plus current first-party service documentation accessed 2026-10-27. GitHub connector reads only; no downloaded code, installation, model calls, authenticated research calls or compute provisioning were executed. Findings describe source and documentation, not measured retrieval quality or reliability.

Decision workspace: goal = assess reusable research machinery; trusted evidence = pinned code and first-party docs below; unreliable evidence = untested coverage, backend internals and commercial fit; assumption = Agenda remains the evidence contract and Vizier owns authorized execution; next action = save this research note; escalate before adopting new infrastructure, paid calls or a production integration.

## What the project actually supplies

The current [README][readme] describes a local-first Rust CLI (`orx`), desktop/dashboard workspace, native coding-agent integrations, local SQL experiment history, Git code, logs and artifacts. It supports local and remote compute. This is broader than a thin research API wrapper, but its literature functions still call external services. The [CLI skill][cli-skill] separates local project/run commands from account/managed-compute commands requiring login.

Three surfaces must remain distinct:

| Surface | Observed role |
|---|---|
| `orx` CLI + installed skills | Local orchestration, retrieval primitives, experiment/run inspection and artifact procedures. The literature skill directs the main agent's retrieval and synthesis. |
| `orx mcp-gate` | An internal stdio MCP approval bridge for Claude Code plan mode; its advertised tool is `approve`. It relays decisions to the local dashboard. It is not a research MCP API. [Code][mcp-gate] |
| alphaXiv hosted MCP | A separate authenticated hosted service at `https://api.alphaxiv.org/mcp/v1`. OAuth or bearer API key; documented research tools include discovery, content reading and PDF queries. Search/analysis consumes assistant quota. [Documentation][alphaxiv-mcp] |

The source's explicit autonomy choices are **Copilot** and **Agentic**. Copilot injects a check-in/approval instruction; Agentic adds no override. These are behavior settings, not evidence quality tiers or guaranteed research depth. [Code][autonomy] The literature skill separately provides discovery-only and read-then-synthesize workflows. [Skill][lit-skill]

## Retrieval, sources and evidence limits

The five `orx discover` primitives emit a common JSON hit shape with source, routing ID, title, abstract and publication date; source-specific fields add votes, citation counts or snippets. [Dispatch][discover], [hit contract][hits]

| Primitive | Supported behavior and boundary |
|---|---|
| `keyword` | alphaXiv full-text retrieval, described as BM25 in CLI help; match snippets may carry page numbers. Requests go to the hosted alphaXiv API. The repository does not establish how that backend index is built. |
| `embedding` | alphaXiv title/abstract semantic retrieval. Date/priority parameters are passed to the hosted endpoint. The skill warns that older/narrow upper-date windows may produce thin candidate sets. |
| `openalex` | Cross-disciplinary scholarly search using OpenAlex `/works?search=…`; metadata and reconstructed abstracts. Date/citation priorities rerank a returned relevance pool. |
| `biorxiv` | Discovery uses OpenAlex filtered to bioRxiv's source ID; selected DOI details use bioRxiv's own API. |
| `pubmed` | NCBI ESearch + EFetch for biomedical literature; date priorities rerank the relevance pool, with no citation counts. |

Sources: [CLI options][discover-options], [alphaXiv client][alpha-client], [OpenAlex client][openalex-client], [PubMed client][pubmed-client], [literature skill][lit-skill]. The default result limit is 15. `--limit` cannot widen alphaXiv's fixed server-side pool; no complete-corpus result enumeration is established by these commands.

`orx paper` reads selected IDs. For alphaXiv, the default fetches a generated intermediate report and falls back to extracted text when the report is missing. `--full` skips the report and requests extracted text. For OpenAlex, bioRxiv and PubMed, `--full` still returns metadata/abstracts with external full-text links; it does not extract those linked documents. Missing alphaXiv text returns an explicit error. [Paper command][paper], [Markdown routes][markdown]

The skill requires reading papers before using them as claim support, distinguishes discovery snippets from verified findings, and requires original text for quotations. It uses bounded follow-up rounds, deduplication, explicit publication windows and source-aware ranking. Those are agent instructions, not a deterministic entailment check. The linked GitHub repository may be the most-starred associated framework rather than the paper's implementation. [Skill][lit-skill], [lookup][github-lookup]

The separate alphaXiv MCP documents `answer_pdf_queries` accepting direct PDF URLs and returning relevant page text, which could help with selected regional reports. This is a hosted capability documented by alphaXiv; it is not implemented by `orx paper --full` for arbitrary URLs. Its coverage, extraction accuracy and service terms were not tested. [MCP docs][alphaxiv-mcp]

## Reuse priorities for Agenda / Vizier

These are design recommendations inferred from the reviewed sources, not shipped Agenda capabilities:

1. **Source-first discovery with a bounded budget.** Adapt the literature skill's candidate → deduplicate → read load-bearing sources → synthesize sequence. Keep source failures and missing facets visible. For Corridor work, choose official regional sources before academic search; do not copy the skill's academic-connector preference wholesale. [Skill][lit-skill]
2. **Run ledger plus durable artifacts.** OpenResearch stores run IDs, project/experiment IDs, status, command/backend, timestamps, exit code, commit SHA and result Markdown; logs have durable paths. Its report skill keeps outputs grouped with source data and reproduction scripts. Adapt that pattern to request ID, question/scope, as-of time, source snapshots, retrieval outcomes, method/version, evidence-ledger references and produced brief/update artifacts. This strengthens inspectability without making another readiness score the product. [Run record][runs], [reports][reports]
3. **Version completed work and preserve lineage.** The experiment skill freezes answered nodes as a workflow rule and branches subsequent hypotheses. Adapt this to versioned research briefs and explicit updates/deltas; a changed conclusion should identify new evidence and retain the prior artifact. Do not describe the instruction as a database-enforced immutable record. [Experiment workflow][experiments]

For an on-demand regional service, scholarly connectors are supplementary context. The inspected primitives do not themselves retrieve customs notices, port/rail tariffs, vessel schedules, ministry releases, sanctions-list changes, operator documents or customer files. A separate controlled ingestion/retrieval layer is needed for those sources, multilingual extraction, timestamps and source licensing. This is a scope inference from the implemented scholarly routes, not a tested absence of regional papers. [Source enum][discover-options], [client][alpha-client]

Use the existing Agenda evidence ledger/normalization contract for claim references and retain Vizier's execution boundary. Retrieved documents and tool outputs must be treated as data, never instructions; suspicious directives should be recorded as integrity anomalies. A new bounded production surface should deliver a sourced brief/update plus machine-readable evidence, limitations and provenance. Porting the desktop Rust process, local shell or GPU lifecycle into a Worker is not required to reuse these patterns.

## Costs, hosted dependencies and adoption caveats

- **License:** repository code is MIT, allowing reuse with copyright/permission notices. That license does not itself grant rights to third-party paper content, data services or hosted infrastructure. Review those separately for redistribution and customer delivery. [License][license]
- **Hosted literature:** `orx` uses keyless public alphaXiv/OpenAlex/bioRxiv/NCBI endpoints. This supplies connectivity, not a self-hosted index, SLA or an unlimited free-service promise. The retry helper makes at most three attempts on 429, with bounded wait. [Hosts][hosts], [retry code][retry]
- **OpenAlex drift:** current docs list a $0.10/day keyless budget, $1/day with a free key, keyword search at $1/1,000 calls, 10 requests/second without a key, and `per_page ≤ 100`. The pinned client sends `mailto`, no API key, and may request up to 200 results. Validate/adapt those assumptions before reuse. [Costs][openalex-costs], [limits][openalex-auth], [client][openalex-client]
- **PubMed:** NCBI documents 3 requests/second without a key and 10 with one. The inspected client sends tool/email but no `api_key`; shared service callers need rate coordination. [NCBI guidelines][ncbi], [client][pubmed-client]
- **Other costs:** alphaXiv MCP's numerical assistant quota/price was not established by its documentation. Model-provider costs and any remote compute remain separate. OpenResearch managed compute is prepaid and billed while instances run; local research does not require that compute service. [MCP docs][alphaxiv-mcp], [billing][billing], [CLI skill][cli-skill]

Only this note was added. No runtime, dependency, contract, deployment or canonical regional method was changed. Verify by reopening the pinned source links and checking current provider policies before implementation; no live quality or cost benchmark is claimed.

[readme]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/README.md
[license]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/LICENSE
[cli-skill]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/SKILL.md#L49-L59
[mcp-gate]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/commands/mcp_gate.rs#L1-L22
[autonomy]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/local/autonomy.rs
[lit-skill]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/agent-skills/orx-lit-review/SKILL.md
[discover]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/commands/discover.rs#L11-L51
[discover-options]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/main.rs#L824-L918
[hits]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/client.rs#L943-L979
[alpha-client]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/client.rs#L556-L615
[openalex-client]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/client.rs#L1130-L1243
[pubmed-client]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/client.rs#L1365-L1505
[paper]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/commands/paper.rs#L1-L250
[markdown]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/client.rs#L902-L927
[github-lookup]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/client.rs#L861-L899
[runs]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/store.rs#L230-L266
[reports]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/agent-skills/orx-reports/SKILL.md
[experiments]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/agent-skills/orx-experiment-tree/SKILL.md
[hosts]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/config.rs#L23-L67
[retry]: https://github.com/alphaXiv/OpenResearch/blob/b3105858d1d9d8c9579eefa511ae33e542b6378a/src/client.rs#L454-L512
[alphaxiv-mcp]: https://www.alphaxiv.org/docs/mcp
[openalex-costs]: https://help.openalex.org/access/example-costs/
[openalex-auth]: https://help.openalex.org/api/authentication/
[ncbi]: https://eutilities.github.io/site/API_Key/usageandkey/
[billing]: https://openresearch.sh/docs/billing
