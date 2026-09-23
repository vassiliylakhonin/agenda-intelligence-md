# ADR 0030: Conservative evidence-review results

Date: 2026-09-23. Accepted.

Escrow contract 1.1.0 preserves request fields, boolean checks and ruling enums. A boolean is true only for a performed check. Additive check_status distinguishes absent evidence. Supplied digests cannot substitute for artifact content; caller telemetry cannot authorize settlement. Missing or unauthenticated delivery evidence returns ESCALATE_HUMAN and zero authorized allocations. Consumers must not interpret proposals as executed payments. This is a conservative behavioral tightening of the evaluation API.

Public product claims and commercial terms must derive from observable capabilities. Dossiers are synthetic templates and cannot acquire verified status through caller parameters. DLP receipts attest only to the scanned payload and DLP scope. OpenAPI 3.1 references the actual JSON Schema contracts served by the worker.
