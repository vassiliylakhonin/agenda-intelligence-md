# ADR 0023: Bounded factual verification is a separate Claim Verdict layer

## Status

Accepted.

## Decision

Add `verify_claims` as an additive service, CLI command, and MCP tool. It consumes explicit claims and caller-supplied evidence records, then evaluates freshness, source authority, independent source groups, conflicting evidence, jurisdiction, and exact subject identifiers as of a declared date.

The output uses a separate Claim Verdict vocabulary: `verified`, `contradicted`, `partially_supported`, `unresolved`, and `not_verifiable`. Existing `support_status`, grounding, quote verification, and readiness scores keep their current meanings.

`verified` means that the caller's declared evidence threshold is met by the supplied evidence set as of the declared date. It is not a claim of absolute or permanent truth. Human review remains required.

## Boundaries

This layer does not discover or fetch sources, perform fuzzy entity resolution, decide sanctions or legal status, or infer source stance from prose. Those are separate acquisition or expert-review responsibilities.

## Consequences

The contract is deterministic, testable, and safe to add without breaking v1 consumers. Its usefulness depends on evidence-set quality and completeness, which are explicitly reported as caller responsibilities.
