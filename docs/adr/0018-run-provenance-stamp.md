# ADR 0018 — Deterministic run-provenance stamp on structured responses

Status: accepted
Date: 2026-06-05

## Context

The vertical-worker responses are evidence-rich (claim audit, evidence gaps, decision-readiness, counterparty-readiness, document ledger), but the artifact a caller receives does not say *which contract produced it from which input*. A downstream reviewer — a compliance committee, a correspondent bank, an auditor — who is handed the output cannot confirm it is reproducible: there is no record of the ruleset version, the response schema, or the exact request that generated it.

As generation gets cheaper, the scarce and defensible layer is verifiability of process, not the analysis text. The repo already has authenticity at the transport edge (A2A JWS signing, ADR 0017) and faithfulness at the claim level (`audit-claims`, `verify-quotes`). What is missing is a *content-provenance* stamp on the response body itself: a reproducible link from output back to `(contract version, schema, input)`.

## Decision

Add an optional `run_provenance` object to the vertical-worker response contract, emitted by the shared service layer:

- `contract_version` — the `agenda_intelligence` package version (ruleset) that produced the response.
- `schema_id` — the `$id` of the response schema the output conforms to.
- `input_digest` — `sha256:` over the **canonicalized** request JSON.

**Canonicalization (normative, so ports reproduce identical digests):** serialize the request as UTF-8 JSON with object keys sorted and no insignificant whitespace (Python: `json.dumps(req, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`), then `sha256` the bytes. Same input + same `contract_version` reproduces the same digest, across runs and across language ports.

### Scope and boundary

- **What it is:** reproducibility / traceability. A reviewer can re-run the named contract version on the named input and confirm they get the same artifact.
- **What it is not:** not a signature of authenticity (that is the A2A / JWS transport layer, ADR 0017), and not a factuality, clearance, or compliance attestation. The non-advice and human-review boundaries are unchanged.
- **Digest is over the request, not the response** — the claim is "this output was produced from this exact input under this ruleset," which is the reproducible relation; a response self-digest would be circular.
- **No timestamp.** Wall-clock time is a transport/caller concern (and the JWS envelope already carries it); keeping the stamp purely deterministic is the point — it must be reproducible, so it carries only inputs and ruleset, nothing run-dependent.

### Version and compatibility

Additive, optional field — existing responses remain valid, existing callers are unaffected. Ships in a **minor** version under the ADR 0003 v1 compatibility policy (new optional field; no change to existing fields, enums, or score semantics). The v1.0.x schema-family freeze is intact.

### Rollout

Piloted on the flagship **Middle Corridor Deal Risk Gate** worker (Python service + response schema, dual-copied). Deferred follow-ups, each its own change:

- Cloudflare Worker JS parity for the live Middle Corridor endpoint — must reproduce byte-identical digests, so the JS port implements the canonicalization above (sorted keys, compact separators, raw UTF-8) rather than a bare `JSON.stringify`.
- Extending `run_provenance` to the other three vertical workers (`cis_secondary_sanctions`, `agentic_interaction_trust`, `gulf_maritime_exposure`), same shared helper.

## Consequences

- A handed-off artifact now carries enough to be re-derived: contract version, schema, and a digest of the input. This is the proof-of-process layer the product can stand behind without overclaiming.
- The cross-surface digest-parity requirement is a real constraint: any surface that emits `run_provenance` must canonicalize identically, or the same input yields different digests. Recorded here so the JS port reproduces the spec rather than improvising.
- No change to `decision_readiness_score`, `risk_signal`, routing, or any boundary. Purely additive metadata.

## References

- ADR 0003 — v1 compatibility policy (optional fields ship in minor versions).
- ADR 0017 — A2A wire contract / JWS signing (transport authenticity; orthogonal to content provenance).
- AGENTS.md — honesty rules; change discipline.
