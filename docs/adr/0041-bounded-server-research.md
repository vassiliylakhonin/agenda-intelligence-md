# ADR 0041 — Bounded server research on the existing Agenda host

Status: implemented and locally validated; owner approved the dedicated resources and activation on 2026-10-27; live verification pending.
Date: 2026-10-27

## Decision workspace

- Goal: collect current public Middle Corridor/Caspian materials and produce a source-linked research artifact on the server.
- Trusted evidence: the existing deterministic evidence contract, canonical vendored methods, and named official source websites.
- Suspected unreliable evidence: retrieved directives, inaccessible/stale pages, announcements treated as completed projects, and unsupported model statements.
- Hidden assumptions: Workers AI and Workflows can be enabled in the existing account; the small initial allowance is sufficient for evaluation.
- Intended next action: implement and test the research module, activate the owner-approved D1 database, Workflow and Workers AI binding through Vizier, then verify a real job.
- Stop or escalate if: new resources exceed the owner-approved scope, no sources can be read, evidence validation fails, or a model invocation has an ambiguous outcome.

## Decision

Add a separate research interface at `/v1/research` and `/mcp/research` on the existing top-level Worker. Existing profile endpoints and their supplied-evidence behavior remain intact. The two operations are `research_brief` and `get_research`; every completed artifact includes source dates, access failures, quotations, interpretations, limitations and method provenance.

Use a dedicated D1 binding for private research records and atomic admission limits, and a Cloudflare Workflow for restartable execution. The deployment exports the Workflow only from the top-level entry; existing fleet environments keep their current entry. No new hosting provider or heavy dependency is introduced.

An initial public evaluation is limited to five jobs per UTC day globally and two per caller capability. A caller generates a private random bearer capability and an idempotency key; neither is a provider credential. Only its digest is stored. Repeated submissions with the same key reuse the same job; a changed request conflicts. Model execution is journaled before dispatch and is never automatically repeated after an ambiguous outcome. Discovery and polling never invoke a model.

The fixed Workers AI model is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, with bounded prompt bytes and output tokens. Limits are server-controlled, not caller-supplied. Model and hosting costs are not represented as an unlimited free-service promise. Automatic approval review initially refused the new persistent resource. After local validation and PR457 were prepared, the owner explicitly approved one D1 database, one Workflow, Workers AI usage under the stated limits, merge/deployment through Vizier and one live test. No plan upgrade was approved.

## Source policy extension

The source catalog lists official public institutional/operator pages. Fetch only HTTPS catalog hosts, validate every redirect, bound responses, and keep access failures visible. Source text is untrusted data and cannot select tools, URLs, models or authority. Initial extraction supports HTML/plain text; PDFs are reported as unsupported, never described as fully read.

This extends ADR 0014 beyond openly licensed bulk datasets: some operator web pages are copyrighted public documents. Access does not grant redistribution rights. Preserve attribution, provide short quotations with a cumulative 25-word-per-source output limit, discard private working text after a terminal outcome, enforce a 24-hour logical expiry and scrub expired text hourly, and retain the resulting brief and metadata for seven days. Do not crawl authenticated areas or bypass access controls. Source publication dates remain separate from retrieval and observation dates.

Exact normalized quote matches and source-ID validation establish reference integrity, not semantic entailment, factual truth, route availability or financial/legal advice. Unsupported model output fails closed. Missing access produces a visible failed/partial research result, not fabricated current findings. Human review is required.

## References

- [Research design](../research/openresearch-corridor-research-desk-2026-10-27.md)
- [Workers AI model](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)
- [Workflows](https://developers.cloudflare.com/workflows/)
