# Factual Verification Boundary

Agenda Intelligence MD is an evidence and evaluation contract layer. It helps analysts and agents keep strategic-risk output structured, source-disciplined, and auditable, but it does not decide whether a claim is true in the world.

## Current Contract

Implemented layers:

- `validate-brief`: checks agenda brief schema shape.
- `validate-evidence`: checks evidence pack schema shape.
- `audit-claims`: checks claim-to-evidence traceability and orphan evidence references.
- `score`: computes heuristic structure and evidence-discipline scores.
- `bench`: runs deterministic structural/evidence checks across example cases.
- `source-plan`: prints required and recommended source types for a category.
- `verify-quotes`: checks whether a cited quote or excerpt appears in supplied local text.
- `verify-quotes --fetch`: fetches already-specified source URLs and checks quote or excerpt presence in fetched text.

These tools can say that an evidence contract is present, incomplete, internally inconsistent, or missing required support. They cannot say that the underlying claim is true in the world.

Source-plan coverage is one step below factual verification. It can identify missing required source types for a category, but it still does not decide whether the claim is true. See [`source-plan-coverage.md`](source-plan-coverage.md).

## What Is Not Implemented

Agenda Intelligence MD does not currently:

- discover new sources for a claim;
- gather live news;
- rank or score source reputation;
- decide whether a source is authoritative;
- resolve conflicting sources;
- verify sanctions, legal, market, geopolitical, or company claims as real-world facts;
- replace analyst judgment.

## Sanctions Claim Example

For a statement such as "Company X is sanctioned worldwide," the current toolkit can check whether the brief contains an evidence pack, whether the evidence pack lists relevant official sanctions sources, whether claims are linked to evidence, whether unsupported claims are disclosed, and whether quoted fragments appear in supplied or fetched source text.

It should not return a verdict that the statement is true or false in the world. A human analyst or a future factual verification layer must check authoritative sanctions lists, jurisdiction scope, effective dates, entity aliases, ownership/control rules, and source conflicts.

## Future Layer

If factual verification is added after v1.0, model it as a separate layer with an explicit Claim Verdict contract. Likely verdicts include:

- `verified`
- `contradicted`
- `partially_supported`
- `unresolved`
- `not_verifiable`

That future layer should preserve the existing evidence/eval contract instead of changing the meaning of current fields. In particular, do not overload:

- `support_status`
- `support_level`
- `score`
- `bench`
- `verify-quotes`
- `evidence_mode`

The current fields describe evidence availability, traceability, or structure. They are not truth labels.
