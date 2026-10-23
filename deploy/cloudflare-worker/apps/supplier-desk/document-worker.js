import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {WorkerMessageHandler} from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import fontBytes from './vendor/NotoSans-Regular.ttf';
import {checkInput,extractDocx,extractPdf} from './document-extract.js';
import {exportSourcesZip,exportReviewPdf} from './reviewer-export.js';

// PDF.js's in-process transport runs INSIDE our terminable dedicated worker.
// No nested workers, URL sources, document scripting or remote resource fetches.
globalThis.pdfjsWorker={WorkerMessageHandler};
self.onmessage=async({data})=>{
  if(data?.protocol!=='agenda.document.v1')return;
  try{
    const {operation,payload}=data;let result;
    if(operation==='extract'){
      const bytes=new Uint8Array(payload.bytes),kind=checkInput(bytes,payload.name);
      result=kind==='pdf'?await extractPdf(bytes,{getDocument}):extractDocx(bytes);
    }else if(operation==='pdf')result=await exportReviewPdf(payload.packet,fontBytes,{baselineIndex:payload.baselineIndex});
    else if(operation==='archive')result=await exportSourcesZip(payload.packet);
    else throw Error('Unsupported document operation.');
    self.postMessage({protocol:'agenda.document.v1',ok:true,result});
  }catch(error){self.postMessage({protocol:'agenda.document.v1',ok:false,error:String(error.message||'Document processing failed.').slice(0,600)});}
};
