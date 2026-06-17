# ADR 0019 — `route_to_committee` gate decision for the market-entry readiness gate

Status: accepted
Date: 2026-06-17

## Context

The Kazakhstan market-entry readiness gate (`kazakhstan_market_entry_readiness`) grades a file against a staged source-requirement taxonomy and returns a `readiness_label` and a `gate_decision`. The `readiness_label` ladder has five rungs (`insufficient_information` → `concept_ready` → `validation_ready` → `committee_review_ready` → `launch_commitment_ready`), but the original `gate_decision` enum had only five values and collapsed the top two rungs onto one:

| readiness_label | original gate_decision |
| --- | --- |
| committee_review_ready | escalate_before_signature |
| launch_commitment_ready | escalate_before_signature |

Live testing surfaced this as a real defect. A signature-complete file that still has open operational or sector-specific gaps (`committee_review_ready`) is *ready to go to committee for a staged decision* — a positive milestone. Reporting it as `escalate_before_signature` — the same verdict a fully complete file gets before a binding signature — is alarmist and erases the distinction the readiness ladder was built to express. The verdict is the most decision-relevant field in the response, so the coarseness is exactly where it hurts.

## Decision

Add one value, `route_to_committee`, to the market-entry response `gate_decision` enum, and remap:

| readiness_label | gate_decision |
| --- | --- |
| insufficient_information | stop (commitment stage) / not_decision_ready |
| concept_ready | pause_for_evidence |
| validation_ready | proceed_to_validation |
| committee_review_ready | **route_to_committee** |
| launch_commitment_ready | escalate_before_signature |

`escalate_before_signature` now means only what it says: the evidence pack is complete across the validation, signature, stage-relevant operational, and sector tiers, so the file goes to a human for the binding pre-signature decision. `route_to_committee` is the staged-review verdict for a file that is signature-grade but still has flagged operational/sector evidence to close under committee oversight.

Applied identically in the Python service (`_market_entry_gate_decision`) and the Cloudflare Worker JS parity (`marketEntryGateDecision`).

## Scope and compatibility

- **This is an additive output-enum extension to a single product schema** (`schemas/v1/market-entry-readiness-response.schema.json`), not a request-contract change. It does **not** touch the frozen v1.0.x request/memo schema family (ADR 0003), whose freeze remains in force.
- **No request schema change, no field added or removed, no field renamed.** Producers emit one additional already-documented response value; the response object shape is unchanged.
- Strict consumers that switched exhaustively on the old five `gate_decision` values must add a `route_to_committee` branch. This is the only break, and it only affects callers that both (a) consume this worker and (b) enumerate gate decisions exhaustively. The demo page's verdict pill already colours any value containing "committee" as a positive milestone, so it needs no change.
- `x-schema-version` stays `"1"`: the change is additive at the value level and the schema major is unchanged per ADR 0011 (schema-id URLs are versioned by major). The change is recorded in CHANGELOG under Unreleased.

## Consequences

- The gate's verdict now matches its own readiness ladder: a committee-ready file reads as "route to committee," not "escalate before signature."
- Contract and service tests assert the new mapping in both runtimes; the live Worker is redeployed.
- A future need to distinguish, say, committee-for-staging vs committee-for-final would extend the enum again under the same additive rule; no migration of existing values is implied.
