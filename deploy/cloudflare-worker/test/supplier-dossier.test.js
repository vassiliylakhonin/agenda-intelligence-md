import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createPacket,saveVersion,reviewSnapshot,requestDraft,compareSnapshots,validatePacket,verifyAttachments,exportMarkdown,exportChecklistCsv} from '../src/supplier-dossier.js';
import {handleRequest} from '../src/index.js';

function snapshot(){return {supplier:{name:'Acme Services',country:'GB',registration_id:'012345'},purpose:'Maintenance supplier onboarding',assessment_date:'2026-10-22',
  requirements:[{id:'registration',title:'Company registration',owner:'Supplier contact',required:true},{id:'insurance',title:'Insurance certificate',owner:'Procurement owner',required:true}],
  documents:[{id:'doc-1',requirement_id:'registration',title:'Registration extract',issuer:'Registry',issued_on:'2026-10-01',expires_on:'',supplier_name:'Acme Services',scope:'Maintenance supplier onboarding',excerpt:'The supplied registration extract states company number 012345.',attachment:null}],requests:[]};}
function request(){return {id:'req-1',requirement_id:'insurance',owner:'Insurance owner',status:'closed',requested_on:'2026-10-20',received_on:'2026-10-21',note:'Caller says done'};}

test('supplier golden dossier exposes missing evidence and prepares owner draft without authorizing onboarding',()=>{
  const s=snapshot();s.requests.push(request());const result=reviewSnapshot(s);
  assert.equal(result.status,'collect_evidence');assert.equal(result.rows[0].status,'supplied_for_review');assert.equal(result.rows[1].status,'missing');
  assert.equal(result.authorization_granted,false);assert.equal(result.human_review_required,true);
  assert.match(requestDraft(s,'insurance'),/Insurance owner/);assert.match(requestDraft(s,'insurance'),/has not been sent/);
  assert.equal(s.requests[0].status,'closed','request status never upgrades missing evidence');
});
test('supplier review reports expiry, future dates, scope mismatch and absent source contents',()=>{
  const s=snapshot(),doc=s.documents[0];doc.issued_on='2026-10-23';doc.expires_on='2026-10-20';doc.supplier_name='Other supplier';doc.scope='Other purpose';doc.excerpt='';
  assert.deepEqual(reviewSnapshot(s).rows[0].documents[0].issues,['Issued after assessment date','Expired before assessment date','Expiry precedes issue date','Supplier scope differs','Purpose scope differs','No excerpt or attached file']);
  doc.issued_on='2026-02-30';assert.throws(()=>reviewSnapshot(s),/valid YYYY-MM-DD/);
});
test('no checklist, optional-only checklist and illustrative files do not become review-ready',()=>{
  const s=snapshot();s.documents[0].excerpt='Synthetic example only.';assert.equal(reviewSnapshot(s).rows[0].status,'needs_evidence');
  s.requirements.forEach(row=>row.required=false);assert.equal(reviewSnapshot(s).status,'define_requirements');
  s.requirements=[];s.documents=[];assert.equal(reviewSnapshot(s).status,'define_requirements');
});
test('history snapshots preserve adverse evidence and reject duplicate IDs, excessive history and invalid ordering',()=>{
  let packet=createPacket('dossier-1',snapshot());packet=saveVersion(packet,{id:'v1',at:'2026-10-22T01:00:00Z',note:'Initial gap'});
  packet.current.documents[0].excerpt='Changed source';assert.notEqual(packet.versions[0].snapshot.documents[0].excerpt,packet.current.documents[0].excerpt);
  assert.throws(()=>saveVersion(packet,{id:'v1',at:'2026-10-22T02:00:00Z'}),/Duplicate version/);
  assert.throws(()=>saveVersion(packet,{id:'v2',at:'2026-10-21T01:00:00Z'}),/time\/order/);
  const excessive=structuredClone(packet);excessive.versions=Array(21).fill(packet.versions[0]);assert.throws(()=>validatePacket(excessive),/At most 20/);
});
test('revision shows document, request and requirement removals without treating closed requests as resolved gaps',()=>{
  const old=snapshot();old.requests.push(request());const updated=structuredClone(old);
  updated.documents=[];updated.requests[0].note='Removed registration evidence';updated.requirements[1].required=false;
  const delta=compareSnapshots(old,updated);assert.equal(delta.status,'compared');assert.deepEqual(delta.documents.removed,['doc-1']);assert.deepEqual(delta.requests.changed,['req-1']);
  assert.deepEqual(delta.requirements.changed,['insurance']);assert.deepEqual(delta.coverage_changes,[{requirement_id:'registration',before:'supplied_for_review',after:'missing'}]);
  updated.requests=[];updated.requirements.pop();assert.deepEqual(compareSnapshots(old,updated).requirements.removed,['insurance']);
});
test('supplier, assignment or backwards assessment changes prevent a comparable progress claim',()=>{
  const old=snapshot();for(const change of [s=>s.supplier.name='Other supplier',s=>s.purpose='Different assignment',s=>s.assessment_date='2026-10-21']){
    const next=structuredClone(old);change(next);assert.equal(compareSnapshots(old,next).status,'not_comparable');
  }
});
test('portable JSON roundtrip verifies actual attachment bytes in both working and saved snapshots',async()=>{
  const s=snapshot(),bytes=new TextEncoder().encode('Attached registration bytes');
  const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  s.documents[0].attachment={name:'registration.txt',type:'text/plain',base64:Buffer.from(bytes).toString('base64'),sha256};
  const packet=saveVersion(createPacket('dossier-1',s),{id:'v1',at:'2026-10-22T00:00:00Z'});
  const imported=JSON.parse(JSON.stringify(packet));await verifyAttachments(imported);assert.deepEqual(imported,packet);
  imported.versions[0].snapshot.documents[0].attachment.base64=Buffer.from('Tampered bytes').toString('base64');
  await assert.rejects(verifyAttachments(imported),/do not match SHA-256/);
});
test('strict import rejects unknown shape, orphan records, duplicate record IDs and malformed attachments',()=>{
  for(const mutate of [p=>p.current.requirements.push(p.current.requirements[0]),p=>p.current.documents[0].requirement_id='unknown',p=>p.current.documents[0].attachment={name:'bad',type:'',base64:'***',sha256:'a'.repeat(64)},p=>p.current.evil='run instructions',p=>p.current.documents=null]){
    const packet=createPacket('id',snapshot());mutate(packet);assert.throws(()=>validatePacket(packet));
  }
});
test('review exports preserve source locators, requests and limitations while escaping executable markup and spreadsheet formulas',()=>{
  const s=snapshot();s.supplier.name='<script>alert(1)</script>';s.documents[0].excerpt='[Open](https://evil.test) <img src=x onerror=alert(1)>';s.requirements[0].title='=HYPERLINK("https://evil.test")';s.requests.push(request());
  const packet=createPacket('id',s),md=exportMarkdown(packet),csv=exportChecklistCsv(s);
  assert.doesNotMatch(md,/<script>|<img|\[Open\]\(/);assert.match(md,/doc-1/);assert.match(md,/Caller says done/);assert.match(md,/Human review required/);assert.match(csv,/"'=HYPERLINK/);
});
test('hosted local desk serves a no-network client and rejects uploads instead of entering the paid API',async()=>{
  const html=await handleRequest(new Request('https://example.test/supplier-desk'),{});
  assert.equal(html.status,200);assert.match(html.headers.get('content-security-policy'),/connect-src 'none'/);assert.match(html.headers.get('content-security-policy'),/form-action 'none'/);
  assert.match(await html.text(),/Supplier Evidence Desk/);
  const js=await handleRequest(new Request('https://example.test/supplier-desk.js'),{});assert.match(js.headers.get('content-type'),/javascript/);assert.doesNotMatch(await js.text(),/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/);
  const upload=await handleRequest(new Request('https://example.test/supplier-desk',{method:'POST',body:'private document'}),{});assert.equal(upload.status,405);
});
test('supplier route survives actual Worker bundling with Wrangler name retention',async()=>{
  const bundle=await build({entryPoints:[new URL('../src/index.js',import.meta.url).pathname],bundle:true,keepNames:true,platform:'neutral',format:'esm',write:false});
  const worker=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const html=await(await worker.handleRequest(new Request('https://example.test/supplier-desk'),{})).text();assert.match(html,/script src="\/supplier-desk.js"/);
  const landing=await(await worker.handleRequest(new Request('https://example.test/',{headers:{accept:'text/html'}}),{AGENT_PROFILE:'agenda_intelligence'})).text();assert.match(landing,/Open the free supplier workspace/);
});
