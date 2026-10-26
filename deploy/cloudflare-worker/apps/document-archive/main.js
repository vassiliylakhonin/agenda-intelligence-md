import {ARCHIVE_LIMITS,emptyArchive,archiveFile,reviewArchive,archiveMarkdown,archiveCsv,archiveExample} from '../../src/document-archive.js';
import {documentJob} from '../supplier-desk/document-client.js';
import {archiveDraftStore} from './draft-store.js';
import {archiveTemplate} from '../../src/archive-templates.js';
const $=id=>document.getElementById(id);
let packet=emptyArchive(),busy=false,dirty=false,revision=null,store;
const localStore=()=>store||=(archiveDraftStore(typeof indexedDB==='undefined'?null:indexedDB));
const hasWork=()=>Boolean(packet.title||packet.purpose||packet.files.length||packet.requirements.length);
const node=(tag,text,properties={})=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;Object.assign(item,properties);return item;};
const status=(message,error=false)=>{$('status').textContent=message;$('status').className=error?'error':'';};
const nextStep={define_scope:'Define the purpose and required checklist',collect_files:'Collect the missing distinct files',prepare_human_review:'Prepare the human review'};
const assignmentStatus={assigned_for_review:'assigned; review the contents',needs_distinct_files:'more distinct contents needed',unassigned:'no files assigned'};
function changed(){dirty=true;$('save-state').textContent='Unsaved changes — save on this device or download a JSON backup.';$('review').replaceChildren(node('p','The archive changed. Refresh the review before handover.'));}
window.addEventListener('beforeunload',event=>{if(dirty&&hasWork()){event.preventDefault();event.returnValue='';}});
async function run(action){
  if(busy)return;busy=true;$('workspace').inert=true;
  try{await action();}catch(error){status(error.message||'Action failed. The working archive is retained.',true);}
  finally{busy=false;$('workspace').inert=false;}
}
function button(label,action){const item=node('button',label,{type:'button'});item.onclick=()=>run(action);return item;}
function field(parent,labelText,row,key,{type='text',max=500}={}){
  const label=node('label',labelText),input=node(type==='textarea'?'textarea':'input',undefined,{maxLength:max});
  if(type!=='textarea')input.type=type;
  if(type==='checkbox')input.checked=row[key];else input.value=row[key];
  input.oninput=()=>{row[key]=type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value;changed();};
  label.append(input);parent.append(label);return input;
}
function render(){
  for(const [id,key]of [['title','title'],['purpose','purpose'],['date','assessment_date']])$(id).value=packet[key];
  $('requirements').replaceChildren();
  for(const [index,item] of packet.requirements.entries()){
    const card=node('div',undefined,{className:'record'});card.append(node('h3','Checklist item '+(index+1)));
    field(card,'Checklist item',item,'title');field(card,'Responsible owner',item,'owner',{max:200});
    const minimum=field(card,'Minimum distinct file contents',item,'minimum_files',{type:'number'});minimum.min=1;minimum.max=50;
    field(card,'Required for this handover',item,'required',{type:'checkbox'});
    card.append(button('Remove checklist item',()=>{
      packet.requirements=packet.requirements.filter(row=>row.id!==item.id);
      for(const file of packet.files)file.requirement_ids=file.requirement_ids.filter(id=>id!==item.id);
      changed();render();
    }));$('requirements').append(card);
  }
  $('files').replaceChildren();
  for(const file of packet.files){
    const card=node('div',undefined,{className:'record'});card.append(node('h3',file.name),node('p',`${file.id} · ${file.size} bytes`),node('p','SHA-256: '+file.sha256,{className:'hash'}));
    const assignments=node('fieldset');assignments.append(node('legend','Assign to checklist — no matching is inferred from the filename'));
    for(const item of packet.requirements){
      const label=node('label',undefined,{className:'check'}),input=node('input',undefined,{type:'checkbox',checked:file.requirement_ids.includes(item.id)});
      input.onchange=()=>{file.requirement_ids=file.requirement_ids.filter(id=>id!==item.id);if(input.checked)file.requirement_ids.push(item.id);changed();};
      label.append(input,node('span',item.title));assignments.append(label);
    }
    card.append(assignments);field(card,'Source locator: page, paragraph, table or line',file,'locator');field(card,'Editable supplied excerpt (not authenticated)',file,'excerpt',{type:'textarea',max:30000});field(card,'Question / owner note',file,'note',{type:'textarea',max:2000});
    card.append(button('Read PDF / DOCX / UTF-8 text locally',async()=>{
      const bytes=Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0));let text,locator,warnings=[];
      if(/\.(txt|md|csv)$/iu.test(file.name)){
        const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);text=decoded.slice(0,27000);locator='UTF-8 source text; beginning of file';
        if(decoded.length>text.length)warnings.push('Only the first 27,000 characters are shown.');
      }else{
        const result=await documentJob('extract',{bytes,name:file.name});text=result.text;locator=result.kind==='pdf'?'PDF page locators in extracted text':'DOCX paragraph locators, not rendered pages';warnings=result.warnings||[];
        if(result.status!=='extracted')warnings.unshift('Extraction status: '+result.status+'. Review the original; OCR/manual excerpt may be needed.');
      }
      const panel=node('div',undefined,{className:'preview'}),preview=node('textarea',undefined,{readOnly:true,value:text});
      panel.append(node('p','Temporary local extraction. Check it against the original before using it.'),node('p',warnings.join(' ')),preview,
        button('Use this text as the editable excerpt',()=>{if(file.excerpt&&!window.confirm('Replace the working excerpt? The original file remains unchanged.'))return;file.excerpt=text;file.locator=locator;changed();render();status('Recorded an editable excerpt. Authenticity and meaning still need review.');}));
      card.append(panel);status('Text preview prepared locally; no contents were sent.');
    }),button('Remove this file record',()=>{packet.files=packet.files.filter(row=>row.id!==file.id);changed();render();}));
    $('files').append(card);
  }
  $('count').textContent=`${packet.files.length}/${ARCHIVE_LIMITS.files} files · ${packet.files.reduce((n,file)=>n+file.size,0).toLocaleString()} source bytes · ${packet.requirements.length} checklist items`;
}
async function review(){
  const result=await reviewArchive(packet),root=$('review');root.replaceChildren(node('h3','Next step: '+nextStep[result.status]),node('p','These are assigned-file checks. A person must check document content, applicability and authenticity.'));
  for(const row of result.rows)root.append(node('p',`${row.title}: ${row.distinct_contents}/${row.minimum_files} distinct contents; missing ${row.missing_count}; ${assignmentStatus[row.status]}. Owner: ${row.owner||'unassigned'}`,{className:row.missing_count?'gap':''}));
  root.append(node('h3','Exact file duplicates'));
  for(const row of result.exact_duplicates)root.append(node('p',row.file_ids.map(id=>packet.files.find(file=>file.id===id).name+' ['+id+']').join(' = ')+' — copies retained; count as one content.',{className:'gap'}));
  if(!result.exact_duplicates.length)root.append(node('p','No same-byte groups in this packet.'));
  root.append(node('h3','Same filename, different content'));
  for(const row of result.same_name_different_content)root.append(node('p',row.name+': '+row.file_ids.join(', ')+'. Compare these versions with a person.',{className:'gap'}));
  if(!result.same_name_different_content.length)root.append(node('p','No such name collisions recorded.'));
  for(const id of result.empty_file_ids)root.append(node('p','Empty file '+id+' cannot close a checklist gap.',{className:'gap'}));
  for(const limitation of result.limitations)root.append(node('p',limitation,{className:'muted'}));
  status('Review refreshed from checked file bytes. No approval or message was issued.');return result;
}
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),link=node('a',name,{href:url,download:name});link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Download prepared: '+name+'. Check your browser downloads before closing this tab.');}
for(const [id,key]of [['title','title'],['purpose','purpose'],['date','assessment_date']])$(id).oninput=()=>{packet[key]=$(id).value;changed();};
$('add-requirement').onclick=()=>run(()=>{if(packet.requirements.length>=50)throw Error('At most 50 checklist items.');packet.requirements.push({id:crypto.randomUUID(),title:'Document or evidence required',owner:'',minimum_files:1,required:true});changed();render();});
$('add-files').onchange=()=>run(async()=>{
  const selected=Array.from($('add-files').files||[]);if(packet.files.length+selected.length>50)throw Error('At most 50 file records.');
  if(selected.some(file=>file.size>ARCHIVE_LIMITS.fileBytes)||selected.reduce((n,file)=>n+file.size,packet.files.reduce((n,file)=>n+file.size,0))>ARCHIVE_LIMITS.totalBytes)throw Error('Use files up to 5 MiB each and 20 MiB total. No files were added.');
  const added=[];for(const file of selected)added.push(await archiveFile(new Uint8Array(await file.arrayBuffer()),{id:crypto.randomUUID(),name:file.name,type:file.type}));
  const next={...packet,files:[...packet.files,...added]};await reviewArchive(next);packet=next;$('add-files').value='';changed();render();status('Files added locally. Assign them to your checklist, then refresh the review.');
});
$('restore').onchange=()=>run(async()=>{
  const file=$('restore').files?.[0];if(!file)return;if(file.size>ARCHIVE_LIMITS.jsonBytes)throw Error('Backup exceeds 32 MiB. Working archive retained.');
  const next=JSON.parse(await file.text());await reviewArchive(next);
  if((packet.files.length||packet.requirements.length)&&!window.confirm('Open this checked backup and replace unsaved working data? Download a backup first if needed.'))return;
  packet=next;$('restore').value='';changed();render();await review();
});
$('review-run').onclick=()=>run(review);
$('download-md').onclick=()=>run(async()=>download('archive-review.md',await archiveMarkdown(packet),'text/markdown;charset=utf-8'));
$('download-csv').onclick=()=>run(async()=>download('archive-register.csv',await archiveCsv(packet),'text/csv;charset=utf-8'));
$('download-json').onclick=()=>run(async()=>{await reviewArchive(packet);download('archive-backup.json',JSON.stringify(packet,null,2),'application/json');});
$('download-zip').onclick=()=>run(async()=>download('archive-review-pack.zip',await documentJob('archive_review_pack',{packet}),'application/zip'));
$('example').onclick=()=>run(async()=>{if(hasWork()&&!window.confirm('Replace the working archive with a synthetic example? Save or download your backup first if needed.'))return;packet=await archiveExample();changed();render();await review();});
$('apply-template').onclick=()=>run(()=>{const next=archiveTemplate($('archive-template').value);if(hasWork()&&!window.confirm('Start a new checklist and replace the working archive, including its files? Save or download your backup first.'))return;packet=next;changed();render();status('Starting checklist applied. Edit the scope, required items and owners with your reviewer; no documents are assigned.');});
$('save-device').onclick=()=>run(async()=>{const saved=await localStore().save(packet,revision);revision=saved.revision;dirty=false;$('save-state').textContent='Saved on this device at '+saved.saved_at+'. Browser storage can be cleared or evicted; keep a JSON backup.';status('The local transaction completed. Original bytes are stored on this device; nothing was uploaded.');});
$('load-device').onclick=()=>run(async()=>{if(dirty&&hasWork()&&!window.confirm('Load the saved draft and replace unsaved changes? Download a backup first if needed.'))return;const saved=await localStore().load();if(!saved){status('No saved draft on this device. Your working archive is retained.');return;}packet=saved.packet;revision=saved.revision;dirty=false;render();await review();$('save-state').textContent='Loaded the checked local draft saved at '+saved.saved_at+'.';});
$('remove-device').onclick=()=>run(async()=>{if(!window.confirm('Remove the saved copy from this device? Your current tab remains open and becomes unsaved. Keep a JSON backup if needed.'))return;await localStore().remove(revision);revision=null;changed();status('Saved device copy removed. The working archive remains in this tab.');});
render();
