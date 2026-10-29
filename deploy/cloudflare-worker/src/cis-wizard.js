// Browser-only preparation; sources are selected by the caller, never inferred or fetched.
export const CIS_WIZARD_SCRIPT=String.raw`
function cisAssemble(value,schema) {
  if (!value || typeof value!=='object' || !schema || !schema.$defs) throw Error('The published schema is unavailable.');
  var nonempty=function(x){return typeof x==='string' && x.trim().length>0;};
  var facets=schema.$defs.exposure_facet.enum,types=schema.$defs.source_type.enum,stages=schema.properties.decision_stage.enum;
  var scopes=schema.properties.jurisdiction_review_scope.items.enum, sectors=schema.$defs.counterparty.properties.sector.enum;
  if (!nonempty(value.name)||!nonempty(value.jurisdiction)||!nonempty(value.risk_question)||!stages.includes(value.decision_stage)) throw Error('Enter the counterparty, jurisdiction, stage and question.');
  if(value.sector && !sectors.includes(value.sector)) throw Error('Select a valid sector.');
  if(!Array.isArray(value.facets)||!value.facets.length||value.facets.some(function(x){return !facets.includes(x);})||new Set(value.facets).size!==value.facets.length) throw Error('Choose at least one exposure facet.');
  if(!Array.isArray(value.scopes)||value.scopes.some(function(x){return !scopes.includes(x);})||new Set(value.scopes).size!==value.scopes.length) throw Error('Choose valid review scopes.');
  if(!Array.isArray(value.sources)||value.sources.length>30) throw Error('Use at most 30 source records.');
  var seen=new Set();
  var sources=value.sources.map(function(row){
    var date=typeof row.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)?new Date(row.date+'T00:00:00Z'):null;
    if(!nonempty(row.id)||seen.has(row.id)||!types.includes(row.source_type)||!nonempty(row.title)||!date||isNaN(date.getTime())||date.toISOString().slice(0,10)!==row.date||row.date.startsWith('0000')) throw Error('Each record needs a unique ID, type, title and real date.');
    seen.add(row.id);return {id:row.id,source_type:row.source_type,title:row.title,date:row.date};
  });
  var cp={name:value.name,jurisdiction:value.jurisdiction};
  if(value.sector)cp.sector=value.sector;
  var ownership=typeof value.ownership==='string'?value.ownership.split(/\r?\n/).filter(function(x){return x.trim();}):[];
  if(ownership.length>30)throw Error('Use at most 30 ownership layers.');
  if(ownership.length)cp.ownership_layers=ownership;
  return {counterparty:cp,exposure_facets:value.facets,...(value.scopes.length?{jurisdiction_review_scope:value.scopes}:{}),dated_sources:sources,
    risk_question:value.risk_question,decision_stage:value.decision_stage,requested_output:'structured_json'};
}
function mountCisWizard(schema){
  var root=document.getElementById('cis-wizard');if(!root)return;
  var batchBusy=false;
  var byId=function(id){return document.getElementById(id);};
  var make=function(tag,text){var el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  function checkboxes(id,values){values.forEach(function(value){var label=make('label');label.style.display='block';var box=make('input');box.type='checkbox';box.value=value;label.appendChild(box);label.appendChild(make('span',' '+value.replaceAll('_',' ')));byId(id).appendChild(label);});}
  function selected(id){return [...byId(id).querySelectorAll('input')].filter(function(x){return x.checked;}).map(function(x){return x.value;});}
  function addSource(){
    var rows=byId('cis-sources');if(rows.children.length>=30)return;
    var row=make('fieldset');row.appendChild(make('legend','Document record'));
    ['id','source_type','title','date'].forEach(function(field){
      var label=make('label',field.replaceAll('_',' '));label.style.display='block';
      var control=make(field==='source_type'?'select':'input');control.setAttribute('data-field',field);
      if(field==='source_type') {var first=make('option','Choose');first.value='';control.appendChild(first);schema.$defs.source_type.enum.forEach(function(v){var option=make('option',v.replaceAll('_',' '));option.value=v;control.appendChild(option);});}
      if(field==='date')control.type='date';label.appendChild(control);row.appendChild(label);
    });
    var remove=make('button','Remove');remove.type='button';remove.onclick=function(){row.remove();};row.appendChild(remove);rows.appendChild(row);
  }
  function rows(){return [...byId('cis-sources').children].map(function(row){var value={};row.querySelectorAll('[data-field]').forEach(function(field){value[field.getAttribute('data-field')]=field.value;});return value;});}
  checkboxes('cis-facets',schema.$defs.exposure_facet.enum);checkboxes('cis-scopes',schema.properties.jurisdiction_review_scope.items.enum);
  byId('cis-add-source').onclick=addSource;
  byId('cis-next-1').onclick=function(){byId('cis-step-2').hidden=false;byId('cis-step-2').scrollIntoView({behavior:'smooth'});};
  byId('cis-next-2').onclick=function(){byId('cis-step-3').hidden=false;byId('cis-step-3').scrollIntoView({behavior:'smooth'});};
  byId('cis-prepare').onclick=function(){
    try {
      var input=cisAssemble({name:byId('cis-name').value,jurisdiction:byId('cis-jurisdiction').value,sector:byId('cis-sector').value,ownership:byId('cis-ownership').value,
        facets:selected('cis-facets'),scopes:selected('cis-scopes'),sources:rows(),risk_question:byId('cis-question').value,decision_stage:byId('cis-stage').value},schema);
      byId('profile-request').value=JSON.stringify(input,null,2);var editor=byId('profile-intake');if(editor&&editor.updateFromJson)editor.updateFromJson();
      byId('cis-status').textContent='Request prepared. Review it below and explicitly choose Run free evidence check. No evaluation or upload occurred.';byId('profile-console').scrollIntoView({behavior:'smooth'});
    } catch(error){byId('cis-status').textContent=error.message+' No request was sent.';}
  };
  byId('cis-batch-prepare').onclick=async function(){
    var status=byId('cis-batch-status'),file=byId('cis-batch-file').files?.[0];
    if(batchBusy){status.textContent='Batch preparation is already running. Nothing was sent.';return;}
    if(!file || !/\.(?:csv|json)$/i.test(file.name) || file.size>65536){status.textContent='Choose a CSV or JSON file of at most 64 KiB. Nothing was sent.';return;}
    var options={facets:selected('cis-facets'),scopes:selected('cis-scopes'),decisionStage:byId('cis-stage').value,riskQuestion:byId('cis-question').value};
    batchBusy=true;byId('cis-batch-prepare').disabled=true;
    try {
      var text=await file.text(), counterparties;
      var current={facets:selected('cis-facets'),scopes:selected('cis-scopes'),decisionStage:byId('cis-stage').value,riskQuestion:byId('cis-question').value};
      if(byId('cis-batch-file').files?.[0]!==file || JSON.stringify(options)!==JSON.stringify(current)) throw Error('The file or review settings changed while reading; prepare again.');
      if(/\.json$/i.test(file.name)) {try{counterparties=JSON.parse(text);}catch{throw Error('JSON file is invalid.');}}
      else counterparties=parseCounterpartyCsv(text);
      var batch=prepareBatch(counterparties,options);
      byId('cis-batch-output').value=JSON.stringify(batch,null,2);byId('cis-batch-output').hidden=false;
      status.textContent='Prepared '+batch.requests.length+' requests locally. No evaluation or upload occurred. Review each record and add its actual evidence before using the separate batch endpoint.';
    } catch(error){status.textContent=error.message+' Nothing was sent; the previous preview remains unchanged.';}
    finally{batchBusy=false;byId('cis-batch-prepare').disabled=false;}
  };
}
`;
export function cisWizardHtml(schema, requiredSources=[]) {
  const types=schema?.$defs?.source_type?.enum || [];
  const options=values=>(values||[]).map(x=>`<option value="${x}">${x.replaceAll('_',' ')}</option>`).join('');
  const sources=requiredSources.filter(x=>types.includes(x)).map(x=>`<li>${x.replaceAll('_',' ')}</li>`).join('');
  return `<section id="cis-wizard" aria-label="Prepare counterparty review"><h2>Prepare a counterparty review in three steps</h2>
    <p>Use authorized, redacted details. Select each document category yourself; no files are uploaded or fetched. Preparing the request uses no trial attempt.</p>
    <fieldset><legend>1. Counterparty and decision</legend><label>Name <input id="cis-name" type="text"></label><label>Jurisdiction <input id="cis-jurisdiction" type="text"></label>
      <label>Sector (optional) <select id="cis-sector"><option value="">Not supplied</option>${options(schema?.$defs?.counterparty?.properties?.sector?.enum)}</select></label>
      <label>Disclosed ownership layers, one per line (optional) <textarea id="cis-ownership" rows="3"></textarea></label>
      <label>Decision stage <select id="cis-stage"><option value="">Choose</option>${options(schema?.properties?.decision_stage?.enum)}</select></label>
      <label>Review question <input id="cis-question" type="text" value="What evidence is missing before human review?"></label><button id="cis-next-1" type="button">Next: exposure facets</button></fieldset>
    <fieldset id="cis-step-2" hidden><legend>2. Exposure facets and review scope</legend><p>Select the facets you want reviewed; scope is optional and does not establish legal applicability.</p><div id="cis-facets"></div><p>Jurisdiction review scope (optional)</p><div id="cis-scopes"></div><button id="cis-next-2" type="button">Next: document records</button></fieldset>
    <fieldset id="cis-step-3" hidden><legend>3. Document records</legend><p>Optional: list records you actually hold. The gate checks these five categories; record labels do not establish validity:</p><ul>${sources}</ul><div id="cis-sources"></div>
      <button id="cis-add-source" type="button">Add document record</button><button id="cis-prepare" type="button">Prepare request — no evaluation</button></fieldset>
    <p id="cis-status" role="status"></p><p>Related reviews: <a href="https://middle-corridor-deal-risk-gate.agendamcp.dpdns.org/">Middle Corridor</a>, <a href="https://dual-use-technology-export.agendamcp.dpdns.org/">dual-use export</a>, <a href="https://interaction-trust.agendamcp.dpdns.org/">agent interaction trust</a>. Opening a link does not transfer this case; admission and input are separate.</p>
    <h3>Review a counterparty chain</h3><p>Prepare up to 10 counterparties locally from CSV (<code>name,jurisdiction</code>) or a JSON array of objects with exactly those fields. Choose the shared stage, question and facets above first. The preview contains empty evidence lists; add actual evidence for each case yourself. No data is uploaded or evaluated here.</p>
    <label>Counterparty file <input type="file" id="cis-batch-file" accept=".csv,.json"></label><button id="cis-batch-prepare" type="button">Prepare local batch preview</button><p id="cis-batch-status" role="status"></p><textarea id="cis-batch-output" rows="12" readonly hidden aria-label="Prepared batch JSON"></textarea>
    <p>Review every result, including failures. Batch has separate admission and price; the single-case free trial does not cover it. <a href="https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/examples/cis-secondary-sanctions/README.md#prepare-a-batch-locally">Batch preparation and review guide</a> · <a href="/.well-known/x402">Serving price and access</a>.</p></section>`;
}
