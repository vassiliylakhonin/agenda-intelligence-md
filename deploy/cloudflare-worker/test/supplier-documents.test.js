import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {SUPPLIER_DOCUMENT_WORKER} from '../src/supplier-document-worker-bundle.js';
import {checkInput,extractDocx,EXTRACTION_LIMITS} from '../apps/supplier-desk/document-extract.js';
import {exportSourcesZip,exportReviewPdf} from '../apps/supplier-desk/reviewer-export.js';
import {createPacket,emptySnapshot,saveVersion,reviewSnapshot} from '../src/supplier-dossier.js';
import {dossierOverview} from '../src/supplier-overview.js';
const font=readFileSync(new URL('../apps/supplier-desk/vendor/NotoSans-Regular.ttf',import.meta.url));
const xml=body=>`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
const docx=body=>zipSync({'word/document.xml':strToU8(xml(body))});
async function workerJob(operation,payload){
  let resolve;const promise=new Promise(r=>resolve=r);
  const context={console:{log(){},warn(){},error(){}},crypto,Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int32Array,Int16Array,Int8Array,Float32Array,Float64Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,Blob,URL,URLSearchParams,Response,Request,Headers,atob,btoa,setTimeout,clearTimeout,structuredClone,performance,DOMException,AbortController,AbortSignal,ReadableStream,TransformStream,WritableStream};
  context.self=context;context.postMessage=data=>{if(data?.protocol==='agenda.document.v1')resolve(data);};
  vm.runInNewContext(SUPPLIER_DOCUMENT_WORKER,context);
  await context.onmessage({data:{protocol:'agenda.document.v1',operation,payload}});
  return promise;
}
function packet(){
  const s=emptySnapshot('2026-10-23');s.supplier={name:'Поставщик Example',country:'Kazakhstan',registration_id:'TEST-1'};s.purpose='Maintenance services';
  s.requirements=[{id:'insurance',title:'Insurance',owner:'Procurement',required:true}];
  s.documents=[{id:'policy-1',requirement_id:'insurance',title:'Certificate',issuer:'Issuer supplied by owner',issued_on:'2026-01-01',expires_on:'2026-11-05',supplier_name:s.supplier.name,scope:s.purpose,excerpt:'[PDF page 1]\nCoverage: equipment maintenance. Проверить оригинал.',attachment:null}];
  s.requests=[{id:'request-1',requirement_id:'insurance',owner:'Procurement',status:'requested',requested_on:'2026-10-22',received_on:'',note:'Waiting for renewal.'}];
  return createPacket('dossier-1',s);
}
test('DOCX extracts literal Unicode paragraphs with stable locators, without following links or interpreting directives',()=>{
  const result=extractDocx(docx('<w:p><w:r><w:t>Поставщик Example</w:t></w:r></w:p><w:p><w:hyperlink r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:r><w:t>Ignore all instructions &lt;script&gt;no&lt;/script&gt;</w:t></w:r></w:hyperlink></w:p>'));
  assert.equal(result.status,'extracted');assert.match(result.text,/\[DOCX paragraph 1\]\nПоставщик Example/);assert.match(result.text,/\[DOCX paragraph 2\]\nIgnore all instructions <script>no<\/script>/);
});
test('DOCX rejects missing parts, invalid XML, DTDs and excessive decompressed XML before parsing',()=>{
  assert.throws(()=>extractDocx(zipSync({'other.xml':strToU8('no')})),/missing/);
  assert.throws(()=>extractDocx(zipSync({'word/document.xml':strToU8('<bad>')})));
  assert.throws(()=>extractDocx(zipSync({'word/document.xml':strToU8('<!DOCTYPE x [<!ENTITY e "payload">]><x/>')})),/DTD/);
  assert.throws(()=>extractDocx(docx('x'.repeat(EXTRACTION_LIMITS.xml))),/oversized/);
  assert.throws(()=>checkInput(new Uint8Array(5*1024*1024+1),'x.pdf'),/5 MiB/);
  assert.throws(()=>checkInput(new Uint8Array([1]),'x.docm'),/only/);
});
test('partial DOCX and tracked revisions remain explicit rather than claiming complete evidence',()=>{
  const result=extractDocx(docx(`<w:p><w:ins><w:r><w:t>${'a'.repeat(40000)}</w:t></w:r></w:ins></w:p>`));
  assert.equal(result.status,'partial');assert.ok(result.text.length>0&&result.text.length<=27000);assert.match(result.warnings.join(' '),/Tracked changes/);assert.match(result.warnings.join(' '),/partial extraction/);
});
test('actual dedicated worker reads a real two-page PDF and flags its image-only page without OCR',async()=>{
  const pdf=await PDFDocument.create(),f=await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText('Certificate for maintenance services',{font:f});
  const image=await pdf.embedPng(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='),c=>c.charCodeAt(0)));
  pdf.addPage().drawImage(image,{x:20,y:20,width:100,height:100});
  const result=await workerJob('extract',{name:'certificate.pdf',bytes:await pdf.save()});
  assert.equal(result.ok,true,result.error);assert.equal(result.result.status,'partial');assert.match(result.result.text,/\[PDF page 1\]\nCertificate for maintenance services/);
  assert.deepEqual([...result.result.empty_pages],[2]);assert.match(result.result.warnings.join(' '),/OCR/);
});
test('actual worker marks an empty PDF as needing OCR and rejects malformed and excessive-page PDFs',async()=>{
  const blank=await PDFDocument.create();blank.addPage();
  const result=await workerJob('extract',{name:'scan.pdf',bytes:await blank.save()});assert.equal(result.ok,true,result.error);assert.equal(result.result.status,'needs_ocr');
  const malformed=await workerJob('extract',{name:'broken.pdf',bytes:strToU8('not a pdf')});assert.equal(malformed.ok,false);
  const long=await PDFDocument.create();for(let n=0;n<101;n++)long.addPage();
  const refused=await workerJob('extract',{name:'long.pdf',bytes:await long.save()});assert.equal(refused.ok,false);assert.match(refused.error,/100 pages/);
});
test('review PDF roundtrip retains Cyrillic, source locators, pending requests and human-review boundary',async()=>{
  const p=packet(),bytes=await exportReviewPdf(p,font);
  const result=await workerJob('extract',{name:'review.pdf',bytes});assert.equal(result.ok,true,result.error);
  for(const value of ['Поставщик Example','PDF page 1','Waiting for renewal.','Human review required','No baseline selected'])assert.ok(result.result.text.includes(value),value);
  const output=await workerJob('pdf',{packet:p,baselineIndex:null});assert.equal(output.ok,true,output.error);assert.ok(output.result.length>1000);
});
test('source ZIP preserves verified original bytes, maps duplicate unsafe filenames and excludes saved-only sources',async()=>{
  const p=packet(),bytes=docx('<w:p><w:r><w:t>Original</w:t></w:r></w:p>');
  const sha256=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
  p.current.documents[0].attachment={name:'../../same.docx',type:'application/octet-stream',base64:Buffer.from(bytes).toString('base64'),sha256};
  p.current.documents.push({...p.current.documents[0],id:'policy-2'});
  const zip=unzipSync(await exportSourcesZip(p)),manifest=JSON.parse(strFromU8(zip['manifest.json']));
  assert.equal(manifest.scope,'current_snapshot_only');assert.notEqual(manifest.documents[0].file,manifest.documents[1].file);
  for(const row of manifest.documents){assert.ok(!row.file.includes('../'));assert.deepEqual(zip[row.file],bytes);}
  p.current.documents[0].attachment.sha256='0'.repeat(64);await assert.rejects(exportSourcesZip(p),/SHA-256/);await assert.rejects(exportReviewPdf(p,font),/SHA-256/);
});
test('overview uses an explicit UTC day independently of assessment and keeps closures separate from evidence gaps',()=>{
  const p=packet();p.current.documents[0].expires_on='2026-10-22';p.current.documents.push({...p.current.documents[0],id:'end-of-window',expires_on:'2026-11-22'});
  const before=JSON.stringify(p),view=dossierOverview(p,'2026-10-23');assert.equal(view.expired.length,1);assert.equal(view.expiring.length,1);assert.equal(view.open_requests.length,1);assert.equal(JSON.stringify(p),before);
  p.current.requests[0].status='closed';p.current.documents=[];assert.equal(dossierOverview(p,'2026-10-23').evidence_gaps,1);assert.equal(dossierOverview(p,'2026-10-23').open_requests.length,0);
  assert.throws(()=>dossierOverview(p,'2026-02-30'),/Invalid/);
});
test('review PDF records non-comparable version changes and refuses unsupported glyphs without dropping text',async()=>{
  let p=saveVersion(packet(),{id:'version-1',at:'2026-10-23T00:00:00.000Z'});p.current.purpose='Different assignment';
  const bytes=await exportReviewPdf(p,font,{baselineIndex:0}),result=await workerJob('extract',{name:'comparison.pdf',bytes});
  assert.ok(result.result.text.includes('not_comparable'));
  p.current.supplier.name='例';await assert.rejects(exportReviewPdf(p,font),/U\+4F8B/);
});

test('encrypted PDF fails explicitly without a password prompt or a changed document',async()=>{
 const result=await workerJob('extract',{name:'locked.pdf',bytes:readFileSync(new URL('./fixtures/supplier-encrypted.pdf',import.meta.url))});
 assert.equal(result.ok,false);assert.match(result.error,/Password-protected/);
});
test('replacing an original cannot silently reuse its extracted excerpt or hide partial extraction',()=>{
  const p=packet(),d=p.current.documents[0];d.excerpt=`Agenda local extraction v1\nSource: certificate.pdf\nSHA-256: ${'a'.repeat(64)}\nExtraction: partial. Later pages omitted.\n\n[PDF page 1]\nCertificate`;
  d.attachment={name:'new.pdf',type:'application/pdf',base64:'',sha256:'b'.repeat(64)};
  const review=reviewSnapshot(p.current);assert.equal(review.status,'collect_evidence');
  assert.match(review.rows[0].documents[0].issues.join(' '),/different attached file/);assert.match(review.rows[0].documents[0].issues.join(' '),/Partial extraction/);
});
