# ADR 0016 — Keep vertical workers in one repo (third-worker spin-off decision)

Status: accepted
Date: 2026-05-29

## Context

AGENTS.md "Rule for adding the next vertical worker" requires an explicit spin-off decision when the **third** vertical worker is proposed. That threshold is now reached. Three workers are shipped in this repo:

1. `middle_corridor_deal_risk` — Kazakhstan / Middle Corridor deal-risk gate (flagship).
2. `cis_secondary_sanctions` — CIS-counterparty secondary-sanctions exposure triage.
3. `agentic_interaction_trust` — agent-mediated interaction trust gate (added after the consumer agentic-trading signal, e.g. Robinhood MCP, May 2026).

The rule's spin-off trigger criteria: divergent release cadence, divergent dependency footprint, separate buyer/channel, or a commercial reason to keep contracts in separate licenses.

## Decision

**Keep all three vertical workers in this single repo.** Do not spin off independent repositories.

Assessed against each trigger criterion:

- **Release cadence — convergent.** All three ship on the same `v1.0.x` contract-freeze line, the same CI, the same release workflow. No worker has an independent versioning need.
- **Dependency footprint — convergent.** All three are pure-Python service functions over the shared `services.py` core, the same `schemas/v1/` directory, the same `a2a_adapter.py`, the same Cloudflare Worker JS runtime. The only external dependency (`upstream_opensanctions` / Watchman, ADR 0014) is per-profile and deferred; it does not pull a heavy stack into the shared core.
- **Buyer / channel — overlapping, not separate.** All three target evidence-discipline + human-review routing for high-stakes agent decisions, discovered through the same Agenstry listings and the same compose-router canonicals (`policy.intelligence.*`). They are facets of one product surface, not three businesses.
- **License — same.** MIT across the board. No commercial reason to separate contracts.

None of the spin-off triggers fire. The cost of three repos (triplicated CI, dual-copy invariants ×3, cross-repo glossary drift, three release pipelines) would be paid for zero benefit at current scale (no worker has a paying customer or independent roadmap).

## Consequences

- The `< 3` phrasing in AGENTS.md is updated: the spin-off decision was made here (keep together). The shared-repo discipline (one service layer, one `schemas/v1/`, one A2A adapter, one Worker per product profile, dual-copy data invariant) continues to apply to all current and future workers **until a trigger actually fires**.
- A future worker that *does* trip a trigger (e.g. needs a heavy ML dependency, a different release cadence, or has a distinct paying buyer) re-opens this decision for that worker specifically — it does not force a retroactive split of the existing three.
- ADR 0015's structural-triage boundary applies uniformly across all three workers, which is cleaner to maintain in one repo than across three.

## Revisit triggers

Re-open this ADR if any worker acquires: its own paying customer with a distinct SLA, a dependency the other two must not carry, a divergent release cadence, or a license/commercial reason to separate. Absent one of those, the workers stay together.

## References

- [AGENTS.md](../../AGENTS.md) — "Vertical workers inside this repo" + the spin-off rule this ADR resolves.
- [ADR 0014](0014-per-profile-live-retrieval.md) — per-profile live retrieval (the one per-worker dependency, deferred).
- [ADR 0015](0015-evidence-gap-flagging-vs-substantive-analysis.md) — structural-triage boundary shared by all three workers.
