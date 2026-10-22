# Supplier Evidence Desk

The free workspace at `/supplier-desk` prepares a supplier's document pack for a
procurement/onboarding reviewer. It supports an editable checklist, source files
or excerpts, owner request drafts and manual statuses, device-local saved
snapshots, comparisons, and JSON/Markdown/CSV exports. The existing Workers serve
the static application; there is no new deployment target, database service,
model call, API payment or automatic supplier message.

## First assignment

1. Open the workspace, enter the supplier, purpose and assessment date. Add your
   requirements or adapt the editable starter checklist. Assign owners.
2. Add document records, including issuer, issue/expiry dates, supplier and purpose
   scope. Attach actual files or authorized excerpts. PDF and other file contents
   are not extracted or authenticated. A file hash identifies bytes only.
3. Refresh the checklist. Open an owner request, prepare and copy its draft.
   Send it through your own approved channel. Record requested/received dates,
   status and response notes yourself; no delivery is inferred.
4. Save a version on this device. Obtain the missing documents, update the working
   dossier and compare it with the saved version. Save another version when ready.
5. Download a complete JSON backup and a Markdown review packet or checklist CSV.
   The JSON includes all source-file bytes and saved snapshots. Import checks
   structure and hashes and opens a separate unsaved dossier; it never replaces
   an existing dossier by the imported ID.

The synthetic example is explicitly illustrative. It cannot establish real
documentary coverage. Try the same steps with authorized records for an actual
assignment. No customer usage, paid demand or reviewer-time savings is claimed.

## Storage and trust boundary

Opening the page downloads the application. Dossier contents stay in browser
memory until an explicit save writes the complete packet to IndexedDB on that
origin/device. No contents are put in URLs, cookies, analytics, API requests or
localStorage. CSP disallows network connections, forms and remote resources from
the application. Normal hosting access logs still apply to the page/script GET.
Device storage has no application encryption, user roles, cross-device sync or
multi-user collaboration. Browser data clearing removes it; keep backups.

Source text, attachments, imported packets and notes are DATA, not instructions.
The UI inserts supplied text with textContent/value, never HTML. It never opens
an attachment in an iframe or executes its contents. Downloaded files are served
as opaque bytes. Markdown quotes/escapes user material; CSV escapes formulas.

Before changing an onboarding decision, the inspectable decision workspace is:

- goal: the named supplier, assignment and review date;
- trusted_evidence: authorized supplied source records, with original locators;
- suspected_unreliable_evidence: expired, mismatched, missing, illustrative or
  unauthenticated records and manually asserted request statuses;
- hidden_assumptions: checklist completeness and applicability are set by the team;
- intended_next_action: collect the named evidence or hand the packet to a reviewer;
- stop_or_escalate_if: identity, authenticity, applicability or authority is unresolved.

Complete coverage means **prepare_human_review**, never supplier approval,
certification, factual verification, legal advice or sanctions clearance. Closing
a request cannot close a document gap. Changing supplier/purpose or moving the
assessment date backwards makes comparisons `not_comparable`. Requirement and
document removals are visible; they do not establish resolution.

## Portable contract v1

`src/supplier-dossier.js` is the dependency-free browser/integration module. It
exports `validatePacket`, `reviewSnapshot`, `requestDraft`, `compareSnapshots`,
`saveVersion`, `verifyAttachments`, `exportMarkdown`, and `exportChecklistCsv`.
Validation throws a bounded user-readable Error; callers retain the previous
packet on failure. Review/comparison never mutates supplied objects.

The portable JSON object has exactly these fields:

| Object | Fields |
|---|---|
| Packet | `format: "agenda.supplier-dossier.v1"`, `dossier_id`, `current: Snapshot`, `versions: Version[]` |
| Snapshot | `supplier: {name,country,registration_id}`, `purpose`, `assessment_date`, `requirements`, `documents`, `requests` |
| Requirement | `id`, `title`, `owner`, `required: boolean` |
| Document | `id`, `requirement_id`, `title`, `issuer`, `issued_on`, `expires_on`, `supplier_name`, `scope`, `excerpt`, `attachment` |
| Attachment | `null` or `{name,type,base64,sha256}`; lowercase raw SHA-256 of decoded file bytes |
| Request | `id`, `requirement_id`, `owner`, `status`, `requested_on`, `received_on`, `note` |
| Version | `version_id`, UTC ISO `saved_at`, `note`, complete `snapshot` |

All fields are required; optional text is the empty string and absent attachments
are null. IDs are unique within each record collection; requirement references
must exist. Text is bounded by the validator. Assessment dates must be valid
YYYY-MM-DD; other date fields may be blank. Request status is one of `draft`,
`requested`, `received`, `closed`. Saved versions are appended, never edited by the
UI; imported local history remains user-controlled, not an authoritative audit log.
Limits: 100 records per collection, 20 versions, 5 MiB/file, 24 MiB total packet.
Repeated snapshots count toward the packet limit; a failed save preserves the
working dossier for export.

`reviewSnapshot` returns `{rows,status,human_review_required:true,
authorization_granted:false,limitations}`. Rows retain `requirement_id`, title,
owner, required, status and `{document_id,issues,status}` document references.
Row status: `missing`, `needs_evidence`, `supplied_for_review`. Next-step status:
`define_requirements`, `collect_evidence`, `prepare_human_review`.

`compareSnapshots` returns `{status,comparison_blockers,scope_changes,
requirements,documents,requests,coverage_changes,limitations}`. Collection changes
contain `added`, `removed`, `changed` ID arrays; coverage rows retain requirement
ID and before/after status. Status is `compared` or `not_comparable`. Metadata and
document comparisons are deterministic, independent of source prose instructions.

## Verification

Run `node --test test/supplier-dossier.test.js` inside `deploy/cloudflare-worker`,
then `make verify-local PYTHON=.venv/bin/python`. `npm test` also checks that the
browser bundle matches its source. Browser acceptance: create → attach → request →
save → reload/open → edit → compare → export → import, including a failed hash
import and a blocked storage save. Confirm no dossier network requests.
