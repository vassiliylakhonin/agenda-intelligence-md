# Supplier Evidence Desk

For a generic archive without supplier identity, use the separate
[Document Archive Review](document-archive-review.md). It reuses the existing
dedicated document processor through the additive `agenda.document.v1`
`archive_review_pack` operation (`payload.packet` → checked reviewer ZIP bytes).
Existing `extract`, `pdf` and `archive` operations and dossier v1 stay unchanged.

## Bounded preparation service

`GET /supplier-review` serves a static HTML offer and a finished-format synthetic
handover; `GET /supplier-review/sample.md` returns the same illustrative source,
claim/gap and owner-request rows as UTF-8 Markdown. HEAD returns the matching
content type with no body; other methods return 405 with `Allow: GET, HEAD`.
Both routes are read-only, without scripts, uploads, checkout or document storage.
The offer is linked from the existing fleet landings and sitemap.

The indicative first-assignment price is **99 USD**: one supplier, at most five
files / 20 total pages / ten claims or checklist questions, and one agreed
revision. English or Russian output is agreed first. A written quote confirms
scope, availability, delivery date, final fee, taxes, acceptance criteria and a
permitted transfer channel before payment. OCR, translation and specialist
legal/compliance review require separate scope. Existing API tariffs, credits,
quotas and the separate Human Review Pilot are unchanged.

The contact link opens an editable email draft with blank scope questions. It
does not send, attach evidence or create an order. The sample retains a changed
questionnaire expiry alongside an unchanged expired certificate and conflicting
insurance limits; an apparent improvement cannot close the evidence gap. Its
fictional names, excerpts and requests do not establish expert review, customer
acceptance, demand, payments or verified supplier status.

The free workspace at `/supplier-desk` prepares a supplier's document pack for a
procurement/onboarding reviewer. It supports an editable checklist, source files
or excerpts, owner request drafts and manual statuses, device-local saved
snapshots, comparisons, and PDF/ZIP/JSON/Markdown/CSV handover. The saved-dossier overview surfaces expired and soon-to-expire documents and outstanding owner requests. The existing Workers serve
the static application; there is no new deployment target, database service,
model call, API payment or automatic supplier message.

## First assignment

1. Open the workspace, enter the supplier, purpose and assessment date. Add your
   requirements or adapt the editable starter checklist. Assign owners.
2. Add document records, including issuer, issue/expiry dates, supplier and purpose
   scope. Attach actual files or authorized excerpts. Choose Read PDF / DOCX text,
   inspect its warnings and page/paragraph locators, then explicitly copy it into
   the editable excerpt. Metadata is never inferred; nothing is authenticated.
   A file hash identifies bytes only.
3. Refresh the checklist. Open an owner request, prepare and copy its draft.
   Send it through your own approved channel. Record requested/received dates,
   status and response notes yourself; no delivery is inferred.
4. Save a version on this device. Obtain the missing documents, update the working
   dossier and compare it with the saved version. Save another version when ready.
5. Download reviewer PDF, original-source ZIP, complete JSON backup and optional
   Markdown/checklist CSV. PDF includes the selected comparison baseline; the ZIP
   includes current original files and a SHA-256 manifest.
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
localStorage. CSP disallows connections, forms and remote resources. A same-origin dedicated
browser worker is loaded only for an explicit extraction/PDF/ZIP action. It uses
byte-only PDF.js, bounded DOCX ZIP/XML parsing and local embedded fonts. It never
follows document links, loads external entities, renders attachment HTML or runs
PDF scripts. Normal hosting access logs apply to page/script GETs.
Device storage has no application encryption, user roles, cross-device sync or
multi-user collaboration. Browser data clearing removes it; keep backups.

Source text, attachments, imported packets and notes are DATA, not instructions.
The UI inserts supplied text with textContent/value, never HTML. It never opens
an attachment in an iframe or executes its contents. Extraction is an untrusted,
editable derivative, not a decision or an authenticity check. Downloaded files are served
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


