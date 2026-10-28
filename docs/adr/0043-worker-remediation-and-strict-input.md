# ADR 0043: Diagnostic plans and explicit input fields

Status: accepted for the prepared 1.22.0 release, 2026-10-28.

## Context

A source display label supplied as `source_type` never covered a Critical Minerals taxonomy key. Missing issuer/scope fields also prevented eligibility. Those rules worked, but callers had to inspect nested source reviews and could not distinguish rejection from service incapability. Text fallback could silently discard unknown structured fields. The user explicitly requested strict fields across the existing fleet, unified repair guidance and an OV revision workflow, without weaker scores or new services.

## Decision

Attach optional `remediation` (`worker-remediation.v1`) to the twelve primary evaluations and free input preflight. Keep existing score, verdict, evidence ledger and authorization rules. Categories distinguish missing data, rejected records, service limitations and technical errors. Paths use JSON Pointer; non-input limitations use `field:null`. Exact source keys are suggestions only; never coerce a display label into accepted evidence. Blank templates require completion and cannot establish coverage.

Enforce published closed objects before extraction and before attempt/payment reservation, including nested records. Preserve schema-defined open maps and documented transport wrappers. Keep legacy metadata (`source_id`, optional pre-action `topic`) and runtime-supported `shareholders`/`counterparties` explicit in their contracts. The optional text-only orientation tool now rejects additional properties while retaining `{}` discovery; this narrows its previously open schema and is intentionally versioned in 1.22.0. Requests with ignored fields must remove/correct them. No endpoint or tool is removed; no scoring gate is loosened. The frozen request/memo family is unchanged.

Publish read-only schema/example aliases under `/.well-known/`; retain original URLs. A live normal-urllib audit found cards/contracts accessible but `/schemas/tools/` and `/examples/tools/` blocked at the edge. The existing machine-discovery namespace can serve the same public content without changing zone security or admission. A deployment and follow-up check are still required before claiming those aliases work live. The older workers.dev extension URI remains a persistent extension identifier, not a serving endpoint; keep it for compatibility.

All requirements reported by this diagnostic layer are Agenda **service rules**, including JSON input schema rules. They are not automatically requirements of MCP/A2A or law. External legal applicability, evidence authenticity, semantic support and consequential approval require human review. Financial Guard cannot perform live sanctions/AML screening or authoritative wallet-history checks; Escrow cannot independently verify SLO performance. Inputs cannot enable these unavailable capabilities.

## Validation and recovery

Regress exact CM keys, missing issuer, nested typo plus prompt, every primary profile's examples and quota-safe refusal, Python/Worker parity, open maps, unavailable checks and the OV before/after fixture. An unchanged packet is not retried by the local workflow. No live trial or paid evaluation is needed. Roll back the commit and redeploy through the existing Vizier gate; no new persistent resources or data migration is introduced.
