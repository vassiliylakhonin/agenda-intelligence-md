# Supplier Evidence Desk pilot

This is a ready-to-run protocol for 3–5 authorized, real supplier assignments.
No participants, completed jobs, reviewer acceptance, revenue or time savings
have been recorded by preparing this kit. Maintainer tests are synthetic and
must be recorded separately. Do not send invitations or source files automatically.

## Choose the assignments

Use one current procurement/onboarding workflow with a named preparation owner
and an independent reviewer. Include a routine dossier, a renewal with an
expiring certificate, and an incomplete dossier requiring an owner request.
If available, add a scanned document and a revision with adverse information.
Use only documents the team is authorized to process and a permitted device.
Agree the checklist, output, deadline, review criteria and any price before work.

Before the task, record the inspectable decision workspace: goal (supplier and
assignment); trusted_evidence (authorized originals); suspected_unreliable_evidence
(unverified records and extraction omissions); hidden_assumptions (checklist
applicability); intended_next_action (prepare for reviewer); stop_or_escalate_if
(identity, authenticity, applicable requirements or authority is unresolved).

## Run each assignment

1. Record a task ID and the method used for the last comparable assignment.
   If its preparation/review time was not measured, leave the baseline blank.
   Do not reconstruct a convenient baseline from memory.
2. Start the preparation timer. Open `/supplier-desk`, define supplier, purpose,
   assessment date, checklist and owners. Attach authorized originals. Read
   PDF/DOCX locally and check the extracted text and locators against the file.
   Image-only pages require authorized OCR outside this app or a manual excerpt.
3. Save version 1. Prepare missing-document requests and use the team's approved
   channel yourself. Waiting for a response is elapsed time, not preparation
   labour. Record actual status/dates, never inferred delivery.
4. Add the update and save a new version. Use “Compare latest update” from the
   saved overview. Keep adverse changes, removed requirements and scope changes
   visible. A closed request is not evidence that a gap was resolved.
5. Export reviewer PDF, current-source ZIP and full JSON backup. Stop the
   preparation timer. The reviewer checks original documents, extraction
   omissions, source mapping, applicability, missing evidence and version changes.
   Record review minutes, material corrections, revision count and accepted /
   returned / blocked independently of export success.
6. Record any later reuse on another real assignment with its task ID and date.
   Reopening a demo or an owner test is not repeat use. Record paid work and repeat
   payment only with actual references, separately from reviewer acceptance.

## Measurement register

Copy [supplier-pilot-register.csv](supplier-pilot-register.csv) to a private team
location. It contains column headers only; no seeded customer or success rows.
Use pseudonymous IDs; keep supplier identity, originals and acceptance/payment
references in approved private storage, not the public repository.

| Field | Definition |
|---|---|
| run_type | `real_assignment` or `synthetic_owner_test`; never pool them |
| baseline_preparation_minutes / baseline_review_minutes | Observed comparable task time, blank if unknown |
| preparation_minutes | Active work in this task, excluding response waiting |
| reviewer_minutes | Independent review effort including corrections |
| material_corrections / revisions | Reviewer-recorded counts, not zero by default |
| extraction_omissions | Pages/paragraphs/text not usable and how resolved |
| outcome | `accepted`, `returned`, `blocked`, `pending`; only reviewer decides |
| repeat_task_id / repeat_date | Distinct subsequent real assignment, if observed |
| price / currency / payment_reference | Actual agreed price and payment separately |
| evidence_reference | Private task/review evidence location |

## Read the result

After 3–5 real assignments, report each case and missing measurements before
aggregating. Report median preparation and reviewer time only for observed
real cases; paired differences require a measured, comparable baseline.
Do not claim causal time savings from this small, selected pilot. An HTTP 200,
clean structure check, PDF download or complete checklist is not acceptance.

Keep investing in this workflow if reviewers can use the handover, material
errors are addressed, and teams choose it for another assignment. Investigate
the dominant failed step if they stop at extraction, handover or the first
review. If nobody repeats after five completed real assignments, revisit the
buyer/task and interview the actual users before adding another worker. This
is an internal decision rule, not evidence of market demand.

No live model API, automatic outreach, account, cloud document storage or
application telemetry is required for this pilot. There is no automatic
supplier approval, legal judgment or sanctions clearance.
