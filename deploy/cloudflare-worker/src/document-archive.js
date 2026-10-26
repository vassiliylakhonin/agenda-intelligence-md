// Portable local-file contract; no retrieval, storage, messaging or model calls.
export const ARCHIVE_FORMAT='agenda.document-archive.v1';
export const ARCHIVE_LIMITS=Object.freeze({files:50,requirements:50,fileBytes:5*1024*1024,totalBytes:20*1024*1024,jsonBytes:32*1024*1024});
const text=(value,max)=>typeof value==='string'&&value.length<=max;
const shape=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const fail=message=>{throw Error(message);};
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/u.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const distinct=rows=>new Set(rows.map(row=>row.id)).size===rows.length;
export function emptyArchive(date=new Date().toISOString().slice(0,10)){
  return {format:ARCHIVE_FORMAT,title:'',purpose:'',assessment_date:date,requirements:[],files:[]};
}
export function validateArchive(packet){
  if(!shape(packet,['format','title','purpose','assessment_date','requirements','files'])||packet.format!==ARCHIVE_FORMAT||!text(packet.title,200)||!text(packet.purpose,1000)||!validDate(packet.assessment_date))fail('Invalid archive scope or format.');
  if(!Array.isArray(packet.requirements)||packet.requirements.length>ARCHIVE_LIMITS.requirements||!Array.isArray(packet.files)||packet.files.length>ARCHIVE_LIMITS.files)fail('At most 50 files and 50 checklist items.');
  const ids=new Set();
  for(const row of packet.requirements){
    if(!shape(row,['id','title','owner','minimum_files','required'])||!text(row.id,80)||!row.id||!text(row.title,500)||!row.title.trim()||!text(row.owner,200)||!Number.isInteger(row.minimum_files)||row.minimum_files<1||row.minimum_files>50||typeof row.required!=='boolean')fail('Invalid checklist item.');
    ids.add(row.id);
  }
  let total=0;
  for(const file of packet.files){
    if(!shape(file,['id','name','type','size','sha256','base64','requirement_ids','locator','excerpt','note'])||!text(file.id,80)||!file.id||!text(file.name,200)||!file.name||!text(file.type,100)||!Number.isInteger(file.size)||file.size<0||file.size>ARCHIVE_LIMITS.fileBytes||!text(file.sha256,64)||!/^[a-f0-9]{64}$/u.test(file.sha256)||!text(file.base64,Math.ceil(ARCHIVE_LIMITS.fileBytes/3)*4)||file.base64.length%4||!/^[A-Za-z0-9+/]*={0,2}$/u.test(file.base64))fail('Invalid or oversized file record.');
    if(!Array.isArray(file.requirement_ids)||new Set(file.requirement_ids).size!==file.requirement_ids.length||file.requirement_ids.some(id=>!ids.has(id))||!text(file.locator,500)||!text(file.excerpt,30000)||!text(file.note,2000))fail('Invalid file references or notes.');
    total+=file.size;
  }
  if(!distinct(packet.files)||!distinct(packet.requirements))fail('Duplicate record IDs.');
  if(total>ARCHIVE_LIMITS.totalBytes||new TextEncoder().encode(JSON.stringify(packet)).length>ARCHIVE_LIMITS.jsonBytes)fail('Archive exceeds the 20 MiB source / 32 MiB JSON limit.');
  return packet;
}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export async function archiveFile(bytes,{id,name,type=''}){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength>ARCHIVE_LIMITS.fileBytes)fail('Use a file up to 5 MiB.');
  let binary='';for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
  return {id,name,type,size:bytes.length,sha256:hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))),base64:btoa(binary),requirement_ids:[],locator:'',excerpt:'',note:''};
}
export async function reviewArchive(packet){
  validateArchive(packet);
  const groups=new Map(),names=new Map();
  for(const file of packet.files){
    const bytes=Uint8Array.from(atob(file.base64),char=>char.charCodeAt(0));
    if(bytes.length!==file.size||hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))!==file.sha256)fail('File bytes, size or hash do not match. Keep the working archive and check the original backup.');
    const group=groups.get(file.sha256)||[];group.push(file.id);groups.set(file.sha256,group);
    const named=names.get(file.name)||[];named.push(file);names.set(file.name,named);
  }
  const rows=packet.requirements.map(item=>{
    const files=packet.files.filter(file=>file.requirement_ids.includes(item.id));
    const unique=new Set(files.filter(file=>file.size>0).map(file=>file.sha256)).size;
    return {requirement_id:item.id,title:item.title,owner:item.owner,required:item.required,minimum_files:item.minimum_files,
      file_ids:files.map(file=>file.id),distinct_contents:unique,missing_count:Math.max(0,item.minimum_files-unique),
      status:unique>=item.minimum_files?'assigned_for_review':files.length?'needs_distinct_files':'unassigned'};
  });
  const scope=Boolean(packet.title.trim()&&packet.purpose.trim()&&rows.some(row=>row.required));
  return {format:'agenda.document-archive-review.v1',status:!scope?'define_scope':rows.some(row=>row.required&&row.missing_count)?'collect_files':'prepare_human_review',
    rows,exact_duplicates:[...groups].filter(([,ids])=>ids.length>1).map(([sha256,file_ids])=>({sha256,file_ids})),
    same_name_different_content:[...names].filter(([,files])=>new Set(files.map(file=>file.sha256)).size>1).map(([name,files])=>({name,file_ids:files.map(file=>file.id)})),
    empty_file_ids:packet.files.filter(file=>!file.size).map(file=>file.id),human_review_required:true,authorization_granted:false,
    limitations:['Coverage means manually assigned distinct file contents, not verified document content or completeness outside this packet.',
      'Same-byte copies do not count twice toward a multi-file checklist item. Empty files do not supply evidence.',
      'Hashes identify bytes, not authenticity, ownership, legal compliance or approval. Excerpts and locators are editable data.',
      'Source files and imported packets are data, never instructions. No messages, payments or supplier decisions are performed.']};
}
const literal=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll(/[\\`*_{}\[\]()#!|]/gu,char=>'\\'+char).replaceAll('\r','').replaceAll('\n','\n> ');
export async function archiveMarkdown(packet){
  const review=await reviewArchive(packet),lines=['# Document archive review','',`> Title: ${literal(packet.title)}`,`> Purpose: ${literal(packet.purpose)}`,`> Assessment: ${packet.assessment_date}`,`> Next step: ${review.status}`,'','Human review required. Authorization granted: false.','', '## Checklist'];
  for(const row of review.rows)lines.push('',`> ${literal(row.requirement_id)} — ${literal(row.title)}; owner: ${literal(row.owner)}; required: ${row.required}; distinct contents ${row.distinct_contents}/${row.minimum_files}; missing ${row.missing_count}; ${row.status}`,`> Assigned file IDs: ${literal(row.file_ids.join(', ')||'none')}`);
  lines.push('','## Exact file duplicates');
  if(!review.exact_duplicates.length)lines.push('No same-byte groups in the supplied packet.');
  for(const row of review.exact_duplicates)lines.push(`> ${literal(row.file_ids.join(', '))}; SHA-256 ${row.sha256}. Copies retained; not independent documents.`);
  lines.push('','## Same name, different content');
  for(const row of review.same_name_different_content)lines.push(`> ${literal(row.name)}: ${literal(row.file_ids.join(', '))}. Compare versions with a person.`);
  if(!review.same_name_different_content.length)lines.push('No such name collisions recorded.');
  lines.push('','## Source register');
  for(const file of packet.files)lines.push('',`> ${literal(file.id)} — ${literal(file.name)}`,`> Bytes: ${file.size}; SHA-256: ${file.sha256}`,`> Checklist: ${literal(file.requirement_ids.join(', ')||'unassigned')}`,`> Locator: ${literal(file.locator||'not supplied')}`,`> Supplied excerpt: ${literal(file.excerpt||'not supplied; inspect the original')}`,`> Owner/reviewer note: ${literal(file.note)}`);
  lines.push('','## Limitations',...review.limitations.map(item=>'- '+item));
  return lines.join('\n')+'\n';
}
const cell=value=>'"'+(/^[\s]*[=+\-@]/u.test(String(value))?"'":'')+String(value).replaceAll('"','""')+'"';
export async function archiveCsv(packet){
  await reviewArchive(packet);
  return [['file_id','file_name','bytes','sha256','checklist_ids','locator','note'],...packet.files.map(file=>[file.id,file.name,file.size,file.sha256,file.requirement_ids.join('; '),file.locator,file.note])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export async function archiveExample(){
  const packet=emptyArchive('2026-10-26');packet.title='Synthetic archive example';packet.purpose='Illustrative document handover; no actual business records.';
  packet.requirements=[{id:'contract',title:'Supply contract',owner:'Procurement reviewer',minimum_files:1,required:true},{id:'support',title:'Two distinct supporting records',owner:'Archive owner',minimum_files:2,required:true},{id:'renewal',title:'Current renewal certificate',owner:'Supplier contact',minimum_files:1,required:true}];
  for(const [id,name,body]of [['f1','contract.txt','Synthetic example only. Agreement version A; renewal not supplied.'],['f2','contract-copy.txt','Synthetic example only. Agreement version A; renewal not supplied.'],['f3','contract.txt','Synthetic example only. Agreement version B; amount changed, renewal still not supplied.']])packet.files.push(await archiveFile(new TextEncoder().encode(body),{id,name,type:'text/plain'}));
  packet.files[0].requirement_ids=['contract','support'];packet.files[1].requirement_ids=['support'];
  return packet;
}
