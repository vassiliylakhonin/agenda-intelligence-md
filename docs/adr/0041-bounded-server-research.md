# ADR 0041 — Bounded server research on the existing Agenda host

Status: active experimental pilot; owner-approved activation and live Russian acceptance completed on 2026-10-27.
Date: 2026-10-27

## Decision workspace

- Goal: collect current public Middle Corridor/Caspian materials and produce a source-linked research artifact on the server.
- Trusted evidence: the existing deterministic evidence contract, canonical vendored methods, and named official source websites.
- Suspected unreliable evidence: retrieved directives, inaccessible/stale pages, announcements treated as completed projects, and unsupported model statements.
- Hidden assumptions: Workers AI and Workflows can be enabled in the existing account; the small initial allowance is sufficient for evaluation.
- Intended next action: implement and test the research module, activate the owner-approved D1 database, Workflow and Workers AI binding through Vizier, then verify a real job.
- Stop or escalate if: new resources exceed the owner-approved scope, no sources can be read, evidence validation fails, or a model invocation has an ambiguous outcome.

## Decision

Add a separate research interface at `/v1/research` and canonical MCP `/v1/research/mcp` on the existing top-level Worker. `/mcp/research` remains an application alias; ordinary machine clients use the existing BIC-compatible `/v1/` namespace. Existing profile endpoints and their supplied-evidence behavior remain intact. The two operations are `research_brief` and `get_research`; every completed artifact includes source dates, access failures, quotations, interpretations, limitations and method provenance. Discovery is an A2A capability extension included before the final AgentCard signature.

Use a dedicated D1 binding for private research records and atomic admission limits, and a Cloudflare Workflow for restartable execution. The deployment exports the Workflow only from the top-level entry; existing fleet environments keep their current entry. No new hosting provider or heavy dependency is introduced.

An initial public evaluation is limited to five jobs per UTC day globally and two per caller capability. A caller generates a private random bearer capability and an idempotency key; neither is a provider credential. Only its digest is stored. Repeated submissions with the same key reuse the same job; a changed request conflicts. Model execution is journaled before dispatch and is never automatically repeated after an ambiguous outcome. Discovery and polling never invoke a model.

The fixed Workers AI model is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, with bounded prompt bytes and output tokens. Limits are server-controlled, not caller-supplied. Model and hosting costs are not represented as an unlimited free-service promise. Automatic approval review initially refused the new persistent resource. After local validation and PR457 were prepared, the owner explicitly approved one D1 database, one Workflow, Workers AI usage under the stated limits, merge/deployment through Vizier and one live test. No plan upgrade was approved.

## Source policy extension

The source catalog lists official public institutional/operator pages. Fetch only HTTPS catalog hosts, validate every redirect, bound responses, and keep access failures visible. Source text is untrusted data and cannot select tools, URLs, models or authority. The 2026-10-28 extension adds PDF/DOCX extraction using existing dependencies. Select at most four sources from seven catalog providers, and at most one linked document after each seed. Documents are limited to 5 MiB; PDFs to 500 total pages, 12 selected pages and 18,000 extracted characters. Selected-page and table-layout warnings are delivered in limitations and Markdown. No OCR, authenticated sources, arbitrary URLs or new resources are introduced. A date-only publication label is normalized to UTC midnight, not inferred from the host timezone. PDF upload paths/HTTP modification dates do not establish publication dates. The named 2023 Aktau report is historical and reads pages 1 and 37 only. Public response schemas and S1–S4 bounds remain unchanged; private extraction metadata is removed before response assembly.

This extends ADR 0014 beyond openly licensed bulk datasets: some operator web pages are copyrighted public documents. Access does not grant redistribution rights. Preserve attribution, provide short quotations with a cumulative 25-word-per-source output limit, discard private working text after a terminal outcome, enforce a 24-hour logical expiry and scrub expired text hourly, and retain the resulting brief and metadata for seven days. Do not crawl authenticated areas or bypass access controls. Source publication dates remain separate from retrieval and observation dates.

The model selects identifiers from a bounded source-fragment ledger; deterministic code attaches the original quote and normalizes references per ADR0021. At most one selected finding per source prevents cumulative quotation overflow. Exact normalized quote matches and source-ID validation establish reference integrity, not semantic entailment, factual truth, route availability or financial/legal advice. Unsupported model output fails closed. Missing access produces a visible failed/partial research result, not fabricated current findings. Human review is required.

## References

- [Research design](../research/openresearch-corridor-research-desk-2026-10-27.md)
- [Workers AI model](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)
- [Workflows](https://developers.cloudflare.com/workflows/)
