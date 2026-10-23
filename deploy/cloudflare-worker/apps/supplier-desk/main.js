import {FORMAT,LIMITS,REQUEST_STATUSES,emptySnapshot,createPacket,validatePacket,saveVersion,reviewSnapshot,requestDraft,compareSnapshots,exportMarkdown,exportChecklistCsv,verifyAttachments} from '../../src/supplier-dossier.js';
import {dossierOverview} from '../../src/supplier-overview.js';
import {documentJob} from './document-client.js';
const extracted=new Map();

const $ = id=>document.getElementById(id);
const copy = value=>JSON.parse(JSON.stringify(value));
let packet = {format:FORMAT,dossier_id:crypto.randomUUID(),current:emptySnapshot(),versions:[]};
let dirty = true, busy = false, database;
function status(text,error = false) { $('status').textContent=text; $('status').className=error ? 'error' : ''; }
function changed() { dirty=true; $('save-state').textContent='Unsaved changes. Save a version or download a JSON backup.'; $('comparison').replaceChildren(); $('review').textContent='The dossier changed. Refresh the evidence checklist.'; document.querySelectorAll('#requests textarea[readonly]').forEach(node=>node.value=''); }
function element(tag,text,attrs = {}) { const node=document.createElement(tag); if(text!==undefined)node.textContent=text; Object.assign(node,attrs); return node; }
function button(text,action,secondary=true) {const node=element('button',text,{type:'button',className:secondary?'secondary':''});node.onclick=()=>run(action);return node;}
function field(parent,title,row,key,{type='text',max=500,options}={}) {
  const label=element('label',title), input=element(options?'select':type==='textarea'?'textarea':'input');
  if(options)for(const [value,text]of options)input.append(element('option',text,{value}));
  else {input.type=type;input.maxLength=max;}
  if(type==='checkbox')input.checked=row[key];else input.value=row[key];
  input.oninput=()=>{row[key]=type==='checkbox'?input.checked:input.value;changed();};
  label.append(input);parent.append(label);return input;
}
function removeRecord(rows,row) {rows.splice(rows.indexOf(row),1);changed();render();}
async function run(action) {
  if(busy)return;busy=true;
  document.querySelector('main').inert=true;
  document.querySelectorAll('button').forEach(node=>node.disabled=true);
  try{await action();}catch(error){status(error.message||'Action failed; the working dossier remains available.',true);}
  finally{busy=false;document.querySelector('main').inert=false;document.querySelectorAll('button').forEach(node=>node.disabled=false);}
}
function transaction(mode,action) {
  return new Promise((resolve,reject)=>{
    if(!database)return reject(Error('Device storage is unavailable. Download a JSON backup instead.'));
    const tx=database.transaction('dossiers',mode),request=action(tx.objectStore('dossiers'));
    tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(Error('Device storage failed. Nothing was marked saved. Download a JSON backup.'));tx.onabort=tx.onerror;
  });
}
async function listSaved(selected=packet.dossier_id) {
  if(!database)return;
  const rows=await transaction('readonly',store=>store.getAll());$('saved-dossiers').replaceChildren(element('option','Choose a saved dossier',{value:''}));
  rows.sort((a,b)=>(b.versions.at(-1)?.saved_at||'').localeCompare(a.versions.at(-1)?.saved_at||''));
  for(const row of rows)$('saved-dossiers').append(element('option',row.current.supplier.name+' · '+row.current.purpose+' · '+new Date(row.versions.at(-1)?.saved_at).toLocaleString(),{value:row.dossier_id}));
  $('saved-dossiers').value=selected;
  renderOverview(rows);
}
async function openSaved(id,comparePrevious=false){
  if(!id)throw Error('Choose a saved dossier.');if(!discardAllowed())return;
  const loaded=await transaction('readonly',store=>store.get(id));await verifyAttachments(loaded);packet=loaded;dirty=false;extracted.clear();render();
  if(comparePrevious&&packet.versions.length){$('baseline').value=String(Math.max(0,packet.versions.length-2));compare();}
  status('Opened saved dossier from this browser.');
}
function renderOverview(rows){
  const root=$('dossier-overview');root.replaceChildren();const today=$('overview-date').value;
  if(!rows.length){root.textContent='No saved dossiers yet. Save a version to include it in this overview.';return;}
  for(const saved of rows){
    const card=element('div',undefined,{className:'record'});
    try{
      const view=dossierOverview(saved,today);
      card.append(element('h3',view.supplier),element('p',view.purpose),element('p',`As of ${today} (UTC) · original assessment ${view.assessment_date} · ${view.versions} versions`),
        element('p',`${view.evidence_gaps} required evidence gaps at assessment · ${view.expired.length} expired now · ${view.expiring.length} expire within 30 days · ${view.open_requests.length} pending owner requests`));
      for(const row of view.expired)card.append(element('p',`Expired: ${row.title||row.id} · ${row.date}`,{className:'gap'}));
      for(const row of view.expiring)card.append(element('p',`Expiring: ${row.title||row.id} · ${row.date}`,{className:'gap'}));
      for(const row of view.open_requests){const req=saved.current.requirements.find(item=>item.id===row.requirement_id);card.append(element('p',`${row.status}: ${req?.title||row.requirement_id} · owner ${row.owner||'Unassigned'}`));}
      card.append(button('Open '+view.supplier,()=>openSaved(saved.dossier_id)),button('Compare latest update',()=>openSaved(saved.dossier_id,true)));
    }catch{card.append(element('p','Saved dossier could not be summarized. Open a checked JSON backup; no record was changed.'));}
    root.append(card);
  }
}
function discardAllowed() {const s=packet.current;return !dirty||(!s.supplier.name&&!s.purpose&&!s.requirements.length&&!s.documents.length&&!s.requests.length)||window.confirm('Discard the unsaved working changes? Saved versions are kept on this device.');}
function persistVersion(next){
  return new Promise((resolve,reject)=>{
    if(!database)return reject(Error('Device storage is unavailable. Download a JSON backup instead.'));
    const tx=database.transaction('dossiers','readwrite'),store=tx.objectStore('dossiers'),request=store.get(packet.dossier_id);let conflict=false;
    request.onsuccess=()=>{
      const stored=request.result;
      if(stored && (stored.versions.length!==packet.versions.length||stored.versions.at(-1)?.version_id!==packet.versions.at(-1)?.version_id)){conflict=true;tx.abort();return;}
      store.put(next);
    };
    tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Device storage failed. Download a JSON backup; working changes are retained.'));
    tx.onabort=()=>reject(Error(conflict?'This dossier changed in another tab. Download a backup of your changes, then reopen the saved dossier.':'Device storage failed. Nothing was marked saved. Download a JSON backup.'));
  });
}
function render() {
  $('comparison').replaceChildren();
  const s=packet.current;
  for(const [id,row,key]of [['supplier-name',s.supplier,'name'],['supplier-country',s.supplier,'country'],['supplier-registration',s.supplier,'registration_id'],['purpose',s,'purpose'],['assessment-date',s,'assessment_date']]){
    $(id).value=row[key];$(id).oninput=()=>{row[key]=$(id).value;changed();};
  }
  $('requirements').replaceChildren();
  for(const [index,row]of s.requirements.entries()){
    const card=element('div',undefined,{className:'record'});card.append(element('small','Requirement '+(index+1)));
    field(card,'Required document / evidence',row,'title');field(card,'Responsible owner',row,'owner',{max:200});field(card,'Required for this assignment',row,'required',{type:'checkbox'});
    card.append(button('Remove requirement',()=>{
      if(s.documents.some(item=>item.requirement_id===row.id)||s.requests.some(item=>item.requirement_id===row.id))throw Error('Remove or reassign the linked documents and requests first.');
      removeRecord(s.requirements,row);
    }));$('requirements').append(card);
  }
  $('documents').replaceChildren();
  for(const row of s.documents){
    const card=element('details',undefined,{className:'record',open:true});card.append(element('summary',row.title||'New document'));
    field(card,'Checklist requirement',row,'requirement_id',{options:s.requirements.map(item=>[item.id,item.title||item.id])});
    const meta=element('div',undefined,{className:'row'});field(meta,'Document title',row,'title');field(meta,'Issuer',row,'issuer',{max:200});card.append(meta);
    const dates=element('div',undefined,{className:'row'});field(dates,'Issue date',row,'issued_on',{type:'date'});field(dates,'Expiry (if applicable)',row,'expires_on',{type:'date'});card.append(dates);
    field(card,'Supplier scope',row,'supplier_name',{max:200});field(card,'Purpose scope',row,'scope',{max:1000});field(card,'Authorized excerpt / source text (optional with an attached file)',row,'excerpt',{type:'textarea',max:30000});
    const fileLabel=element('label','Attach or replace a source file'),input=element('input',undefined,{type:'file'});fileLabel.append(input);card.append(fileLabel);
    input.onchange=()=>run(async()=>{
      const file=input.files?.[0];if(!file)return;if(file.size>LIMITS.file)throw Error('File exceeds 5 MiB.');
      const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let offset=0;offset<bytes.length;offset+=16384)binary+=String.fromCharCode(...bytes.subarray(offset,offset+16384));
      const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
      row.attachment={name:file.name.slice(0,200),type:file.type.slice(0,100),base64:btoa(binary),sha256};extracted.delete(row.id);changed();render();status('File attached locally. Choose Read PDF / DOCX text to prepare a source-linked excerpt, then save a version.');
    });
    if(row.attachment){
      card.append(element('p',row.attachment.name+' · SHA-256 '+row.attachment.sha256,{className:'muted quiet'}));
      card.append(button('Download attached file',()=>download(Uint8Array.from(atob(row.attachment.base64),char=>char.charCodeAt(0)),row.attachment.name,'application/octet-stream')),
        button('Remove attachment',()=>{row.attachment=null;extracted.delete(row.id);changed();render();}));
      if(/\.(pdf|docx)$/iu.test(row.attachment.name))card.append(button('Read PDF / DOCX text',async()=>{
        status('Reading locally. The original stays attached; text is not yet part of the dossier.');
        const result=await documentJob('extract',{name:row.attachment.name,bytes:Uint8Array.from(atob(row.attachment.base64),c=>c.charCodeAt(0))});
        extracted.set(row.id,{hash:row.attachment.sha256,...result});render();status(result.status==='needs_ocr'||result.status==='no_text'?'No extractable text. Use authorized OCR or a manual excerpt; the original is retained.':'Extraction ready for review. Check it against the original before using it as an excerpt.');
      }));
      const result=extracted.get(row.id);
      if(result?.hash===row.attachment.sha256){
        const preview=element('div',undefined,{className:'record'});preview.append(element('h3','Local extraction: '+result.status.replaceAll('_',' ')));
        for(const warning of result.warnings)preview.append(element('p',warning,{className:'muted quiet'}));
        preview.append(element('textarea',undefined,{value:result.text,readOnly:true,ariaLabel:'Extracted text with source locators'}));
        if(result.text)preview.append(button('Use extracted text as editable excerpt',()=>{
          if(row.excerpt&&!window.confirm('Replace the existing excerpt? The attached original and saved versions are retained.'))return;
          const value=`Agenda local extraction v1\nSource: ${row.attachment.name.replaceAll(/[\r\n]/gu,' ')}\nSHA-256: ${row.attachment.sha256}\nExtraction: ${result.status}. ${result.warnings.join(' ')}\n\n${result.text}`;
          if(value.length>30000)throw Error('Extract is too large. Supply a shorter authorized excerpt manually.');
          row.excerpt=value;changed();render();status('Source-linked text copied to the editable excerpt. Metadata was not inferred. Save a version after reviewing it.');
        }));card.append(preview);
      }
    }
    card.append(button('Remove document',()=>removeRecord(s.documents,row)));$('documents').append(card);
  }
  renderRequests();
  $('baseline').replaceChildren(element('option','Choose a saved version',{value:''}));
  for(const [index,version]of packet.versions.entries())$('baseline').append(element('option',`Version ${index+1} · ${version.saved_at} · ${version.note}`,{value:String(index)}));
  if(packet.versions.length)$('baseline').value=String(packet.versions.length-1);
  $('save-state').textContent=dirty?'Unsaved working changes.':`Saved on this device · ${packet.versions.length} versions. Keep a JSON backup.`;
  renderReview();
}
function renderReview(){
  $('review').replaceChildren();
  if(!packet.current.supplier.name.trim()||!packet.current.purpose.trim()){$('review').textContent='Enter the supplier and assignment, then define the checklist to see documentary gaps.';return;}
  try{
    const review=reviewSnapshot(packet.current);$('review').append(element('p','Next step: '+review.status.replaceAll('_',' '),{className:'tag'}));
    const table=element('table'),head=element('tr');for(const title of ['Requirement','Owner','Document status','Gaps'])head.append(element('th',title));table.append(head);
    for(const row of review.rows){const tr=element('tr');for(const value of [row.title,row.owner||'Unassigned',row.status.replaceAll('_',' '),row.documents.flatMap(item=>item.issues).join('; ')|| (row.status==='missing'?'Document not supplied':'None in bounded checks')])tr.append(element('td',value));table.append(tr);}
    const wrap=element('div',undefined,{className:'table-wrap'});wrap.append(table);$('review').append(wrap);
  }catch(error){$('review').textContent=error.message;}
}
function renderRequests(openId){
  const s=packet.current;$('requests').replaceChildren();
  for(const requirement of s.requirements){
    const card=element('details',undefined,{className:'record',open:requirement.id===openId});card.append(element('summary','Request: '+(requirement.title||'Untitled requirement')));
    let request=s.requests.find(row=>row.requirement_id===requirement.id);
    if(!request){card.append(button('Create owner request',()=>{s.requests.push({id:crypto.randomUUID(),requirement_id:requirement.id,owner:requirement.owner,status:'draft',requested_on:'',received_on:'',note:''});changed();renderRequests(requirement.id);}));}
    else{
      field(card,'Request owner',request,'owner',{max:200});field(card,'Recorded status',request,'status',{options:REQUEST_STATUSES.map(value=>[value,value])});
      const dates=element('div',undefined,{className:'row'});field(dates,'Requested on (manual)',request,'requested_on',{type:'date'});field(dates,'Received on (manual)',request,'received_on',{type:'date'});card.append(dates);
      field(card,'Owner note / response',request,'note',{type:'textarea',max:2000});card.append(button('Remove request record',()=>{removeRecord(s.requests,request);}));
    }
    const draft=element('textarea',undefined,{readOnly:true,ariaLabel:'Request draft'});
    card.append(button('Prepare request draft',()=>{draft.value=requestDraft(s,requirement.id);status('Draft prepared locally. Review it before sending through your own channel.');}),button('Copy prepared draft',async()=>{
      if(!draft.value)throw Error('Prepare the draft first.');try{await navigator.clipboard.writeText(draft.value);status('Draft copied. Nothing has been sent.');}catch{draft.focus();draft.select();status('Select and copy the draft manually. Nothing has been sent.');}
    }),draft);$('requests').append(card);
  }
}
function download(contents,name,type){
  const url=URL.createObjectURL(new Blob([contents],{type})),link=element('a',undefined,{href:url,download:name.replaceAll(/[\\/\u0000-\u001f]/gu,'_')});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importPacket(file){
  if(!file)return;if(file.size>LIMITS.packet)throw Error('Backup exceeds 24 MiB.');
  const imported=JSON.parse(await file.text());await verifyAttachments(imported);
  if(!discardAllowed())return;
  // Import as a separate local dossier: never overwrite a saved dossier by ID.
  imported.dossier_id=crypto.randomUUID();packet=imported;dirty=true;render();status('Backup checked and opened as a separate unsaved dossier. Save a version to keep it on this device. Imported history is user-controlled.');
}
function compare(){
  const baseline=packet.versions[Number($('baseline').value)];if($('baseline').value===''||!baseline)throw Error('Choose a saved version.');
  const result=compareSnapshots(baseline.snapshot,packet.current),root=$('comparison');root.replaceChildren(element('p',result.status==='not_comparable'?'Supplier, purpose or assessment dates changed: these versions cannot establish progress on the same assignment.':'Changes in supplied records; human review required.'));
  const readable=value=>String(value??'').replaceAll('_',' ');
  let count=0;
  for(const collection of ['requirements','documents','requests']){
    const delta=result[collection],before=baseline.snapshot[collection],after=packet.current[collection];
    for(const kind of ['added','removed','changed'])for(const id of delta[kind]){
      count++;const old=before.find(row=>row.id===id),now=after.find(row=>row.id===id),row=now||old;
      const title=row.title||packet.current.requirements.find(item=>item.id===row.requirement_id)?.title||baseline.snapshot.requirements.find(item=>item.id===row.requirement_id)?.title||id;
      const card=element('div',undefined,{className:'record'});card.append(element('h3',readable(kind)+' '+collection.slice(0,-1)+': '+title));
      if(kind==='changed')for(const key of Object.keys(now).filter(key=>!['id','requirement_id'].includes(key))){
        if(JSON.stringify(old[key])===JSON.stringify(now[key]))continue;
        const display=value=>key==='attachment'?(value?value.name+' · SHA-256 '+value.sha256:'No attached file'):readable(value).slice(0,400);
        card.append(element('p',readable(key)+': '+display(old[key])+' → '+display(now[key])));
      }
      root.append(card);
    }
  }
  for(const change of result.coverage_changes){const requirement=packet.current.requirements.find(row=>row.id===change.requirement_id);root.append(element('p',(requirement?.title||change.requirement_id)+': '+readable(change.before)+' → '+readable(change.after)));}
  if(!count)root.append(element('p','No document, requirement or request changes.'));
  root.append(element('p','Removed requirements and closed requests do not establish resolution or approval.',{className:'muted quiet'}));
}
$('new-dossier').onclick=()=>run(()=>{if(!discardAllowed())return;packet={format:FORMAT,dossier_id:crypto.randomUUID(),current:emptySnapshot(),versions:[]};dirty=true;render();status('New unsaved dossier. Define the supplier, purpose and checklist.');});
$('open-dossier').onclick=()=>run(()=>openSaved($('saved-dossiers').value));
$('overview-date').value=new Date().toISOString().slice(0,10);
$('refresh-overview').onclick=()=>run(()=>listSaved());
$('import-dossier').onchange=()=>run(async()=>{try{await importPacket($('import-dossier').files?.[0]);}finally{$('import-dossier').value='';}});
$('starter-checklist').onclick=()=>run(()=>{
  for(const title of ['Company registration','Ownership information','Service / product specification','Required certificates and validity'])if(!packet.current.requirements.some(row=>row.title===title))packet.current.requirements.push({id:crypto.randomUUID(),title,owner:'',required:true});changed();render();status('Editable starter checklist added. Adapt it to this assignment.');
});
$('add-requirement').onclick=()=>run(()=>{if(packet.current.requirements.length>=LIMITS.records)throw Error('Requirement limit reached.');packet.current.requirements.push({id:crypto.randomUUID(),title:'',owner:'',required:true});changed();render();});
$('add-document').onclick=()=>run(()=>{const s=packet.current;if(!s.requirements.length)throw Error('Add a checklist requirement first.');if(s.documents.length>=LIMITS.records)throw Error('Document limit reached.');s.documents.push({id:crypto.randomUUID(),requirement_id:s.requirements[0].id,title:'',issuer:'',issued_on:'',expires_on:'',supplier_name:s.supplier.name,scope:s.purpose,excerpt:'',attachment:null});changed();render();});
$('review-dossier').onclick=()=>run(()=>{renderReview();renderRequests();status('Checklist refreshed using supplied dates, scope and document records.');});
$('save-version').onclick=()=>run(async()=>{
  await verifyAttachments(packet);const next=saveVersion(packet,{id:crypto.randomUUID(),at:new Date().toISOString(),note:$('version-note').value});
  await persistVersion(next);packet=next;dirty=false;$('version-note').value='';render();await listSaved();status('Version saved on this device. Download a JSON backup for portability.');
});
$('export-json').onclick=()=>run(async()=>{await verifyAttachments(packet);download(JSON.stringify(packet,null,2),'supplier-dossier.json','application/json');status('Complete backup downloaded with attachments and saved history. Working changes are included.');});
$('export-markdown').onclick=()=>run(()=>{download(exportMarkdown(packet),'supplier-review-packet.md','text/markdown;charset=utf-8');status('Review packet downloaded. Use JSON backup for source files and complete history.');});
$('export-csv').onclick=()=>run(()=>{download('\ufeff'+exportChecklistCsv(packet.current),'supplier-checklist.csv','text/csv;charset=utf-8');status('Checklist CSV downloaded.');});
$('export-pdf').onclick=()=>run(async()=>{
  status('Preparing reviewer PDF locally…');
  const baselineIndex=$('baseline').value===''?null:Number($('baseline').value);
  const bytes=await documentJob('pdf',{packet,baselineIndex});download(bytes,'supplier-review-packet.pdf','application/pdf');status('Reviewer PDF downloaded. Download source ZIP and complete JSON backup for handover.');
});
$('export-sources').onclick=()=>run(async()=>{
  status('Checking source hashes and preparing archive locally…');
  const bytes=await documentJob('archive',{packet});download(bytes,'supplier-original-sources.zip','application/zip');status('Current original files and SHA-256 manifest downloaded. Saved history travels in the separate JSON backup.');
});
$('compare-versions').onclick=()=>run(compare);
$('restore-version').onclick=()=>run(()=>{const value=$('baseline').value,version=packet.versions[Number(value)];if(value===''||!version)throw Error('Choose a saved version.');if(!discardAllowed())return;packet.current=copy(version.snapshot);changed();render();status('Copied to the working dossier. Saved versions remain intact; save a new version to record this change.');});
$('sample-dossier').onclick=()=>run(()=>{
  if(!discardAllowed())return;const snapshot=emptySnapshot();snapshot.supplier={name:'Example Maintenance Ltd (synthetic)',country:'Example jurisdiction',registration_id:'DEMO-001'};snapshot.purpose='Maintenance supplier onboarding — synthetic example';
  snapshot.requirements=[{id:'registration',title:'Company registration',owner:'Supplier contact',required:true},{id:'insurance',title:'Current insurance certificate',owner:'Procurement owner',required:true}];
  snapshot.documents=[{id:'registration-v1',requirement_id:'registration',title:'Synthetic registration example',issuer:'Fictional registry',issued_on:snapshot.assessment_date,expires_on:'',supplier_name:snapshot.supplier.name,scope:snapshot.purpose,excerpt:'Synthetic example only. This is not a real registration document.',attachment:null}];
  packet=createPacket(crypto.randomUUID(),snapshot);dirty=true;render();status('Synthetic example loaded locally. Save version 1, then add the missing certificate and compare the update.');
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
render();
try{
  const open=indexedDB.open('agenda-supplier-desk-v1',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('dossiers',{keyPath:'dossier_id'});
  open.onsuccess=async()=>{database=open.result;database.onversionchange=()=>{database.close();database=null;status('Device storage changed in another tab. Export a JSON backup before reopening.',true);};try{await listSaved();status('Ready. Dossiers are saved locally only when you choose Save version.');}catch(error){status(error.message,true);}};
  open.onerror=()=>status('Device storage unavailable. You can still work and download a JSON backup.',true);
}catch{status('Device storage unavailable. You can still work and download a JSON backup.',true);}
