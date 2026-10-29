// Browser-only preparation: no network, source retrieval or evidence classification.
export const CORRIDOR_WIZARD_SCRIPT = String.raw`
function corridorAssemble(values, schema) {
  if (!values || typeof values !== 'object' || !schema || !schema.$defs) throw Error('The published request schema is unavailable.');
  var required = function(value) { return typeof value==='string' && value.trim().length>0; };
  var stages=schema.properties.decision_stage.enum, roles=schema.$defs.counterparty.properties.role.enum, types=schema.$defs.source_type.enum;
  if (!required(values.route) || !required(values.cargo) || !required(values.risk_question) || !stages.includes(values.decision_stage)) throw Error('Enter route, cargo, decision stage and the question.');
  if (!Array.isArray(values.counterparties) || !values.counterparties.length || values.counterparties.length>30) throw Error('Add 1–30 counterparties.');
  var counterparties=values.counterparties.map(function(row) {
    if (!roles.includes(row.role) || !required(row.name)) throw Error('Each counterparty needs a role and name.');
    return {role:row.role,name:row.name,...(required(row.jurisdiction)?{jurisdiction:row.jurisdiction}:{})};
  });
  if (!Array.isArray(values.dated_sources) || values.dated_sources.length>30) throw Error('Add at most 30 source records.');
  var ids=new Set();
  var dated_sources=values.dated_sources.map(function(row) {
    var date=typeof row.date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? new Date(row.date+'T00:00:00Z') : null;
    if (!required(row.id) || ids.has(row.id) || !types.includes(row.source_type) || !required(row.title) || !date || isNaN(date.getTime()) || date.toISOString().slice(0,10)!==row.date || row.date.startsWith('0000')) throw Error('Each source needs a unique ID, a selected type, title and real date.');
    ids.add(row.id);
    return {id:row.id,source_type:row.source_type,title:row.title,date:row.date};
  });
  return {route:values.route,cargo:values.cargo,counterparties:counterparties,dated_sources:dated_sources,
    risk_question:values.risk_question,decision_stage:values.decision_stage,requested_output:'structured_json'};
}
function mountCorridorWizard(schema) {
  var root=document.getElementById('corridor-wizard');if (!root) return;
  var byId=function(id){return document.getElementById(id);};
  var make=function(tag,text){var element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  var select=function(options,label){var item=make('select');item.setAttribute('aria-label',label);var first=make('option','Choose');first.value='';item.appendChild(first);options.forEach(function(value){var option=make('option',value.replaceAll('_',' '));option.value=value;item.appendChild(option);});return item;};
  function addRow(kind) {
    var rows=byId(kind==='party'?'corridor-parties':'corridor-sources');if(rows.children.length>=30)return;
    var row=make('fieldset'); row.setAttribute('data-row',kind); row.appendChild(make('legend',kind==='party'?'Counterparty':'Document record'));
    var fields=kind==='party'?['role','name','jurisdiction']:['id','source_type','title','date'];
    fields.forEach(function(field){
      var label=make('label',field.replaceAll('_',' '));label.style.display='block';
      var control=field==='role'?select(schema.$defs.counterparty.properties.role.enum,'Counterparty role'):
        field==='source_type'?select(schema.$defs.source_type.enum,'Document type'):make('input');
      if(field==='date')control.type='date';control.setAttribute('data-field',field);label.appendChild(control);row.appendChild(label);
    });
    var remove=make('button','Remove');remove.type='button';remove.onclick=function(){row.remove();};row.appendChild(remove);rows.appendChild(row);
  }
  function readRows(id) {return [...byId(id).children].map(function(row){var value={};row.querySelectorAll('[data-field]').forEach(function(field){value[field.getAttribute('data-field')]=field.value;});return value;});}
  byId('corridor-add-party').onclick=function(){addRow('party');};byId('corridor-add-source').onclick=function(){addRow('source');};
  byId('corridor-next-1').onclick=function(){byId('corridor-step-2').hidden=false;byId('corridor-step-2').scrollIntoView({behavior:'smooth'});};
  byId('corridor-next-2').onclick=function(){byId('corridor-step-3').hidden=false;byId('corridor-step-3').scrollIntoView({behavior:'smooth'});};
  byId('corridor-prepare').onclick=function(){
    try {
      var input=corridorAssemble({route:byId('corridor-route').value,cargo:byId('corridor-cargo').value,decision_stage:byId('corridor-stage').value,
        risk_question:byId('corridor-question').value,counterparties:readRows('corridor-parties'),dated_sources:readRows('corridor-sources')},schema);
      byId('profile-request').value=JSON.stringify(input,null,2);
      var editor=byId('profile-intake');if(editor && editor.updateFromJson)editor.updateFromJson();
      byId('corridor-status').textContent='Request prepared. Review it below, check the trial allowance, then explicitly choose Run free evidence check. No evaluation or upload occurred.';
      byId('profile-console').scrollIntoView({behavior:'smooth'});
    } catch(error){byId('corridor-status').textContent=error.message+' No request was sent.';}
  };
  addRow('party');
}
`;
export function corridorWizardHtml(schema, requiredSources = []) {
  const options=(schema?.properties?.decision_stage?.enum || []).map(item=>`<option value="${item}">${item.replaceAll('_',' ')}</option>`).join('');
  const types=schema?.$defs?.source_type?.enum || [];
  const required=requiredSources.filter(item=>types.includes(item)).map(item=>`<li>${item.replaceAll('_',' ')}</li>`).join('');
  return `<section id="corridor-wizard" aria-label="Prepare a deal file"><h2>Prepare a deal file in three steps</h2>
    <p>Enter redacted details and document records. You choose each document type; nothing is uploaded, retrieved or verified. Preparing the request uses no trial attempt.</p>
    <fieldset><legend>1. Route, cargo and decision</legend>
      <label>Route <input id="corridor-route" type="text"></label><label>Cargo <input id="corridor-cargo" type="text"></label>
      <label>Decision stage <select id="corridor-stage"><option value="">Choose</option>${options}</select></label>
      <label>Question for the reviewer <input id="corridor-question" type="text" value="What evidence is missing before human review?"></label>
      <button id="corridor-next-1" type="button">Next: counterparties</button></fieldset>
    <fieldset id="corridor-step-2" hidden><legend>2. Counterparties</legend><div id="corridor-parties"></div>
      <button id="corridor-add-party" type="button">Add counterparty</button><button id="corridor-next-2" type="button">Next: document records</button></fieldset>
    <fieldset id="corridor-step-3" hidden><legend>3. Document records</legend><p>Optional: use only records you actually have. Select their type yourself; a title or URL is not proof of content.</p>
      <p>The gate checks these same six categories across stages; a reviewer decides what applies to the deal:</p><ul>${required}</ul><div id="corridor-sources"></div>
      <button id="corridor-add-source" type="button">Add document record</button><button id="corridor-prepare" type="button">Prepare request — no evaluation</button></fieldset>
    <p id="corridor-status" role="status"></p>
    <p>Depending on the case, a reviewer may also use <a href="https://cis-secondary-sanctions.agendamcp.dpdns.org/">CIS secondary-sanctions review</a>,
      <a href="https://dual-use-technology-export.agendamcp.dpdns.org/">dual-use export review</a>,
      <a href="https://output-verification.agendamcp.dpdns.org/">memo citation review</a>, or
      <a href="https://agent-financial-guard.agendamcp.dpdns.org/">payment evidence review</a>. Opening a link does not transfer this file; each service has separate inputs and admission.</p></section>`;
}
