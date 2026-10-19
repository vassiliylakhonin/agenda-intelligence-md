# ADR 0037: Action-bound mineral evidence preparation and revision

Date: 2026-10-19. Accepted.

## Decision workspace

- Goal: prepare a documentary dossier for a named mineral decision, then inspect an updated submission.
- Trusted evidence: supplied metadata/excerpts are inputs to structural checks, never authenticated facts.
- Unreliable material: placeholders, expired or mismatched records, duplicate references, caller-declared scope and any previous request.
- Assumptions: the caller has permission to process these documents; the stage checklist is relevant enough to prepare human review.
- Next action: generate source-level document requests and blank templates; re-evaluate current and optionally previous inputs locally.
- Stop/escalate: changed decision scope, missing/backwards assessment dates, removed blocker statements, upstream blocks and every actual commercial action require the stated human-review path.

## Contract

Add optional `previous_submission` to the existing Critical Minerals request. It
contains one previous request with no nested history, not a caller-supplied score
or verdict. Validate it before trial reservation. No new tool, account, retrieval
source, persistent dossier history or automatic retry is introduced.

`dossier_review.evidence_workflow` binds preparation to the current question,
project, commodity, origin and decision stage. Missing source types carry their
record references, actual review issues, responsible owner, a supplier/counsel
request draft and a source template. Evidence fields in templates stay empty;
copying a template alone cannot earn documentary coverage. Requests are never
sent by the service. The source scope in the template is caller-declared.

Re-evaluate both requests under the current documentary policy. Compare only the
same project, commodity, origin, processing jurisdiction, market, stage, decision
question and declared counterparties, with explicit valid, nondecreasing review
dates. Formatting/case and counterparty order do not change declared scope.
Report newly reviewable, no longer reviewable and still-missing required source
types. Otherwise explain why comparison is unavailable and emit no coverage
improvement/regression arrays. A removed blocker statement is explicitly reported
for human review, never certified as resolved.

## Boundaries

Comparison describes caller-supplied documentary coverage, not verified history,
source truth, useful customer outcomes or resolved risk. Current scoring and the
enclosing operational decision are unchanged by the baseline. In particular,
upstream stop/incomplete-screening responses outrank the documentary preparation
hint. Even full coverage requests human approval and grants no authorization.

The browser keeps its last successful request in page memory and can attach that
baseline to edited input without a network call. It does not automatically submit
or persist a dossier in browser storage. A submitted rerun has the same trial or
paid admission rules as any evaluation. No quota, price, authentication, signing
key or enforcement boundary changes.
