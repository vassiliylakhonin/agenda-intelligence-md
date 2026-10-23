// Browser and integration contract: docs/use-cases/supplier-evidence-desk.md.
// Supplied records and local histories are data, never authority or instructions.
export const FORMAT = 'agenda.supplier-dossier.v1';
export const LIMITS = Object.freeze({file: 5 * 1024 * 1024, packet: 24 * 1024 * 1024, versions: 20, records: 100});
export const REQUEST_STATUSES = ['draft', 'requested', 'received', 'closed'];
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const cleanDate = value => /^\d{4}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const required = (value, field, max = 500) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`${field}: enter 1–${max} characters.`);
};
const shape = (value, keys, field) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw Error(`${field}: unsupported object or fields.`);
};
const optional = (value, field, max = 500) => { if (typeof value !== 'string' || value.length > max) throw Error(`${field}: invalid text.`); };
const list = (value, field) => { if (!Array.isArray(value) || value.length > LIMITS.records) throw Error(`${field}: at most ${LIMITS.records} records.`); };
const dateField = (value, field, allowBlank = true) => { if (!(allowBlank && value === '') && !cleanDate(value)) throw Error(`${field}: use a valid YYYY-MM-DD date.`); };
const unique = (rows, field) => {
  const ids = new Set();
  for (const row of rows) { required(row.id, `${field}.id`, 80); if (ids.has(row.id)) throw Error(`${field}: duplicate ID.`); ids.add(row.id); }
};

