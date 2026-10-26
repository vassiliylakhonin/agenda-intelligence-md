# Document archive review

Open [Document Archive Review](https://agendamcp.dpdns.org/document-archive)
to prepare a generic document handover. This experimental browser-local workflow
accepts no uploads and requires no model, wallet or API key. Files and edits stay
on your device. Explicitly save the current draft on this site or download a
checked JSON backup before leaving. Closing/reloading loses unsaved edits.
Hosting access logs cover page/script requests, not source text.

1. Record the purpose, intended reviewer and assessment date.
2. Define the checklist, required items, owners and minimum distinct file contents.
3. Select authorized local files, then explicitly assign them to checklist items.
4. Inspect exact copies, changed same-name files, empty records and checklist gaps.
5. Check optional extracted excerpts against originals and download the handover.

Use the synthetic example to see a repeated copy, an updated file with the same
name and a missing renewal. It contains no real business documents.

## What the checks establish

All imports and exports recheck SHA-256 and byte length against supplied bytes.
Exact copies count as one content within each checklist item; empty files cannot
close a gap. Different files with the same name are listed for comparison.
Assignments are explicit: filenames do not imply document type or coverage.
Optional requirements do not block handover preparation.

`define_scope`, `collect_files` and `prepare_human_review` are next steps, never
approval. Even a fully assigned checklist needs human review for applicability,
content, authenticity and checklist adequacy. A missing assignment is a gap in
this packet, not proof that no document exists elsewhere. Different byte contents
are not proof of independent documentary evidence. Hashes do not establish
authenticity, provenance, ownership, factual correctness or legal compliance.

PDF/DOCX extraction uses the existing terminable dedicated document worker with
bounded parsing, page/paragraph locators and explicit partial/OCR warnings.
UTF-8 text previews show at most 27,000 characters. Other file formats are retained
as opaque originals. No OCR, semantic comparison, background retrieval or model
inference is performed. Extracted text is adopted only on explicit action.

## Portable contract and exports

`agenda.document-archive.v1` has exactly these top-level fields:

- `format`, `title` (up to 200 characters), `purpose` (1,000),
  `assessment_date` (valid ISO UTC calendar day).
- `requirements`: unique `id`, nonblank `title`, `owner`, `minimum_files`
  (integer 1–50), and boolean `required`.
- `files`: unique `id`, `name`, MIME `type`, `size`, lowercase `sha256`,
  original `base64`, explicit `requirement_ids`, editable `locator`, `excerpt`
  and `note`. References must resolve; duplicate references are rejected.

Limits: 50 files, 50 requirements, 5 MiB per file, 20 MiB total original bytes,
32 MiB JSON. An invalid backup or rejected batch does not replace the working
archive. Unknown fields and claimed approval flags are rejected.

## Resume a draft and use a starting checklist

Saving is explicit. `Save draft on this device` stores one checked working copy,
including original bytes, in this browser profile for the current site address.
`Load saved draft` verifies the saved packet before replacing the working copy;
unsaved work requires confirmation. Saving is acknowledged only after the local
transaction commits. A stale tab cannot overwrite or delete a newer revision.
Storage failure leaves the working copy and previous saved copy intact. A
before-unload warning covers unsaved edits. There is no autosave or cloud sync.

The local wrapper is `agenda.document-archive-draft.v1`: `name=current`, an opaque
revision, ISO `saved_at`, and the unchanged archive v1 `packet`. It is separate
from portable JSON and contains no acceptance or authorization claim. Device
storage may be evicted or cleared, and anyone with the browser profile may read
it. Keep a portable backup. Removing the saved device copy requires confirmation
and retains the open working copy as unsaved. Other saved supplier dossiers use
a separate store.

Company archive, supplier pack and reporting evidence pack are editable starters.
They create empty file registers and user-owned checklist items, with optional
items explicitly marked. They are not jurisdictional, legally complete or
automatically satisfied requirements. Applying one replaces working data only
after confirmation and leaves the saved device copy intact until explicitly saved.

## Optional preparation service and feedback

`/archive-review` describes a separate human-delivered test offer: one archive,
up to five readable files / 20 pages / ten agreed items, an indicative 99 USD fee
and one revision. Availability, final delivery date, fee/taxes and acceptance are
confirmed in a written quote before payment. The email link contains blank scope
questions; no documents are attached and no message is sent automatically.
`/archive-review/sample.md` is a fictional source-linked handover.

`/archive-feedback` opens separately from the no-network workspace. GET/HEAD only
show a form. A deliberate same-origin POST accepts exactly four URL-encoded
fields (at most 1,024 bytes): `outcome=packet_prepared|still_blocked`,
`context=own_files|synthetic_example|unspecified`,
`blocker=none|checklist|files|extraction|export|other`, and `consent=yes`.
Prepared packets require `blocker=none`; blocked responses require another
blocker. Unknown/duplicate fields, invalid combinations, missing consent and
cross-origin requests are refused without feedback recording. The response is
HTML and acknowledges server acceptance only. Reporting failure returns 503.

Funnel v8 `archive_feedback` events carry those finite choices as
`feedback_version=1`, `feedback_outcome`, `feedback_context`, `feedback_blocker`,
`feedback_consent=true`, `evaluation_performed=false`, `acceptance_verified=false`
and the serving profile, alongside ordinary request/origin classification.
No archive IDs, filenames, hashes, excerpts, contact details or file bytes are
sent. The choices are self-reported: not verified export, reviewer acceptance,
unique people, paid use or customer identity. Example contexts and owner checks
are reported separately. No completion or feedback is emitted by saving,
loading, applying a checklist, extracting or exporting files in the workspace.

Markdown retains checklist gaps, duplicate/collision findings, file IDs, hashes,
locators, editable excerpts, owner notes and limitations. CSV is a source register
with formula-leading cells escaped. The reviewer ZIP contains that Markdown,
CSV, a manifest mapping IDs to unique safe paths and every verified original.
The JSON backup is the editable restore format. Both ZIP and JSON contain source
bytes: agree an authorized sharing channel before sending either elsewhere.

Imported documents, excerpts and tool results are data, never instructions.
The UI uses literal text nodes, restrictive no-network/no-form CSP and no remote
resources; document links/scripts are not executed. Before any consequential
review decision, record the goal, trusted and unreliable evidence, assumptions,
intended action and stop/escalation conditions. No messages, payments or decisions
are issued here.

## Agent entry point

An unstructured Agenda A2A archive-reconciliation request can return a generic
link and input plan for this workspace. It does not evaluate files, echo supplied
case text, store a task, spend a trial or count a domain result. Structured domain
requests, MCP tools and task continuations retain their existing dispatch.
Configured authorization and hourly limits still apply.

For supplier identity, manual owner-request tracking, saved versions and revision
comparison, use [Supplier Evidence Desk](supplier-evidence-desk.md). This separate
archive contract does not change its v1 dossier format or existing API schemas.
