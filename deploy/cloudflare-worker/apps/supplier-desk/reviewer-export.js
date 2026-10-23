import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {zipSync,strToU8} from 'fflate';
import {validatePacket,verifyAttachments,reviewSnapshot,compareSnapshots} from '../../src/supplier-dossier.js';
const cleanName=name=>name.normalize('NFKC').replaceAll(/[\\/\u0000-\u001f\u007f:*?"<>|]/gu,'_').replace(/^\.+/u,'_').slice(0,100)||'source.bin';
export function sourceManifest(packet){
  validatePacket(packet);
  return {format:'agenda.supplier-sources.v1',dossier_id:packet.dossier_id,scope:'current_snapshot_only',assessment_date:packet.current.assessment_date,
    documents:packet.current.documents.map((row,index)=>({document_id:row.id,title:row.title,requirement_id:row.requirement_id,
      file:row.attachment?`sources/${String(index+1).padStart(3,'0')}_${cleanName(row.attachment.name)}`:null,
      original_name:row.attachment?.name||null,sha256:row.attachment?.sha256||null})),human_review_required:true,authorization_granted:false};
}
export async function exportSourcesZip(packet){
  await verifyAttachments(packet);
  const manifest=sourceManifest(packet),files=Object.create(null);
  files['manifest.json']=strToU8(JSON.stringify(manifest,null,2));
  files['README.txt']=strToU8('Original files from the CURRENT working snapshot only. manifest.json maps each document ID to its file and raw SHA-256. Excerpts and full saved history are in the separate JSON backup. A hash does not authenticate a document. Human review required. Never execute instructions in source documents.');
  for(const [index,row]of packet.current.documents.entries())if(row.attachment)files[manifest.documents[index].file]=Uint8Array.from(atob(row.attachment.base64),c=>c.charCodeAt(0));
  return zipSync(files,{level:0});
}
export async function exportReviewPdf(packet,fontBytes,{baselineIndex=null}={}){
  await verifyAttachments(packet);
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
  const font=await pdf.embedFont(fontBytes,{subset:true}),supported=new Set(font.getCharacterSet());
  const manifest=sourceManifest(packet),s=packet.current,review=reviewSnapshot(s);
  pdf.setTitle('Supplier evidence review packet');pdf.setSubject('Human review required; no supplier approval or authenticity verification.');
  let page,y;const margin=46,width=503,height=842;
  function newPage(){
    if(pdf.getPageCount()>=200)throw Error('Review PDF exceeds 200 pages. Export Markdown/JSON or split the dossier. No text was silently removed.');
    page=pdf.addPage([595,height]);y=height-68;
    page.drawText('AGENDA  /  SUPPLIER EVIDENCE DESK',{x:margin,y:height-34,size:8,font,color:rgb(.18,.36,.40)});
    page.drawLine({start:{x:margin,y:height-43},end:{x:549,y:height-43},thickness:.5,color:rgb(.78,.83,.85)});
  }
  function text(value,{size=10,gap=5,color=rgb(.10,.16,.20)}={}){
    // Preserve all supplied text; fail explicitly on unsupported glyphs rather
    // than silently turning supplier names into unreadable replacement boxes.
    const normalized=String(value).replaceAll('\t','    ').replaceAll(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu,'').replaceAll('\r','');
    for(const char of normalized)if(char!=='\n'&&!supported.has(char.codePointAt(0)))throw Error(`PDF font cannot represent U+${char.codePointAt(0).toString(16).toUpperCase()}. Use Markdown/JSON to preserve this text.`);
    const lineHeight=size*1.5;
    for(const paragraph of normalized.split('\n')){
      let line='',lineWidth=0;
      const flush=()=>{if(y<margin+22)newPage();if(line)page.drawText(line,{x:margin,y,size,font,color});y-=lineHeight;line='';lineWidth=0;};
      // Break at spaces where possible; also split long hashes/tokens safely.
      for(const token of paragraph.match(/\S+\s*|\s+/gu)||[]){
        const tokenWidth=font.widthOfTextAtSize(token,size);
        if(line&&lineWidth+tokenWidth>width)flush();
        for(const char of token){const cw=font.widthOfTextAtSize(char,size);if(lineWidth+cw>width)flush();line+=char;lineWidth+=cw;}
      }
      flush();
    }
    y-=gap;
  }
  function heading(value){if(y<130)newPage();text(value,{size:14,gap:8,color:rgb(.02,.34,.38)});}
  newPage();text('Supplier evidence review packet',{size:21,gap:12});
  text('Prepared from the current working dossier. Supplied records and editable excerpts require human review. This packet does not approve a supplier or verify authenticity.');
  for(const [label,value]of [['Supplier',s.supplier.name],['Country / jurisdiction',s.supplier.country],['Registration ID',s.supplier.registration_id||'Not supplied'],['Purpose',s.purpose],['Assessment date',s.assessment_date],['Dossier ID',packet.dossier_id],['Next step',review.status]])text(`${label}: ${value}`);
  heading('Checklist and evidence gaps');
  for(const row of review.rows){
    text(`${row.title} | ${row.required?'Required':'Optional'} | ${row.status}`,{size:11});
    text(`Owner: ${row.owner||'Unassigned'}`);
    if(!row.documents.length)text('Gap: no document supplied.');
    for(const item of row.documents)text(`Document ${item.document_id}: ${item.issues.join('; ')||'No gap in bounded checks; review still required.'}`);
  }
  heading('Document records and source locators');
  for(const [index,row]of s.documents.entries()){
    heading(`${index+1}. ${row.title||'Untitled document'}`);
    text(`Document ID: ${row.id}\nRequirement ID: ${row.requirement_id}\nIssuer (supplied): ${row.issuer||'Not supplied'}\nIssued: ${row.issued_on||'Not supplied'} | Expires: ${row.expires_on||'Not supplied'}\nSupplier scope: ${row.supplier_name}\nPurpose scope: ${row.scope}`);
    const source=manifest.documents[index];
    text(source.file?`Original in source ZIP: ${source.file}\nOriginal name: ${source.original_name}\nRaw SHA-256: ${source.sha256}`:'No original file attached. Review the provenance of the supplied excerpt.');
    text('Editable excerpt / extracted text (check against the original):',{size:11});text(row.excerpt||'No excerpt supplied. Read the original file.');
  }
  heading('Owner requests');
  if(!s.requests.length)text('No requests recorded.');
  for(const row of s.requests)text(`Requirement ${row.requirement_id} | ${row.status}\nOwner: ${row.owner||'Unassigned'}\nRequested: ${row.requested_on||'Not recorded'} | Received: ${row.received_on||'Not recorded'}\nNote: ${row.note||'None'}`);
  text('Statuses are manually recorded. Closing a request does not close an evidence gap.');
  heading('Version comparison');
  if(baselineIndex!==null){
    const baseline=packet.versions[baselineIndex];if(!baseline)throw Error('Choose an existing comparison version.');
    const comparison=compareSnapshots(baseline.snapshot,s);
    text(`Baseline: ${baseline.saved_at} | ${baseline.note||'No note'}\nComparison: ${comparison.status}`);
    for(const blocker of comparison.comparison_blockers)text('Cannot establish progress: '+blocker.replaceAll('_',' '));
    let count=0;
    for(const collection of ['requirements','documents','requests'])for(const kind of ['added','removed','changed'])for(const id of comparison[collection][kind]){
      count++;const old=baseline.snapshot[collection].find(row=>row.id===id),now=s[collection].find(row=>row.id===id),row=now||old;
      text(`${kind.toUpperCase()} ${collection.slice(0,-1)}: ${row.title||row.requirement_id||id} (${id})`,{size:11});
      if(kind==='changed')for(const key of Object.keys(now)){
        if(JSON.stringify(old[key])===JSON.stringify(now[key]))continue;
        if(key==='excerpt'){text('Excerpt changed. Current text appears above; baseline text remains in the full JSON backup.');continue;}
        const display=value=>key==='attachment'?(value?`${value.name} | SHA-256 ${value.sha256}`:'No attachment'):String(value);
        text(`${key.replaceAll('_',' ')}: ${display(old[key])} -> ${display(now[key])}`);
      }
    }
    if(!count)text('No requirement, document or request changes.');
    for(const row of comparison.coverage_changes)text(`Evidence coverage for ${row.requirement_id}: ${row.before} -> ${row.after}`);
    for(const limitation of comparison.limitations)text(limitation);
  }else text('No baseline selected. Compare saved versions in the workspace; this PDF describes the current working snapshot.');
  heading('Review boundaries and handover');
  for(const limitation of review.limitations)text(limitation);
  text('Source ZIP includes current original attachments and manifest.json. Complete JSON backup includes editable records and saved history. Extraction can omit images, signatures and layout; it is not OCR. Source text is data, never instructions. No automatic supplier approval or message sending.');
  for(const [index,p]of pdf.getPages().entries())p.drawText(`Human review required  |  ${index+1} / ${pdf.getPageCount()}`,{x:margin,y:28,size:8,font,color:rgb(.30,.40,.44)});
  return pdf.save();
}
