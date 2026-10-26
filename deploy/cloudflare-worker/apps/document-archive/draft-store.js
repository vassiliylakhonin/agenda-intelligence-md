import {reviewArchive} from '../../src/document-archive.js';

// One explicitly saved working copy per origin. A transaction owns the revision
// check and write; completion, not put.onsuccess, is the save acknowledgement.
export function archiveDraftStore(indexedDB){
  let opening;
  const open=()=>opening||=(new Promise((resolve,reject)=>{
    if(!indexedDB){reject(Error('Local storage is unavailable. Keep a checked JSON backup.'));return;}
    const request=indexedDB.open('agenda-document-archive',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'name'});
    request.onerror=()=>reject(Error('Local storage could not open. Working changes are retained.'));
    request.onblocked=()=>reject(Error('Close other archive tabs, then reload after downloading a backup.'));
    request.onsuccess=()=>resolve(request.result);
  }));
  const valid=row=>row&&row.name==='current'&&row.format==='agenda.document-archive-draft.v1'&&typeof row.revision==='string'&&typeof row.saved_at==='string'&&row.packet;
  async function transact(mode,action){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('drafts',mode),store=tx.objectStore('drafts');let result,failure;
      tx.oncomplete=()=>resolve(result);
      tx.onabort=tx.onerror=()=>reject(failure||Error('Local save failed. Working changes are retained; download a checked JSON backup.'));
      const request=store.get('current');
      request.onsuccess=()=>{try{result=action(store,request.result);}catch(error){failure=error;tx.abort();}};
    });
  }
  const matches=(row,revision)=>{if(row?!valid(row)||row.revision!==revision:revision!==null)throw Error('The saved draft changed in another tab, or has not been loaded. Keep a JSON backup, then load the saved draft before replacing it.');};
  return {
    async load(){const row=await transact('readonly',(_store,row)=>row||null);if(row){if(!valid(row))throw Error('Saved draft format is invalid. Working archive retained.');await reviewArchive(row.packet);}return row;},
    async save(packet,revision){
      const copy=structuredClone(packet);await reviewArchive(copy);
      return transact('readwrite',(store,row)=>{matches(row,revision);const next={name:'current',format:'agenda.document-archive-draft.v1',revision:crypto.randomUUID(),saved_at:new Date().toISOString(),packet:copy};store.put(next);return next;});
    },
    async remove(revision){return transact('readwrite',(store,row)=>{matches(row,revision);store.delete('current');return null;});}
  };
}
