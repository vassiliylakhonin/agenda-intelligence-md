# ADR 0015 — Evidence-gap flagging vs substantive analysis: the vertical-worker boundary line

Status: accepted
Date: 2026-05-28

## Context

The repo now hosts three vertical workers — `middle_corridor_deal_risk`, `cis_secondary_sanctions`, and `agentic_interaction_trust`. All three share the same core design: a **structural triage** that scores readiness by *which evidence types are present*, not by *what the evidence reveals*. The caller brings the risk judgment; the worker organizes the evidence and routes to human review.

Three consecutive dogfood runs (2026-05-27/28) surfaced the same recurring critique: the workers are **blind to the content of the fields they receive**. Concretely:

- `cis_secondary_sanctions`: an `ownership_layers` chain ending in "undisclosed UBO" was not surfaced — the single most material fact in that case.
- `middle_corridor_deal_risk`: a `counterparties[].jurisdiction = "Russia"` on a dual-use cargo was not flagged — a near-automatic escalation in real compliance.
- Both: `decision_readiness_score` / `risk_signal` are driven by missing-source-count, so a maximally toxic deal with a complete evidence pack scores *lower* signal than a benign deal with gaps.

This raised a genuine product question: should the workers become **content-aware** (read what sources/fields reveal and score substance)?

## Decision

**Hold the structural-triage boundary. Permit one narrow, principled exception: flagging the _presence_ of a known high-risk attribute as an evidence/escalation signal.**

The line:

- **Allowed (evidence-gap / presence flagging):** detect that a caller-supplied field *contains* a known high-risk marker and surface it as an explicit gap, exposure dimension, or limitation that routes to human review. Examples: an undisclosed/unverified UBO token in an ownership chain; a counterparty domiciled in a sanctions-relevant / comprehensively-sanctioned jurisdiction; a stated "end-user unclear" note. This is pattern-presence detection, not adjudication.
- **Forbidden (substantive analysis):** adjudicating whether the attribute *actually* creates liability, scoring the *severity* of the substance, or letting content move the `decision_readiness_score` / `risk_signal` away from its structural (evidence-completeness) basis. The worker must not imply it has assessed the merits.

Why this line and not full content-awareness:

1. **Honesty.** Full content-awareness would make the worker *look* like it adjudicates sanctions/compliance merits. It does not retrieve, does not verify, does not have authoritative lists baked in. A worker that flags "this jurisdiction is sanctions-relevant — escalate" is honest; a worker that scores "this deal is 72% likely to breach EO 14114" is a fabricated determination. The honesty rules in AGENTS.md forbid the latter.
2. **The buyer brings the judgment.** The product's stated value is evidence discipline + human-review routing, not replacing the analyst. Presence-flagging strengthens routing ("you have a Russia-jurisdiction consignee here — a human must look") without crossing into the analyst's job.
3. **Maintainability.** A presence flag is a small, testable, list-backed scan. A substantive scorer is an open-ended model-judgment surface that drifts, needs eval infrastructure, and re-opens the factuality boundary that ADR 0006 deliberately closed.

The `decision_readiness_score` and `risk_signal` / `trust_signal` / `secondary_exposure_signal` remain **structural by design**: they measure evidence-pack completeness, not deal toxicity. A high-risk presence flag is surfaced *alongside* the structural score (in `top_risks` / `top_exposure_dimensions` / `limitations`), never folded into it. This is intentional and documented here so future contributors don't "fix" it.

## Consequences

### Already applied under this principle

- `cis_secondary_sanctions`: undisclosed-UBO presence flag (token scan of `ownership_layers`) → `top_exposure_dimensions` + `limitations`. Shipped 2026-05-28.

### Applied with this ADR

- `middle_corridor_deal_risk`: high-risk / sanctions-relevant jurisdiction presence flag (scan of `counterparties[].jurisdiction`) → `top_risks` + `limitations`. The jurisdiction set is a small, explicitly-labeled "sanctions-relevant" list (Russia, Belarus, Iran, North Korea, Syria, Crimea and common variants), surfaced as "escalate for human review," never as a designation or legal conclusion.

### Deferred (would be the same pattern, not done yet)

- `middle_corridor_deal_risk` / `cis_secondary_sanctions`: scanning free-text `notes` for uncertainty markers ("end-user unclear", "beneficial owner unknown").
- Cargo-string dual-use detection in `middle_corridor_deal_risk`.

These are legitimate future presence flags under the same boundary; they are not implemented now to keep each change reviewable.

### Explicitly out of scope (rejected)

- Content-aware `decision_readiness_score` / `risk_signal` that reads what the evidence reveals. This is a different product and would violate the honesty boundary above. Not planned.

## References

- [AGENTS.md](../../AGENTS.md) — honesty rules (no fabricated determinations), vertical-worker definition.
- [ADR 0006](0006-factual-verification-is-post-v1-layer.md) — factual verification is a deliberately separate, post-v1 layer; this ADR keeps the workers on the correct side of that line.
- [ADR 0007](0007-source-plan-coverage-is-diagnostic-before-v1.md) — source-coverage is diagnostic, not a pass/fail gate; the structural-score basis here is consistent with that.
