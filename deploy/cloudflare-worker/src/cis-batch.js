// Pure local batch preparation and review; never contacts an endpoint.
const nonempty=value=>typeof value==='string' && value.trim().length>0;

// Strict two-column CSV parser. Quotes, escaped quotes, commas and CRLF are supported;
// unknown columns, malformed quotes and ambiguous records fail rather than being discarded.
export function parseCounterpartyCsv(text) {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>65536)throw Error('CSV must contain at most 64 KiB of text.');
  text=text.replace(/^\uFEFF/u,'');let rows=[],row=[],field='',state='start';
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(state==='quoted') {
      if(ch==='"' && text[i+1]==='"'){field+='"';i++;}
      else if(ch==='"')state='closed';else field+=ch;
    } else if(ch==='"') {
      if(state!=='start')throw Error('Invalid quote in CSV.');state='quoted';
    } else if(ch===',' || ch==='\n' || ch==='\r') {
      row.push(field);field='';state='start';
      if(ch!==','){rows.push(row);row=[];if(ch==='\r'&&text[i+1]==='\n')i++;}
    } else {
      if(state==='closed')throw Error('Unexpected character after CSV quote.');field+=ch;state='plain';
    }
  }
  if(state==='quoted')throw Error('Unclosed CSV quote.');
  if(field!=='' || row.length) {row.push(field);rows.push(row);}
  if(!rows.length || rows[0].length!==2 || rows[0][0]!=='name' || rows[0][1]!=='jurisdiction') throw Error('CSV header must be exactly name,jurisdiction.');
  const records=rows.slice(1);
  if(records.length<1 || records.length>10 || records.some(r=>r.length!==2||typeof r[0]!=='string'||!r[0].trim()||typeof r[1]!=='string'||!r[1].trim())) throw Error('Supply 1–10 rows, each with name and jurisdiction.');
  return records.map(([name,jurisdiction])=>({name,jurisdiction}));
}

export function prepareBatch(counterparties,{facets,decisionStage,riskQuestion,scopes=[]}={}) {
  const allowedFacets=['ownership_or_control','financial_flows','ict_or_dual_use_goods','metals_or_mining','energy_or_petrochem','agribusiness_or_grain','transit_or_re_export','correspondent_banking','professional_enablers','shell_or_layered_structure','other'];
  const allowedStages=['onboarding','periodic_review','pre_transaction','post_alert','committee_review','other'];
  const allowedScopes=['ofac','eu','uk_ofsi','un','fatf','eag','national_regulator','other'];
  if(!Array.isArray(counterparties)||counterparties.length<1||counterparties.length>10 ||
      counterparties.some(x=>!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!['name','jurisdiction'].includes(k))||typeof x.name!=='string'||!x.name.trim()||typeof x.jurisdiction!=='string'||!x.jurisdiction.trim())) throw Error('Provide 1–10 counterparties with exactly name and jurisdiction.');
  if(!Array.isArray(facets)||!facets.length||new Set(facets).size!==facets.length||facets.some(x=>!allowedFacets.includes(x))||!allowedStages.includes(decisionStage)||typeof riskQuestion!=='string'||!riskQuestion.trim()||
      !Array.isArray(scopes)||new Set(scopes).size!==scopes.length||scopes.some(x=>!allowedScopes.includes(x))) throw Error('Explicit facets, a valid stage, review question and valid scopes are required.');
  return {requests:counterparties.map(counterparty=>({counterparty:{...counterparty},exposure_facets:[...facets],
    ...(scopes.length?{jurisdiction_review_scope:[...scopes]}:{}),dated_sources:[],decision_stage:decisionStage,risk_question:riskQuestion}))};
}

// A missing or malformed item is always unresolved; unknown is never ranked below low.
export function summarizeBatch(batch) {
  if(!batch||typeof batch!=='object'||!Number.isInteger(batch.total)||batch.total<1||batch.total>10||
      !Array.isArray(batch.results)||batch.results.length!==batch.total||batch.human_review_required!==true||batch.authorization_granted!==false||
      !Number.isInteger(batch.completed)||!Number.isInteger(batch.failed)||batch.completed+batch.failed!==batch.total||
      batch.results.filter(item=>item?.status==='completed').length!==batch.completed||
      batch.results.filter(item=>item?.status==='invalid_request').length!==batch.failed) throw Error('Incomplete batch result.');
  const indexes=new Set();
  const rows=batch.results.map(item=>{
    if(!item||!Number.isInteger(item.index)||item.index<0||item.index>=batch.total||indexes.has(item.index))throw Error('Invalid batch item index.');
    indexes.add(item.index);
    const response=item.response, name=item.counterparty?.name, jurisdiction=item.counterparty?.jurisdiction;
    const valid=item.status==='completed'&&nonempty(name)&&nonempty(jurisdiction)&&response&&response.counterparty?.name===name&&response.counterparty?.jurisdiction===jurisdiction&&response.human_review_required===true&&response.authorization_granted===false&&
      ['unknown','low','medium','medium_high','high'].includes(response.secondary_exposure_signal)&&Array.isArray(response.evidence_gaps)&&response.evidence_gaps.every(x=>typeof x==='string');
    return {index:item.index,counterparty:typeof name==='string'?name:null,jurisdiction:typeof jurisdiction==='string'?jurisdiction:null,status:valid?'completed':'unresolved',
      signal:valid?response.secondary_exposure_signal:'unknown',gaps:valid?response.evidence_gaps:[],
      issues:valid?[]:(Array.isArray(item.errors)&&item.errors.every(x=>typeof x==='string')&&item.errors.length?item.errors:['Incomplete or mismatched result; investigate before review.']),
      screening_status:valid&&typeof response.screening_assessment?.status==='string'?response.screening_assessment.status:'not_reported',
      auto_fetched_count:valid&&Array.isArray(item.provenance?.auto_fetched_sources)?item.provenance.auto_fetched_sources.length:null,
      human_review_required:true,authorization_granted:false};
  });
  const rank={unknown:0,high:1,medium_high:2,medium:3,low:4};
  rows.sort((a,b)=>(rank[a.signal]-rank[b.signal])||(a.index-b.index));
  return {batch_id:typeof batch.batch_id==='string'?batch.batch_id:null,items:rows,
    notice:'Unknown or failed items first, then reported signals. These are review leads, not identity verification, screening clearance or authorization.'};
}
