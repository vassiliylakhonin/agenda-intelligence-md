import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {SUPPLIER_DESK_CLIENT} from '../src/supplier-desk-bundle.js';
import {reviewSnapshot} from '../src/supplier-dossier.js';

class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.value='';this.textContent='';this.className='';this.checked=false;this.files=[];}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;this.textContent='';}
  find(text){return this.textContent===text?this:this.children.map(node=>node.find(text)).find(Boolean);}
  all(){return [this,...this.children.flatMap(node=>node.all())];}
  click(){return this.onclick?.();} remove(){} focus(){} select(){}
}
function memoryDatabase(){
  const rows=new Map(),control={fail:false};
  const db={close(){},createObjectStore(){},transaction(_name,mode){
    const tx={},operations=[];let scheduled=false,aborted=false;
    const finish=()=>{if(!scheduled){scheduled=true;setTimeout(()=>{if(!aborted)tx.oncomplete?.();},0);}};
    tx.abort=()=>{aborted=true;queueMicrotask(()=>tx.onabort?.());};
    tx.objectStore=()=>({
      get(id){const request={};queueMicrotask(()=>{request.result=structuredClone(rows.get(id));request.onsuccess?.();finish();});return request;},
      getAll(){const request={};queueMicrotask(()=>{request.result=structuredClone([...rows.values()]);finish();});return request;},
      put(value){const request={};operations.push(value);queueMicrotask(()=>{
        if(control.fail){tx.abort();return;}
        rows.set(value.dossier_id,structuredClone(value));request.result=value.dossier_id;finish();
      });return request;}
    });return tx;
  }};
  const indexedDB={open(){const request={result:db};setTimeout(()=>{request.onupgradeneeded?.();request.onsuccess?.();},0);return request;}};
  return {indexedDB,rows,control};
}
async function browser(storage=memoryDatabase(),Worker){
  const elements=new Map(),body=new Element('body'),main=new Element('main');
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const downloads=[];
  const context={Worker,crypto,TextEncoder,Uint8Array,Blob,atob,btoa,setTimeout,clearTimeout,URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:local';},revokeObjectURL(){}},
    indexedDB:storage.indexedDB,navigator:{clipboard:{writeText:async()=>{}}},window:{confirm:()=>true,addEventListener(){}},
    document:{body,getElementById:get,createElement:tag=>new Element(tag),querySelector:()=>main,
      querySelectorAll:selector=>[...elements.values()].flatMap(node=>node.all()).filter(node=>selector==='button'?node.tagName==='BUTTON':node.tagName==='TEXTAREA'&&node.readOnly)}};
  vm.runInNewContext(SUPPLIER_DESK_CLIENT,context);
  await new Promise(resolve=>setTimeout(resolve,15));
  return {get,downloads,storage,async click(id){await get(id).onclick();},async sample(){await get('sample-dossier').onclick();}};
}
test('actual browser bundle preserves working changes on quota failure and saves only after transaction completion',async()=>{
  const b=await browser();await b.sample();b.storage.control.fail=true;
  await b.click('save-version');assert.match(b.get('status').textContent,/Nothing was marked saved/);assert.equal(b.storage.rows.size,0);assert.match(b.get('save-state').textContent,/Unsaved/);
  await b.click('export-json');const backup=JSON.parse(await b.downloads.at(-1).text());assert.equal(backup.versions.length,0);assert.equal(backup.current.supplier.registration_id,'DEMO-001');
  b.storage.control.fail=false;await b.click('save-version');assert.equal(b.storage.rows.size,1);assert.equal([...b.storage.rows.values()][0].versions.length,1);assert.match(b.get('save-state').textContent,/Saved on this device/);
});
test('two browser tabs cannot replace a newer saved history with a stale snapshot',async()=>{
  const storage=memoryDatabase(),a=await browser(storage);await a.sample();await a.click('save-version');
  const id=[...storage.rows.keys()][0],b=await browser(storage);b.get('saved-dossiers').value=id;await b.click('open-dossier');
  a.get('version-note').value='Version from first tab';await a.click('save-version');
  b.get('version-note').value='Stale second tab';await b.click('save-version');
  assert.match(b.get('status').textContent,/changed in another tab/);assert.equal(storage.rows.get(id).versions.length,2);
  assert.equal(storage.rows.get(id).versions[1].note,'Version from first tab');
});
test('browser imports create a new local identity and retain prior snapshots without overwriting stored dossiers',async()=>{
  const b=await browser();await b.sample();await b.click('save-version');await b.click('export-json');
  const text=await b.downloads.at(-1).text(),original=JSON.parse(text);
  b.get('import-dossier').files=[{size:new TextEncoder().encode(text).length,text:async()=>text}];await b.get('import-dossier').onchange();
  assert.match(b.get('status').textContent,/separate unsaved dossier/);await b.click('save-version');
  assert.equal(b.storage.rows.size,2);assert.equal(b.storage.rows.get(original.dossier_id).versions.length,1);
  assert.equal([...b.storage.rows.values()].find(row=>row.dossier_id!==original.dossier_id).versions.length,2);
});
test('actual UI bundle keeps an explicit OCR warning in portable excerpts without changing metadata',async()=>{
  class Processor{
    postMessage(){queueMicrotask(()=>this.onmessage({data:{protocol:'agenda.document.v1',ok:true,result:{status:'needs_ocr',kind:'pdf',text:'',units:1,empty_pages:[1],warnings:['No extractable text on page 1. OCR or manual review is needed.']}}}));}
    terminate(){}
  }
  const b=await browser(memoryDatabase(),Processor);await b.sample();
  const input=b.get('documents').all().find(node=>node.type==='file');input.files=[{name:'scan.pdf',type:'application/pdf',size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer}];await input.onchange();
  await b.get('documents').find('Read PDF / DOCX text').click();
  await b.get('documents').find('Record OCR / manual excerpt needed').click();await b.click('export-json');
  const p=JSON.parse(await b.downloads.at(-1).text());assert.match(p.current.documents[0].excerpt,/Extraction: needs_ocr/);assert.equal(p.current.documents[0].issuer,'Fictional registry');
  assert.match(reviewSnapshot(p.current).rows[0].documents[0].issues.join(' '),/OCR or a manual excerpt/);
});
