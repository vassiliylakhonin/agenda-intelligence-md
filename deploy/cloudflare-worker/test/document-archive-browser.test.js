import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {DOCUMENT_ARCHIVE_CLIENT} from '../src/document-archive-bundle.js';

class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.value='';this.textContent='';this.files=[];}
  append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;this.textContent='';}
  all(){return [this,...this.children.flatMap(node=>node.all())];}find(text){return this.all().find(node=>node.textContent===text);}
  click(){return this.onclick?.();}
}
function browser(){
  const elements=new Map(),downloads=[];
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const denied=()=>{throw Error('Archive UI must not use network or persistence');};
  vm.runInNewContext(DOCUMENT_ARCHIVE_CLIENT,{crypto,TextEncoder,TextDecoder,Uint8Array,Blob,atob,btoa,setTimeout,clearTimeout,
    fetch:denied,indexedDB:{open:denied},localStorage:{setItem:denied,getItem:denied},
    window:{confirm:()=>true},URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:local';},revokeObjectURL(){}},
    document:{getElementById:get,createElement:tag=>new Element(tag)}});
  return {get,downloads,click:async id=>get(id).onclick(),async backup(){await get('download-json').onclick();return JSON.parse(await downloads.at(-1).text());}};
}
test('actual archive bundle retains the working packet after corrupt backup and oversize batch failure',async()=>{
  const b=browser();await b.click('example');const original=await b.backup();
  const corrupt=structuredClone(original);corrupt.files[0].sha256='0'.repeat(64);const text=JSON.stringify(corrupt);
  b.get('restore').files=[{size:text.length,text:async()=>text}];await b.get('restore').onchange();
  assert.match(b.get('status').textContent,/bytes|hash|digest|SHA/i);assert.deepEqual(await b.backup(),original);
  b.get('add-files').files=[{name:'too-large.txt',size:5242881,arrayBuffer:()=>{throw Error('Must reject before reading');}}];
  await b.get('add-files').onchange();assert.match(b.get('status').textContent,/No files were added/);
  assert.deepEqual(await b.backup(),original);assert.equal(b.get('workspace').inert,false);
});
test('actual archive bundle handles local uploads, explicit assignment, literal text and reviewer exports',async()=>{
  const b=browser();b.get('title').value='Fictional handover';b.get('title').oninput();b.get('purpose').value='A person reviews the supplied evidence';b.get('purpose').oninput();
  await b.click('add-requirement');
  const bytes=new TextEncoder().encode('Fictional local evidence');
  b.get('add-files').files=[{name:'<script>source.txt',type:'text/plain',size:bytes.length,arrayBuffer:async()=>bytes.buffer}];
  await b.get('add-files').onchange();
  assert.equal(b.get('files').find('<script>source.txt').tagName,'H3');
  const checkbox=b.get('files').all().find(node=>node.type==='checkbox');checkbox.checked=true;checkbox.onchange();
  await b.click('review-run');assert.ok(b.get('review').find('Next step: Prepare the human review'));
  await b.get('files').find('Read PDF / DOCX / UTF-8 text locally').click();
  await b.get('files').find('Use this text as the editable excerpt').click();
  const saved=await b.backup();assert.equal(saved.files[0].excerpt,'Fictional local evidence');assert.equal(saved.files[0].requirement_ids.length,1);
  await b.click('download-md');assert.match(await b.downloads.at(-1).text(),/Human review|human review/);
  await b.click('download-csv');assert.match(await b.downloads.at(-1).text(),/source.txt/);
  assert.equal(b.get('workspace').inert,false);
});
