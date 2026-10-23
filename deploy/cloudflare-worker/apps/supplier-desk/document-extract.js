import {unzipSync} from 'fflate';
import {SaxesParser} from 'saxes';

export const EXTRACTION_LIMITS=Object.freeze({bytes:5*1024*1024,xml:2*1024*1024,expanded:20*1024*1024,entries:1000,pages:100,text:27000});
const wordNamespaces=new Set(['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main']);
export function documentKind(name){return /\.pdf$/iu.test(name)?'pdf':/\.docx$/iu.test(name)?'docx':null;}
export function checkInput(bytes,name){
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>EXTRACTION_LIMITS.bytes)throw Error('Choose a non-empty PDF or DOCX up to 5 MiB.');
  const kind=documentKind(name);if(!kind)throw Error('Text extraction supports PDF and DOCX only. The original file is still available.');
  return kind;
}
export function extractDocx(bytes){
  let entries=0,total=0,found=false;
  const files=unzipSync(bytes,{filter:file=>{
    if(++entries>EXTRACTION_LIMITS.entries||(total+=file.originalSize)>EXTRACTION_LIMITS.expanded)throw Error('DOCX expansion limit exceeded. Use a smaller document.');
    if(file.name!=='word/document.xml')return false;
    if(found||file.originalSize>EXTRACTION_LIMITS.xml)throw Error('Invalid or oversized DOCX document XML.');
    found=true;return true;
  }});
  if(!found)throw Error('Not a readable DOCX: word/document.xml is missing.');
  const xml=new TextDecoder('utf-8',{fatal:true}).decode(files['word/document.xml']);
  const parser=new SaxesParser({xmlns:true});let paragraph=0,inText=0,current='',used=0,truncated=false,revision=false;
  const blocks=[];
  parser.on('doctype',()=>{throw Error('DOCX with a DTD is not supported.');});
  parser.on('opentag',tag=>{
    if(!wordNamespaces.has(tag.uri))return;
    if(tag.local==='p'){paragraph++;current='';}
    if(tag.local==='t')inText++;
    if(tag.local==='tab'||tag.local==='br')current+=' ';
    if(['ins','del','moveFrom','moveTo'].includes(tag.local))revision=true;
  });
  parser.on('text',text=>{if(inText){const remaining=EXTRACTION_LIMITS.text-used-current.length-80;if(text.length>remaining)truncated=true;current+=text.slice(0,Math.max(0,remaining));}});
  parser.on('closetag',tag=>{
    if(!wordNamespaces.has(tag.uri))return;
    if(tag.local==='t')inText--;
    if(tag.local==='p'&&current.trim()){
      const block=`[DOCX paragraph ${paragraph}]\n${current.trim()}`;
      if(used+block.length+2<=EXTRACTION_LIMITS.text){blocks.push(block);used+=block.length+2;}else truncated=true;
      current='';
    }
  });
  parser.write(xml).close();
  return {kind:'docx',status:truncated?'partial':blocks.length?'extracted':'no_text',text:blocks.join('\n\n'),units:paragraph,empty_pages:[],warnings:[
    'DOCX locators refer to paragraphs in word/document.xml, not rendered page numbers. Headers, footnotes, images, signatures and layout are not extracted.',
    ...(revision?['Tracked changes exist. Review the original; extracted text does not resolve revisions.']:[]),
    ...(truncated?['Text limit reached. This is a partial extraction; review the full original.']:[]),
    ...(!blocks.length?['No extractable body text. Use authorized OCR or supply an excerpt manually.']:[])
  ]};
}
export async function extractPdf(bytes,pdfjs){
  // Bytes only. No URL, external fonts/CMaps, JavaScript evaluation or rendering.
  const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:false,useWorkerFetch:false,disableFontFace:true,disableAutoFetch:true,stopAtErrors:true,verbosity:0});
  task.onPassword=()=>task.destroy();
  let pdf;
  try{
    pdf=await task.promise;
    if(pdf.numPages>EXTRACTION_LIMITS.pages)throw Error('PDF exceeds 100 pages. Split it before extraction.');
    const blocks=[],empty=[];let used=0,truncated=false;
    for(let page=1;page<=pdf.numPages;page++){
      const source=await pdf.getPage(page),content=await source.getTextContent();let text='';
      for(const item of content.items){
        if(typeof item.str!=='string')continue;
        const piece=item.str+(item.hasEOL?'\n':' '),remaining=EXTRACTION_LIMITS.text-used-text.length-80;
        if(piece.length>remaining)truncated=true;
        text+=piece.slice(0,Math.max(0,remaining));if(truncated)break;
      }
      source.cleanup();
      if(!text.trim())empty.push(page);
      else{const block=`[PDF page ${page}]\n${text.trim()}`;if(used+block.length+2<=EXTRACTION_LIMITS.text){blocks.push(block);used+=block.length+2;}else truncated=true;}
      if(truncated)break;
    }
    return {kind:'pdf',status:truncated||empty.length&&blocks.length?'partial':blocks.length?'extracted':'needs_ocr',text:blocks.join('\n\n'),units:pdf.numPages,empty_pages:empty,warnings:[
      'PDF text order may differ from the page layout. Images, signatures and authenticity are not checked.',
      ...(empty.length?[`No extractable text on pages ${empty.join(', ')}. OCR or manual review is needed; those pages are not evidence in this text.`]:[]),
      ...(truncated?['Text limit reached. Later text/pages are omitted; review the full original.']:[])
    ]};
  }catch(error){throw Error(/password|destroyed/iu.test(error.message)?'Password-protected PDF cannot be read. Supply an authorized unlocked copy.':error.message);}
  finally{await task.destroy();}
}
