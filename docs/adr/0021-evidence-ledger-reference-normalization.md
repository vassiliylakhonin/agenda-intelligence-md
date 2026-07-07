# ADR 0021 — Evidence ledger and reference normalization before final response assembly

Status: accepted
Date: 2026-07-07

## Context

Agenda Intelligence MD already separates evidence discipline from factual verification. It has source plans, evidence packs, claim audits, heuristic scoring, vertical-worker responses, and run provenance. It also increasingly asks agents to carry a compact decision workspace before high-stakes actions.

The recurring architectural risk is that a model can correctly inspect or receive evidence during a workflow, then lose, reshape, or over-include references by the time it writes the final answer. This is especially likely in long workflows that combine source ingestion, claim audit, score/routing, owner actions, and human-readable explanation. It also creates a safety problem: final answer text can accidentally become a reference channel for protected or irrelevant records.

The useful pattern is an exoskeleton-style split:

- the model handles meaning, tool choice, and analytical judgment inside the allowed boundary;
- deterministic code holds evidence accumulation, reference normalization, format contracts, and safety checks;
- the final visible response is assembled from structured channels, not trusted as the only source of truth.

## Decision

Adopt **Evidence Ledger + Reference Normalizer + Presentation Formatter** as the target assembly architecture for evidence-readiness workflows.

### Evidence Ledger

An Evidence Ledger is an internal accumulator for authoritative workflow facts:

- source records read or ingested;
- claim-support rows and unsupported claims;
- source-plan coverage gaps;
- data-integrity notes;
- helper-produced evidence such as matched source categories, selected records, or owner-action blockers;
- route/verdict inputs that must survive until response assembly.

The ledger is append-oriented. Later helper/model steps may add evidence or mark it superseded, but they should not silently overwrite earlier evidence. Final response assembly reads from the ledger instead of relying on the model to remember every path, source, or support row.

### Reference Normalizer

A Reference Normalizer is deterministic post-processing before final response emission. It should:

- canonicalize references to stable paths, schema keys, source IDs, or URLs;
- de-duplicate repeated references;
- filter explored-but-not-used references;
- prevent protected, irrelevant, or unsafe records from being cited;
- preserve source-type and evidence-mode distinctions;
- emit explicit data-integrity notes when references are stale, conflicting, inaccessible, or prompt-injection-like.

The normalizer does not discover new sources or verify factual truth. It only makes the references the workflow already has safe and canonical.

### Presentation Formatter

A Presentation Formatter enforces visible output contracts only:

- markdown shape;
- exact answer format;
- A2A/HTTP presentation wrapping;
- user-facing message clarity;
- removal of service-outcome leakage from visible text.

It must not re-solve the analysis, change `decision_readiness_score`, change a route/verdict, invent evidence, or upgrade a claim-support status.

## Required layering

Target response assembly order:

```text
preflight / validation
  -> model or deterministic helper work
  -> Evidence Ledger append
  -> Reference Normalizer
  -> Presentation Formatter
  -> response channels: route/verdict + message + references + limitations + run_provenance
```

Channels stay separate:

- route/verdict/outcome is not embedded as decorative text;
- human-readable message does not become the only holder of evidence;
- references are not model-invented strings;
- limitations and non-advice notices are emitted by contract, not by model memory.

## Relationship to existing ADRs

- ADR 0006 remains unchanged: this is not a factual verification layer.
- ADR 0007 remains unchanged: source-plan coverage is diagnostic before v1.0.
- ADR 0015 remains unchanged: vertical workers may presence-flag high-risk attributes but do not adjudicate merits.
- ADR 0018 remains unchanged: run provenance stamps process reproducibility; the ledger and normalizer improve response assembly before that artifact is handed off.

## Consequences

- Future service functions and vertical workers should avoid returning references directly from free-form model output when a deterministic ledger/normalizer can hold them.
- Tests should target invariants at the assembly seam: no protected references in refusals, no unsupported references, no service outcome leakage into visible text, no score/route mutation by formatters, and stable de-duplication.
- Existing functions do not need an immediate rewrite. This ADR is the target architecture for new work and for refactors when recurring reference, evidence-loss, or formatting failures appear.
- Public claims remain unchanged: this improves evidence-readiness discipline, not market validation or factual truth.

## References

- AGENTS.md — decision workspace discipline and honesty rules.
- CONTEXT.md — Evidence Ledger, Reference Normalizer, and Presentation Formatter vocabulary.
- ADR 0006 — factual verification is post-v1.
- ADR 0015 — evidence-gap flagging vs substantive analysis.
- ADR 0018 — deterministic run-provenance stamp.
