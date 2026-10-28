import {extractResearchDocument,DOCUMENT_BYTE_LIMIT} from './research-documents.js';
import catalog from '../../../source-requirements/corridor-research.json' with {type:'json'};

const encoder=new TextEncoder();
export const SOURCE_CATALOG=catalog.sources;
export const normalise=text=>String(text).normalize('NFKC').replace(/\s+/gu,' ').trim();
export async function digest(text) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',(text instanceof Uint8Array?text:encoder.encode(text))))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function clipUtf8(text,bytes) {
  const data=encoder.encode(text);
  return data.length<=bytes?text:new TextDecoder('utf-8',{fatal:false}).decode(data.slice(0,bytes)).replace(/\uFFFD$/u,'');
}
function entities(text) {
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return text.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{1,12});/gi,(_,key)=>{
    if(key[0]!=='#')return named[key.toLowerCase()]??' ';
    const number=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
    return number>0&&number<=0x10ffff&&!(number>=0xd800&&number<=0xdfff)?String.fromCodePoint(number):' ';
  });
}
// Single forward scan: malformed, unclosed tags cannot restart a suffix scan.
export function htmlText(html) {
  let output='',cursor=0,ignored=0;const counts=new Map();
  while(cursor<html.length) {
    if(html[cursor]==='<') {
      if(html.startsWith('<!--',cursor)){const end=html.indexOf('-->',cursor+4);if(end<0)break;cursor=end+3;continue;}
      const end=html.indexOf('>',cursor+1);if(end<0)break;
      const tag=html.slice(cursor+1,Math.min(end,cursor+200)).trim();
      const match=/^(\/?)\s*([a-z0-9]+)/i.exec(tag);
      if(match) {
        const name=match[2].toLowerCase();
        if(['script','style','noscript','nav','footer','header','template'].includes(name)) {
          const count=counts.get(name)??0;
          if(match[1]) {if(count>0){counts.set(name,count-1);ignored--;}}
          else if(!tag.endsWith('/')){counts.set(name,count+1);ignored++;}
        }
      }
      if(!ignored)output+=' ';
      cursor=end+1;
    } else {
      const next=html.indexOf('<',cursor),end=next<0?html.length:next;
      if(!ignored)output+=html.slice(cursor,end);
      cursor=end;
    }
  }
  return normalise(entities(output));
}
export function approvedUrl(value,source) {
  try {
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))return null;
    if(url.hostname.replace(/^www\./u,'')!==source.host.replace(/^www\./u,''))return null;
    url.hash='';
    for(const key of [...url.searchParams.keys()])if(key.startsWith('utm_')||['fbclid','gclid'].includes(key))url.searchParams.delete(key);
    return url.href;
  }catch{return null;}
}
function attributes(tag) {
  const result={};
  for(const m of tag.matchAll(/([a-zA-Z_:][\w:.-]{0,60})\s*=\s*["']([^"']{0,2000})["']/g))result[m[1].toLowerCase()]=entities(m[2]);
  return result;
}
export function parseDocument(html,url) {
  let title='';const h1=/<h1\b[^>]{0,1000}>([\s\S]{0,1000}?)<\/h1\s*>/i.exec(html);
  const heading=h1??/<title\b[^>]{0,1000}>([\s\S]{0,1000}?)<\/title\s*>/i.exec(html);
  if(heading)title=htmlText(heading[1]).slice(0,240);
  let published=null;
  for(const m of html.slice(0,40000).matchAll(/<meta\b[^>]{0,3000}>/gi)) {
    const a=attributes(m[0]);
    if(a.property==='og:title'&&a.content&&!(h1&&new URL(url).hostname.replace(/^www\./,'')==='ktze.kz'))title=normalise(a.content).slice(0,240);
    if(['article:published_time','date','datepublished','publication_date','dc.date.issued'].includes((a.property??a.name??'').toLowerCase())&&/^\d{4}-\d{2}-\d{2}/.test(a.content??'')) {
      const date=Date.parse(a.content);if(Number.isFinite(date)){published=new Date(date).toISOString();break;}
    }
  }
  if(!published) {
    const time=/<time\b[^>]{0,1000}>([^<]{0,80})/i.exec(html);
    // KTZ labels publication explicitly in the article's first <time>.
    const value=time&&(attributes(time[0]).datetime??(new URL(url).hostname.replace(/^www\./,'')==='ktze.kz'?time[1]:null));
    if(value&&(/^(?:\d{4}-\d{2}-\d{2}|[A-Za-z]+ \d{1,2}, \d{4})$/.test(value)||/^\d{4}-\d{2}-\d{2}T/.test(value))&&Number.isFinite(Date.parse(value+(value.includes(',')?' UTC':''))))published=new Date(Date.parse(value+(value.includes(',')?' UTC':''))).toISOString();
  }
  if(!published) {
    // These named publishers label their article date outside standard metadata.
    // Never infer publication time from a date occurring in the article body or URL.
    const host=new URL(url).hostname;
    for(const m of html.matchAll(/<(?:div|p|span)\b[^>]{0,2000}>/gi)) {
      const a=attributes(m[0]);
      const selected=host==='www.carecinstitute.org'&&a.id==='main-header-meta'
        ||host.replace(/^www\./,'')==='eabr.org'&&(a.class??'').split(/\s+/).includes('an-fc__date');
      if(!selected)continue;
      const value=normalise(html.slice(m.index+m[0].length,m.index+m[0].length+100).split('<')[0]);
      const date=/^(\d{1,2}) ([A-Za-z]{3,9}) (\d{4})$/.exec(value),months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      if(date) {
        const month=months.indexOf(date[2].slice(0,3).toLowerCase()),day=Number(date[1]),year=Number(date[3]);
        const parsed=new Date(Date.UTC(year,month,day));
        if(month>=0&&parsed.getUTCMonth()===month&&parsed.getUTCDate()===day){published=parsed.toISOString();break;}
      }
    }
  }
  const ktzArticle=new URL(url).hostname.replace(/^www\./,'')==='ktze.kz'&&h1;
  const end=ktzArticle?html.indexOf('Latest news',h1.index):-1;
  const body=ktzArticle?html.slice(h1.index,end>=0?end:undefined):html;
  const segments=[...body.matchAll(/<(p|li|h[1-6])\b[^>]{0,1000}>([\s\S]{0,4000}?)<\/\1\s*>/gi)].map(m=>htmlText(m[2])).filter(Boolean);
  return {title:title||new URL(url).pathname,text:htmlText(body).slice(0,18000),segments,published_at:published};
}
const stop=new Set(['what','which','about','with','from','this','that','have','been','into','past','days','changed','changes','что','какие','этого','этот','после','последние','дней','для','как']);
export function queryTerms(question) {
  const words=(question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[]).filter(w=>!stop.has(w));
  const hints=[];
  for(const [pattern,term] of [['актау','aktau'],['курык','kuryk'],['касп','caspian'],['средин','corridor'],['тариф','tariff'],['порт','port'],['желез','rail'],['баку','baku'],['алят','alat'],['поти','poti'],['расписан','schedule'],['координац','coordination'],['контейнер','container'],['хаб','hub'],['фаз','phase'],['пробн','trial'],['стади','phase'],['проект','project status'],['груз','cargo'],['объем','volume'],['объём','volume'],['отчет','annual'],['отчёт','annual'],['статист','statistics']])if(question.toLowerCase().includes(pattern))hints.push(term);
  return [...new Set([...hints,...words])].slice(0,24);
}
function score(value,terms){const text=value.toLowerCase();return terms.reduce((n,t)=>n+(text.includes(t)?1:0),0);}
export function discoverLinks(html,base,source,terms,{now=Date.now(),lookback_days=30}={}) {
  const links=[],seen=new Set(),lower=html.toLowerCase();const pattern=/<a\b[^>]{0,3000}>/gi;let m;
  while((m=pattern.exec(html))) {
    const end=lower.indexOf('</a',pattern.lastIndex);if(end<0)break;
    const attrs=attributes(m[0]);let url=null;
    try{url=approvedUrl(new URL(attrs.href,base).href,source);}catch{}
    const title=htmlText(html.slice(pattern.lastIndex,end)).slice(0,800);
    pattern.lastIndex=end+4;
    if(!url||seen.has(url)||url===base||/\.(zip|png|jpe?g|svg|xlsx?)(?:\?|$)/i.test(url))continue;
    let path=new URL(url).pathname;try{path=decodeURI(path);}catch{}
    const rank=score(title+' '+path,terms);
    if((rank<1&&!/\/news\/[^/]+\/?$/u.test(new URL(url).pathname))||new URL(url).pathname.split('/').filter(Boolean).length<2)continue;
    // A URL date is a discovery hint only. Publication time still needs page metadata.
    const hint=/\/(\d{2})-(\d{2})-(\d{4})(?:\/|$)/.exec(new URL(url).pathname);
    const date=hint?Date.UTC(Number(hint[3]),Number(hint[2])-1,Number(hint[1])):null;
    const recent=date!==null&&date<=now&&date>=now-lookback_days*86400000;
    seen.add(url);links.push({url,title,score:rank,recent,kind:/\.(pdf|docx)$/i.exec(new URL(url).pathname)?.[1]?.toLowerCase()??null});
    if(links.length>=200)break;
  }
  return links.sort((a,b)=>Number(b.recent)-Number(a.recent)||b.score-a.score).slice(0,3);
}
export function sourceIntegrityNotes(text) {
  const match=/(?:ignore (?:all |the )?(?:previous|prior|above) instructions|disregard (?:all |the )?(?:previous|prior|above) instructions|reveal (?:your |the )?(?:api keys?|credentials|secrets)|игнорируй(?:те)? предыдущие инструкции)/iu.exec(text);
  return match?[{code:'instruction_like_source_text',quote:normalise(text.slice(match.index)).split(/\s+/u).slice(0,10).join(' ')}]:[];
}
function topicScore(topics,terms) {
  return topics.reduce((n,topic)=>n+(terms.some(term=>term.includes(topic)||topic.includes(term))?1:0),0);
}
export function selectSourcePlan(input) {
  const terms=queryTerms(input.question+' '+(input.decision_context??''));
  const ranked=SOURCE_CATALOG.map((source,index)=>({source,index,rank:topicScore(source.topics??[],terms)
    +Math.min(2,Math.max(0,...(source.documents??[]).map(doc=>topicScore(doc.topics,terms))))}));
  return ranked.sort((a,b)=>b.rank-a.rank||a.index-b.index).slice(0,4).map(({source})=>{
    const document=(source.documents??[]).map(doc=>({doc,rank:topicScore(doc.topics,terms)})).sort((a,b)=>b.rank-a.rank).find(d=>d.rank>0)?.doc;
    const seed=document?.url??(source.id==='titr'&&!terms.some(t=>t.includes('tariff'))?source.seeds.at(-1):source.seeds[0]);
    return {source,seed,document};
  });
}
async function fetchPage(url,source,fetcher) {
  let target=approvedUrl(url,source);if(!target)throw new Error('unapproved_url');
  for(let hop=0;hop<3;hop++) {
    const response=await fetcher(target,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{accept:'text/html,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document','user-agent':'Agenda-Corridor-Research/1.0 (+https://github.com/vassiliylakhonin/agenda-intelligence-md)'}});
    if(response.status>=300&&response.status<400) {
      await response.body?.cancel();
      const next=response.headers.get('location');target=next&&approvedUrl(new URL(next,target).href,source);
      if(!target)throw new Error('unapproved_redirect');continue;
    }
    if(!response.ok){await response.body?.cancel();throw new Error('http_'+response.status);}
    const type=(response.headers.get('content-type')??'').split(';')[0].trim().toLowerCase();
    const kind=/\.(pdf|docx)$/i.exec(new URL(target).pathname)?.[1]?.toLowerCase()??null;
    const supported=kind==='pdf'?['application/pdf','application/octet-stream']:kind==='docx'?['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream']:['text/html','text/plain','application/xhtml+xml'];
    if(!supported.includes(type)){await response.body?.cancel();throw new Error('unsupported_media_type');}
    const limit=kind?DOCUMENT_BYTE_LIMIT:512000;
    if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw new Error('source_too_large');}
    if(!response.body)throw new Error('empty_source');
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw new Error('source_too_large');chunks.push(value);}}
    catch(error){await reader.cancel();throw error;}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return {url:target,kind,bytes,html:kind?null:new TextDecoder().decode(bytes),content_sha256:await digest(bytes)};
  }
  throw new Error('redirect_limit');
}
export async function collectSources(input,{fetcher=globalThis.fetch,now=Date.now()}={}) {
  const terms=queryTerms(input.question),failures=[];
  const results=await Promise.all(selectSourcePlan(input).map(async({source,seed,document:configured})=>{
    try {
      let page=await fetchPage(seed,source,fetcher),linkedTitle=null;
      const links=page.html?discoverLinks(page.html,page.url,source,terms,{now,lookback_days:input.lookback_days}):[];
      if(!configured&&links.length&&(source.discover||source.id==='carec'||source.id==='titr'&&!seed.includes('tariff'))) {
        try{const linked=await fetchPage(links[0].url,source,fetcher);page=linked;linkedTitle=links[0].title;}
        catch(error){failures.push({source:source.id,url:links[0].url,code:safeCode(error)});}
      }
      const document=page.kind?{...await extractResearchDocument(page.bytes,page.kind,{pages:configured?.pages}),title:configured?.title??linkedTitle??new URL(page.url).pathname,published_at:null}:parseDocument(page.html,page.url);
      document.title=normalise(document.title).slice(0,240);
      const extracted=normalise(document.text);
      if(document.extraction&&extracted.length>18000){document.extraction.status='partial';document.extraction.warnings.push('Collector text limit reached; later body text was omitted.');}
      document.text=extracted.slice(0,18000);
      let segmentBytes=0;
      document.segments=(document.segments??extracted.split(/(?=\[PDF page |\[DOCX paragraph )/u)).map(normalise).filter(segment=>{segmentBytes+=segment.length;return segment.length>=12&&segmentBytes<=18000;}).slice(0,128);
      if(document.text.length<120)throw new Error('insufficient_source_text');
      const cutoff=now-input.lookback_days*86400000;
      return {...document,url:page.url,provider:source.name,provider_id:source.id,attribution:source.attribution,data_integrity_notes:sourceIntegrityNotes(document.text),
        retrieved_at:new Date(now).toISOString(),content_sha256:page.content_sha256,text_sha256:await digest(document.text),
        freshness:document.published_at?(Date.parse(document.published_at)>now?'future_dated':Date.parse(document.published_at)>=cutoff?'in_requested_window':'background'):'publication_date_unknown',
        observation_period:configured?.observation_period??null,effective_date:null};
    }catch(error){failures.push({source:source.id,url:seed,code:safeCode(error)});return null;}
  }));
  const unique=new Set();
  const sources=results.filter(Boolean).filter(s=>{if(unique.has(s.url)||unique.has(s.text_sha256))return false;unique.add(s.url);unique.add(s.text_sha256);return true;}).map((s,i)=>({id:'S'+(i+1),...s}));
  return {sources,failures:failures.sort((a,b)=>a.source.localeCompare(b.source)||a.url.localeCompare(b.url))};
}
function safeCode(error) {
  const code=String(error?.message??'');
  return /^(http_\d{3}|unapproved_url|unapproved_redirect|unsupported_media_type|source_too_large|empty_source|redirect_limit|insufficient_source_text|invalid_document_signature|document_needs_ocr|document_encrypted|document_page_limit|document_parse_failed)$/.test(code)?code:error?.name==='TimeoutError'?'source_timeout':'source_access_failed';
}
export function relevantExcerpt(source,question,bytes=1800) {
  const terms=queryTerms(question),text=source.text;
  let best=0,bestScore=-1;
  for(let start=0;start<text.length;start+=700) {
    const rank=score(text.slice(start,start+1600),terms);
    if(rank>bestScore){best=start;bestScore=rank;}
  }
  return clipUtf8(text.slice(best,best+2400),bytes);
}
export function sourceEvidenceCandidates(source,question) {
  const terms=queryTerms(question),seen=new Set(),quotes=[],sourceText=normalise(source.text);
  const allowance=25-(source.data_integrity_notes??[]).reduce((n,note)=>n+normalise(note.quote).split(/\s+/u).length,0);
  if(allowance<1)return quotes;
  // Whitespace after sentence punctuation keeps decimal numbers intact.
  const sentences=(source.segments?.length?source.segments:[source.text]).flatMap(text=>text.split(/(?<=[.!?])\s+(?=[\p{Lu}\p{N}])/u));
  const candidates=[];
  for(const [index,sentence] of sentences.entries()) {
    const full=normalise(sentence),words=full.split(/\s+/u);
    // Long paragraphs/tables need query-relevant windows, not their first 25 words.
    for(let start=0;start<words.length;start+=10) {
      let quote=words.slice(start,start+allowance).join(' ');
      while(quote.length>240){const end=quote.lastIndexOf(' ');quote=end>12?quote.slice(0,end):clipUtf8(quote,240);}
      if(quote.length<12||!sourceText.includes(quote))continue;
      candidates.push({quote,index,start,rank:score(quote,terms),fragment:quote!==full});
      if(!start&&!candidates.at(-1).fragment)break;
    }
  }
  candidates.sort((a,b)=>b.rank-a.rank||Number(a.fragment)-Number(b.fragment)||a.index-b.index||a.start-b.start);
  const selected=new Set();
  for(const candidate of candidates) {
    if(seen.has(candidate.quote)||selected.has(candidate.index))continue;
    seen.add(candidate.quote);selected.add(candidate.index);
    quotes.push({evidence_id:source.id+'-Q'+(quotes.length+1),source_id:source.id,quote:candidate.quote,fragment:candidate.fragment});
    if(quotes.length===2)break;
  }
  return quotes;
}
