export const DOCUMENT_BYTE_LIMIT=5*1024*1024;
// Bounded text extraction, not OCR, table reconstruction or document validation.
export async function extractResearchDocument(bytes,kind,{pages=[]}={}) {
  if(!bytes.length||bytes.length>DOCUMENT_BYTE_LIMIT)throw Error('source_too_large');
  if(kind==='docx') {
    if(bytes[0]!==0x50||bytes[1]!==0x4b)throw Error('invalid_document_signature');
    const {extractDocx}=await import('./research-docx-engine-bundle.js');
    const doc=extractDocx(bytes);
    if(doc.text.length<120)throw Error('document_needs_ocr');
    return {text:doc.text,extraction:{kind,status:doc.status,units:doc.units,warnings:doc.warnings}};
  }
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('invalid_document_signature');
  const {getDocument}=await import('./research-pdf-engine-bundle.js');
  // Copy: PDF.js may transfer/detach its input; the caller hashes original bytes.
  const task=getDocument({data:bytes.slice(),isEvalSupported:false,useSystemFonts:false,useWorkerFetch:false,disableFontFace:true,disableAutoFetch:true,stopAtErrors:true,verbosity:0});
  task.onPassword=()=>task.destroy();
  try {
    const pdf=await task.promise;
    if(pdf.numPages>500)throw Error('document_page_limit');
    const selected=[...new Set(pages.length?pages:Array.from({length:Math.min(12,pdf.numPages)},(_,i)=>i+1))].filter(n=>Number.isInteger(n)&&n>=1&&n<=pdf.numPages).slice(0,12);
    const blocks=[],read=[],empty=[];let used=0,truncated=false;
    for(const page of selected) {
      const source=await pdf.getPage(page),content=await source.getTextContent();let text='';
      for(const item of content.items) {
        if(typeof item.str!=='string')continue;
        const piece=item.str+(item.hasEOL?'\n':' '),remaining=18000-used-text.length-80;
        text+=piece.slice(0,Math.max(0,remaining));
        if(piece.length>remaining){truncated=true;break;}
      }
      source.cleanup();read.push(page);
      if(text.trim()){const block='[PDF page '+page+']\n'+text.trim();blocks.push(block);used+=block.length+2;}else empty.push(page);
      if(truncated)break;
    }
    if(!blocks.length)throw Error('document_needs_ocr');
    return {text:blocks.join('\n\n'),extraction:{kind,status:truncated||read.length<pdf.numPages||empty.length?'partial':'extracted',units:pdf.numPages,pages:read,warnings:[
      'PDF text order and table alignment may differ from the original. No OCR, signatures or authenticity checks.',
      'Read PDF pages '+read.join(', ')+' of '+pdf.numPages+'; unlisted pages were not read.',
      ...(empty.length?['Pages '+empty.join(', ')+' have no extractable text and require OCR/manual review.']:[]),
      ...(truncated?['Text limit reached; the final selected page is incomplete.']:[])
    ]}};
  } catch(error) {
    if(/password|destroyed/i.test(error.message))throw Error('document_encrypted');
    if(/^document_/.test(error.message))throw error;
    throw Error('document_parse_failed');
  }finally{await task.destroy();}
}
