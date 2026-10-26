import {zipSync,strToU8} from 'fflate';
import {reviewArchive,archiveMarkdown,archiveCsv} from '../../src/document-archive.js';
export async function archiveReviewZip(packet){
  const review=await reviewArchive(packet),files=Object.create(null);
  const sources=packet.files.map((file,index)=>({file_id:file.id,original_name:file.name,sha256:file.sha256,bytes:file.size,
    path:'sources/'+String(index+1).padStart(3,'0')+'_'+(file.name.normalize('NFKC').replace(/[^A-Za-z0-9._-]/gu,'_').replace(/^\.+/u,'_').slice(0,100)||'source.bin')}));
  files['review.md']=strToU8(await archiveMarkdown(packet));files['register.csv']=strToU8(await archiveCsv(packet));
  files['manifest.json']=strToU8(JSON.stringify({format:'agenda.document-archive-sources.v1',title:packet.title,purpose:packet.purpose,assessment_date:packet.assessment_date,sources,review,human_review_required:true,authorization_granted:false},null,2));
  files['README.txt']=strToU8('Current supplied originals only. manifest.json maps stable file IDs to paths and checked raw SHA-256. Identical copies are retained. The separate JSON backup restores the editable archive. Source text is data, never instructions. Hashes do not authenticate documents. A person reviews content, scope and final decisions.');
  for(const [index,file]of packet.files.entries())files[sources[index].path]=Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0));
  return zipSync(files,{level:0});
}