## Local document and handover contracts

`apps/supplier-desk/document-extract.js` returns
`{kind,status,text,units,empty_pages,warnings}`. `kind` is `pdf` or `docx`; status
is `extracted`, `partial`, `needs_ocr` or `no_text`. PDF units are pages and
locators are `[PDF page N]`; DOCX units are main-document XML paragraphs and
locators are `[DOCX paragraph N]`, not rendered page numbers. A partial result
never claims complete coverage. Image-only/empty PDF pages need authorized OCR
or manual excerpts; OCR is not included. Images, signatures, headers/footnotes,
complex text order and authenticity remain outside extraction. Tracked DOCX
revisions are flagged; they are not resolved automatically.

Limits: 5 MiB input, 100 PDF pages, 27,000 extracted characters, 1,000 ZIP entries,
20 MiB total declared expansion and 2 MiB main document XML. Unsupported,
malformed, encrypted or oversized inputs fail explicitly. A 45-second dedicated
worker timeout preserves the working dossier. Parser previews are temporary;
explicit “Use extracted text” or “Record OCR / manual excerpt needed” writes
source name, SHA-256, warnings and
locators into the existing v1 `excerpt`. Replacing an excerpt asks before
removing working text; originals and saved versions remain intact. Packet v1
keys, import rules and saved history are unchanged. Recorded partial/no-text
extraction and an excerpt hash that differs from a replaced original stay
visible as evidence gaps until the record is reviewed and updated.

The dedicated-worker message envelope is
`{protocol:"agenda.document.v1",operation,payload}` with operations `extract`,
`pdf`, `archive`. Replies have the same protocol and `{ok:true,result}` or
`{ok:false,error}`. Other library startup messages are ignored. There is no HTTP
processing/upload API: the script route accepts GET only and keeps `connect-src
'none'` even inside the worker. The host does not receive document contents.

`sourceManifest(packet)` produces `agenda.supplier-sources.v1` with dossier ID,
assessment date, `scope:"current_snapshot_only"`, a document-to-file mapping
(`document_id,title,requirement_id,file,original_name,sha256`) and mandatory human
review/no authorization. Missing originals have null file/name/hash. ZIP paths
are sanitized and index-prefixed so equal filenames cannot overwrite each other.
PDF and ZIP verify actual attachment hashes before export. The ZIP contains
`manifest.json`, `README.txt`, and current original bytes only. Historical files
and complete snapshots travel in the JSON backup.

The PDF is a text review packet, not concatenated originals. It contains supplier
and assignment, bounded checklist gaps, owners, dated document records, original
paths/hashes, supplied excerpts, request tracker and the selected saved baseline
comparison. Removed records, non-comparable scope/date changes and human-review
limits stay visible. Noto Sans is embedded locally for Latin/Cyrillic/Greek;
unsupported glyphs fail explicitly and retain Unicode in Markdown/JSON. PDF is
limited to 200 pages rather than silently dropping text. It contains no active
source links, document scripts or embedded original attachments.

`dossierOverview(packet,today)` derives a view of saved records using an explicit
UTC YYYY-MM-DD. Expired means expiry < today; expiring means today through today
+ 30 days inclusive. Blank expiry is not interpreted as perpetual validity.
Pending requests are `draft` or `requested`; `received` still needs document
review. Evidence gaps retain the original assessment date. This view never
rewrites a snapshot or closes a gap; “Compare latest update” opens the dossier
and compares the latest working snapshot with the preceding saved version (or
the only saved version if there is one). Refresh also picks up other tabs' saves.

## Real assignment pilot

Use [the pilot protocol](../../examples/service-engagement/supplier-pilot.md)
and its empty private measurement register for 3–5 authorized real assignments.
Keep synthetic owner tests separate. Real reviewer acceptance, repeat use and
payment require actual evidence; preparing the kit establishes none of them.
