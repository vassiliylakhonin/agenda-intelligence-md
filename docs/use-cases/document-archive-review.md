# Document archive review

Open [Document Archive Review](https://agendamcp.dpdns.org/document-archive)
to prepare a generic document handover. This experimental browser-local workflow
accepts no uploads and requires no model, wallet or API key. Files and edits stay
in the tab; closing/reloading loses unsaved work. Download a checked JSON backup
before leaving. Hosting access logs cover page/script requests, not source text.

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
archive. Unknown fields and claimed approval flags are rejected. There is no
autosave or browser database for this workspace.

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
