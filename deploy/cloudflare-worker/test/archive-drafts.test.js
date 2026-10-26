import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveDraftStore} from '../apps/document-archive/draft-store.js';
import {archiveTemplate} from '../src/archive-templates.js';
import {archiveExample,reviewArchive} from '../src/document-archive.js';
import {archiveIDB} from './helpers/archive-idb.js';

test('draft saves survive reopening and acknowledge only committed transactions; failure retains the previous copy',async()=>{
  const db=archiveIDB(),store=archiveDraftStore(db.indexedDB),packet=await archiveExample();
  const first=await store.save(packet,null);assert.equal(db.rows.get('current').revision,first.revision);
  packet.title='Unsaved change';assert.notEqual(db.rows.get('current').packet.title,packet.title);
  db.control.fail=true;await assert.rejects(store.save(packet,first.revision),/save failed/);
  assert.equal((await store.load()).packet.title,'Synthetic archive example');db.control.fail=false;
  const reopened=archiveDraftStore(db.indexedDB);assert.equal((await reopened.load()).revision,first.revision);
  await reopened.remove(first.revision);assert.equal(await reopened.load(),null);
});
test('two writers cannot replace a newer draft or delete it using an old revision',async()=>{
  const db=archiveIDB(),a=archiveDraftStore(db.indexedDB),b=archiveDraftStore(db.indexedDB),packet=await archiveExample();
  const first=await a.save(packet,null);const loaded=await b.load();
  const results=await Promise.allSettled([a.save({...packet,title:'A'},first.revision),b.save({...packet,title:'B'},loaded.revision)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  await assert.rejects(b.remove(first.revision),/another tab/);assert.ok(await a.load());
});
test('corrupt persisted bytes and unavailable storage never become a successful load/save',async()=>{
  await assert.rejects(archiveDraftStore(null).load(),/unavailable/);
  const db=archiveIDB(),store=archiveDraftStore(db.indexedDB),packet=await archiveExample();
  const saved=await store.save(packet,null);db.rows.get('current').packet.files[0].sha256='0'.repeat(64);
  await assert.rejects(store.load(),/hash/);
  const corrupt=structuredClone(packet);corrupt.files[0].size=1;await assert.rejects(store.save(corrupt,saved.revision));
});
test('three checklists are isolated editable starters without supplied evidence or readiness claims',async()=>{
  for(const key of ['company','supplier','reporting']){
    const a=archiveTemplate(key,'2026-10-26'),b=archiveTemplate(key,'2026-10-26');a.requirements[0].title='Changed';
    assert.notEqual(a.requirements[0].title,b.requirements[0].title);assert.equal(b.files.length,0);
    const result=await reviewArchive(b);assert.equal(result.status,'collect_files');assert.equal(result.authorization_granted,false);
    assert.ok(b.requirements.some(row=>!row.required));assert.ok(b.requirements.every(row=>row.owner===''));
  }
  assert.throws(()=>archiveTemplate('__proto__'));assert.throws(()=>archiveTemplate('unknown'));
});
