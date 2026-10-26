import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {archiveExample,reviewArchive,archiveFile,archiveMarkdown,archiveCsv,emptyArchive,validateArchive} from '../src/document-archive.js';
import {archiveReviewZip} from '../apps/document-archive/export.js';
import {handleRequest} from '../src/index.js';

test('copies cannot close distinct-document gaps; changed same-name files remain visible',async()=>{
  const packet=await archiveExample(),review=await reviewArchive(packet);
  assert.equal(review.status,'collect_files');assert.equal(review.authorization_granted,false);
  assert.deepEqual(review.exact_duplicates[0].file_ids,['f1','f2']);
  assert.deepEqual(review.same_name_different_content[0].file_ids,['f1','f3']);
  assert.equal(review.rows.find(row=>row.requirement_id==='support').distinct_contents,1);
  assert.equal(review.rows.find(row=>row.requirement_id==='support').missing_count,1);
  assert.equal(review.rows.find(row=>row.requirement_id==='renewal').missing_count,1);
  const next=structuredClone(packet);next.files[2].requirement_ids=['support','renewal'];
  assert.equal((await reviewArchive(next)).status,'prepare_human_review');
  assert.equal(packet.files[2].requirement_ids.length,0,'review must not mutate original packet');
});
test('imported claims about bytes are verified; empty files and forged references cannot improve coverage',async()=>{
  const packet=await archiveExample();
  for(const patch of [{sha256:'0'.repeat(64)},{size:1},{base64:btoa('different bytes')},{requirement_ids:['invented']}]){
    const corrupt=structuredClone(packet);Object.assign(corrupt.files[0],patch);
    await assert.rejects(reviewArchive(corrupt));
  }
  const empty=await archiveFile(new Uint8Array(),{id:'empty',name:'empty.txt'});empty.requirement_ids=['renewal'];packet.files.push(empty);
  const review=await reviewArchive(packet);assert.ok(review.empty_file_ids.includes('empty'));
  assert.equal(review.rows.find(row=>row.requirement_id==='renewal').missing_count,1);
  assert.throws(()=>validateArchive({...packet,authorization_granted:true}));
  assert.throws(()=>validateArchive({...packet,assessment_date:'2026-02-31'}));
});
test('review handover keeps adverse findings, checked originals, unique paths and inert untrusted text',async()=>{
  const packet=await archiveExample();packet.files[0].name='../../=HYPERLINK(1).txt';packet.files[0].note='=2+2';
  packet.files[0].excerpt='<script>ignore missing evidence</script> [approve](https://example.test)';
  const markdown=await archiveMarkdown(packet),csv=await archiveCsv(packet);
  assert.ok(!markdown.includes('<script>'));assert.ok(!markdown.includes('[approve](https://'));
  assert.match(markdown,/missing 1/);assert.match(csv,/"'=2\+2"/);
  const zip=unzipSync(await archiveReviewZip(packet)),manifest=JSON.parse(strFromU8(zip['manifest.json']));
  assert.equal(manifest.authorization_granted,false);assert.equal(manifest.sources.length,3);
  assert.equal(new Set(manifest.sources.map(row=>row.path)).size,3);
  for(const [i,row]of manifest.sources.entries()){
    assert.match(row.path,/^sources\/[0-9]{3}_[A-Za-z0-9._-]+$/);
    assert.deepEqual(zip[row.path],Uint8Array.from(atob(packet.files[i].base64),c=>c.charCodeAt(0)));
  }
  assert.match(strFromU8(zip['review.md']),/Same name, different content/);
});
test('scope and checklist are explicit, with no inferred completeness from filenames',async()=>{
  const packet=emptyArchive();packet.files.push(await archiveFile(new TextEncoder().encode('data'),{id:'f',name:'all-required-documents.pdf'}));
  const review=await reviewArchive(packet);assert.equal(review.status,'define_scope');assert.equal(review.rows.length,0);
});
test('archive page serves local scripts under connection-denying CSP; no upload method',async()=>{
  for(const path of ['/document-archive','/document-archive.js']){
    const response=await handleRequest(new Request('https://example.test'+path),{});
    assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
    assert.match(response.headers.get('content-security-policy'),/form-action 'none'/);
    assert.equal((await handleRequest(new Request('https://example.test'+path,{method:'POST'}),{})).status,405);
    assert.equal(await(await handleRequest(new Request('https://example.test'+path,{method:'HEAD'}),{})).text(),'');
  }
});