export function emptySnapshot(today = new Date().toISOString().slice(0,10)) {
  return {supplier: {name:'',country:'',registration_id:''}, purpose:'', assessment_date:today, requirements:[], documents:[], requests:[]};
}
export function createPacket(id, snapshot) {
  const packet = {format:FORMAT,dossier_id:id,current:clone(snapshot),versions:[]};
  validatePacket(packet);
  return packet;
}
export function validateSnapshot(snapshot) {
  shape(snapshot, ['supplier','purpose','assessment_date','requirements','documents','requests'], 'snapshot');
  shape(snapshot.supplier,['name','country','registration_id'],'supplier');
  required(snapshot.supplier.name,'supplier.name',200);
  optional(snapshot.supplier.country,'supplier.country',100);
  optional(snapshot.supplier.registration_id,'supplier.registration_id',200);
  required(snapshot.purpose,'purpose',1000);
  dateField(snapshot.assessment_date,'assessment_date',false);
  for (const name of ['requirements','documents','requests']) { list(snapshot[name],name); unique(snapshot[name],name); }
  const requirementIds = new Set(snapshot.requirements.map(row=>row.id));
  for (const row of snapshot.requirements) {
    shape(row,['id','title','owner','required'],'requirement');
    required(row.title,'requirement.title'); optional(row.owner,'requirement.owner',200);
    if (typeof row.required !== 'boolean') throw Error('requirement.required: expected boolean.');
  }
  for (const row of snapshot.documents) {
    shape(row,['id','requirement_id','title','issuer','issued_on','expires_on','supplier_name','scope','excerpt','attachment'],'document');
    required(row.title,'document.title');
    for (const key of ['issuer','supplier_name']) optional(row[key],`document.${key}`,200);
    optional(row.scope,'document.scope',1000); optional(row.excerpt,'document.excerpt',30000);
    dateField(row.issued_on,'document.issued_on'); dateField(row.expires_on,'document.expires_on');
    if (!requirementIds.has(row.requirement_id)) throw Error('document.requirement_id: unknown requirement.');
    if (row.attachment !== null) {
      const file = row.attachment;
      shape(file,['name','type','base64','sha256'],'attachment'); required(file.name,'attachment.name',200); optional(file.type,'attachment.type',100);
      if (typeof file.base64 !== 'string' || file.base64.length > Math.ceil(LIMITS.file/3)*4 || file.base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(file.base64)) throw Error('Invalid or oversized attachment.');
      if (!/^[a-f0-9]{64}$/u.test(file.sha256)) throw Error('Invalid attachment SHA-256.');
    }
  }
  for (const row of snapshot.requests) {
    shape(row,['id','requirement_id','owner','status','requested_on','received_on','note'],'request');
    if (!requirementIds.has(row.requirement_id)) throw Error('request.requirement_id: unknown requirement.');
    optional(row.owner,'request.owner',200); optional(row.note,'request.note',2000);
    if (!REQUEST_STATUSES.includes(row.status)) throw Error('request.status: unsupported status.');
    dateField(row.requested_on,'request.requested_on'); dateField(row.received_on,'request.received_on');
    if (row.received_on && row.requested_on && row.received_on < row.requested_on) throw Error('Request received date precedes request date.');
  }
  return snapshot;
}
export function validatePacket(packet) {
  shape(packet,['format','dossier_id','current','versions'],'packet');
  if (packet.format !== FORMAT) throw Error('Unsupported dossier format.');
  required(packet.dossier_id,'dossier_id',80); validateSnapshot(packet.current);
  if (!Array.isArray(packet.versions) || packet.versions.length > LIMITS.versions) throw Error(`At most ${LIMITS.versions} saved versions. Export a backup before starting a new dossier.`);
  const ids = new Set(); let previous = '';
  for (const version of packet.versions) {
    shape(version,['version_id','saved_at','note','snapshot'],'version'); required(version.version_id,'version_id',80);
    if (ids.has(version.version_id)) throw Error('Duplicate version ID.'); ids.add(version.version_id);
    if (typeof version.saved_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/u.test(version.saved_at) || !Number.isFinite(Date.parse(version.saved_at)) || version.saved_at < previous) throw Error('Invalid version time/order.');
    previous = version.saved_at; optional(version.note,'version.note',1000); validateSnapshot(version.snapshot);
  }
  if (new TextEncoder().encode(JSON.stringify(packet)).length > LIMITS.packet) throw Error('Dossier exceeds 24 MiB including history. Export a backup and start a new dossier.');
  return packet;
}
export function saveVersion(packet, {id,at,note = ''}) {
  validatePacket(packet);
  const next = clone(packet);
  next.versions.push({version_id:id,saved_at:at,note,snapshot:clone(packet.current)});
  return validatePacket(next);
}
export function reviewSnapshot(snapshot) {
  validateSnapshot(snapshot);
  const rows = snapshot.requirements.map(requirement => {
    const documents = snapshot.documents.filter(row=>row.requirement_id===requirement.id).map(document => {
      const issues = [];
      if (!document.issuer.trim()) issues.push('Issuer missing');
      if (!document.issued_on) issues.push('Issue date missing');
      else if (document.issued_on > snapshot.assessment_date) issues.push('Issued after assessment date');
      if (document.expires_on && document.expires_on < snapshot.assessment_date) issues.push('Expired before assessment date');
      if (document.expires_on && document.issued_on && document.expires_on < document.issued_on) issues.push('Expiry precedes issue date');
      if (document.supplier_name.trim() !== snapshot.supplier.name.trim()) issues.push('Supplier scope differs');
      if (document.scope.trim() !== snapshot.purpose.trim()) issues.push('Purpose scope differs');
      if (!document.excerpt.trim() && !document.attachment) issues.push('No excerpt or attached file');
      const extracted=document.excerpt.match(/^(?:Agenda local extraction v1\n)?Source: [^\n]+\nSHA-256: ([a-f0-9]{64})\nExtraction: (extracted|partial)\./u);
      if (extracted && document.attachment && extracted[1]!==document.attachment.sha256) issues.push('Extracted excerpt belongs to a different attached file; re-extract or review the excerpt');
      if (extracted?.[2]==='partial') issues.push('Partial extraction: review omitted text/pages against the original');
      if (/\b(?:illustrative\s+only|synthetic\s+(?:test|example|fixture|only)|placeholder)\b/iu.test(document.title+' '+document.excerpt)) issues.push('Illustrative material is not actual documentary evidence');
      return {document_id:document.id,issues,status:issues.length ? 'needs_evidence' : 'supplied_for_review'};
    });
    return {requirement_id:requirement.id,title:requirement.title,owner:requirement.owner,required:requirement.required,
      status:documents.some(row=>row.status==='supplied_for_review') ? 'supplied_for_review' : documents.length ? 'needs_evidence' : 'missing',documents};
  });
  return {rows,status:!rows.some(row=>row.required) ? 'define_requirements' : rows.some(row=>row.required && row.status!=='supplied_for_review') ? 'collect_evidence' : 'prepare_human_review',
    human_review_required:true,authorization_granted:false,
    limitations:['Checklist requirements are defined by the user, not a universal legal standard.','Supplied files, excerpts, metadata, request statuses and imported history are not authenticated.','File hashes check bytes only. No supplier approval, sanctions clearance or automatic sending.']};
}
export function requestDraft(snapshot, requirementId) {
  const review = reviewSnapshot(snapshot), row = review.rows.find(item=>item.requirement_id===requirementId);
  if (!row) throw Error('Unknown requirement.');
  const request = snapshot.requests.find(item=>item.requirement_id===requirementId);
  const issues = [...new Set(row.documents.flatMap(item=>item.issues))];
  return `To: ${request?.owner || row.owner || '[assign an owner]'}\nSubject: ${snapshot.supplier.name} — ${row.title}\n\nPlease provide ${row.title} for ${snapshot.supplier.name}.\nPurpose: ${snapshot.purpose}\nAssessment date: ${snapshot.assessment_date}\nCurrent document status: ${row.status}\n${issues.length ? 'Gaps: '+issues.join('; ')+'\n' : ''}Include the issuer, issue date, expiry where applicable and the scope. Provide an authorized source document or exact excerpt.\n${request?.note ? 'Owner note: '+request.note+'\n' : ''}\nA person will review authenticity and applicability. This is a draft; it has not been sent.`;
}
const changes = (oldRows,newRows) => {
  const old = new Map(oldRows.map(row=>[row.id,row])), now = new Map(newRows.map(row=>[row.id,row]));
  return {added:[...now.keys()].filter(id=>!old.has(id)),removed:[...old.keys()].filter(id=>!now.has(id)),changed:[...now.keys()].filter(id=>old.has(id) && canonical(old.get(id))!==canonical(now.get(id)))};
};
export function compareSnapshots(before,after) {
  validateSnapshot(before); validateSnapshot(after);
  const scope_changes = ['supplier','purpose'].filter(key=>canonical(before[key])!==canonical(after[key]));
  const blockers = [...(scope_changes.length ? ['supplier_or_purpose_changed'] : []),...(after.assessment_date < before.assessment_date ? ['assessment_date_moved_backwards'] : [])];
  const oldReview = reviewSnapshot(before), newReview = reviewSnapshot(after);
  const coverage_changes = newReview.rows.flatMap(row=>{
    const old = oldReview.rows.find(item=>item.requirement_id===row.requirement_id);
    return old && old.status!==row.status ? [{requirement_id:row.requirement_id,before:old.status,after:row.status}] : [];
  });
  return {status:blockers.length ? 'not_comparable' : 'compared',comparison_blockers:blockers,scope_changes,
    requirements:changes(before.requirements,after.requirements),documents:changes(before.documents,after.documents),requests:changes(before.requests,after.requests),coverage_changes,
    limitations:['Local/imported history is editable and is not an authoritative audit trail.','Removed requirements, closed requests and better coverage do not prove resolution or approval.']};
}
export function exportMarkdown(packet) {
  validatePacket(packet); const s = packet.current, review = reviewSnapshot(s);
  // Quote user text so Markdown/HTML instructions cannot become active links or markup.
  const literal = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('`','&#96;').replaceAll('[','&#91;').replaceAll(']','&#93;').replaceAll('*','&#42;').replaceAll('_','&#95;').replaceAll('#','&#35;').replaceAll('!','&#33;').replaceAll('|','&#124;').replaceAll('\n','\n> ');
  const out = ['# Supplier evidence review packet','',`> Supplier: ${literal(s.supplier.name)}`,`> Country: ${literal(s.supplier.country)}`,`> Registration ID: ${literal(s.supplier.registration_id)}`,`> Purpose: ${literal(s.purpose)}`,`> Assessment: ${s.assessment_date}`,`> Next step: ${review.status}`,'', 'Human review required. No supplier approval or authenticity verification.','', '## Checklist'];
  for (const row of review.rows) {
    out.push('',`> ${literal(row.title)} (${row.required ? 'required' : 'optional'}): ${row.status}; owner: ${literal(row.owner)}`);
    for (const item of row.documents) {
      const document = s.documents.find(doc=>doc.id===item.document_id);
      out.push(`> Document ${literal(document.id)}: ${literal(document.title)}; issuer: ${literal(document.issuer)}; issued: ${document.issued_on || 'unknown'}; expires: ${document.expires_on || 'not provided'}`,
        `> Scope: ${literal(document.supplier_name)} / ${literal(document.scope)}`,`> Excerpt: ${literal(document.excerpt)}`,`> Issues: ${literal(item.issues.join('; ') || 'None in these bounded checks')}`);
      if (document.attachment) out.push(`> Attached file: ${literal(document.attachment.name)}; SHA-256: ${document.attachment.sha256}`);
    }
  }
  out.push('','## Request tracker');
  for (const row of s.requests) out.push('',`> ${literal(row.id)} / ${literal(row.requirement_id)}; ${row.status}; owner: ${literal(row.owner)}; requested: ${row.requested_on || 'not recorded'}; received: ${row.received_on || 'not recorded'}; note: ${literal(row.note)}`);
  out.push('','## Saved versions');
  for (const version of packet.versions) out.push(`> ${literal(version.version_id)} — ${version.saved_at}; ${literal(version.note)}`);
  if (packet.versions.length) out.push('','## Changes from latest saved version','', '```json',JSON.stringify(compareSnapshots(packet.versions.at(-1).snapshot,s),null,2).replaceAll('`','\\u0060').replaceAll('<','\\u003c'),'```');
  out.push('','## Limits',...review.limitations.map(text=>'- '+text),'','Attachments and complete snapshots travel in the separate JSON backup. This Markdown is a review summary.');
  return out.join('\n');
}
export function exportChecklistCsv(snapshot) {
  const cell = value => '"'+String(value).replace(/^[\s]*[=+@-]/u, match=>"'"+match).replaceAll('"','""')+'"';
  const review = reviewSnapshot(snapshot);
  return [['Requirement ID','Requirement','Required','Owner','Document status','Request status'],...review.rows.map(row=>[row.requirement_id,row.title,row.required,row.owner,row.status,snapshot.requests.filter(item=>item.requirement_id===row.requirement_id).map(item=>item.status).join('; ')])].map(row=>row.map(cell).join(',')).join('\r\n');
}
export async function verifyAttachments(packet, cryptoProvider = globalThis.crypto) {
  validatePacket(packet);
  const checked = new Set();
  for (const snapshot of [packet.current,...packet.versions.map(row=>row.snapshot)]) for (const row of snapshot.documents) {
    if (!row.attachment) continue;
    const file = row.attachment, key = file.sha256+':'+file.base64;
    if (checked.has(key)) continue;
    const bytes = Uint8Array.from(atob(file.base64),character=>character.charCodeAt(0));
    if (bytes.length > LIMITS.file) throw Error('Attachment exceeds 5 MiB.');
    const hash = [...new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    if (hash !== file.sha256) throw Error(`Attachment bytes do not match SHA-256: ${file.name}`);
    checked.add(key);
  }
  return packet;
}
