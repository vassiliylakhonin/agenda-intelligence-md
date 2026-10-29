// Request preparation only: no evidence is inferred, fetched, or evaluated.
export const GULF_WIZARD_SCRIPT=String.raw`
function gulfAssemble(value,schema){
  if(!schema || !schema.$defs)throw Error('Published schema unavailable.');
  var nonempty=function(x){return typeof x==='string' && !!x.trim();};
  if(!schema.$defs.voyage.properties.chokepoint.enum.includes(value.chokepoint) || !schema.properties.decision_stage.enum.includes(value.stage) || !nonempty(value.question))throw Error('Choose a route, decision stage and question.');
  if(!Array.isArray(value.facets)||!value.facets.length||value.facets.some(function(x){return !schema.$defs.exposure_facet.enum.includes(x);})||new Set(value.facets).size!==value.facets.length)throw Error('Choose at least one valid facet.');
  if(!Array.isArray(value.sources)||value.sources.length>30)throw Error('Use at most 30 document records.');
  var seen=new Set(), sources=value.sources.map(function(row){
    var date=typeof row.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)?new Date(row.date+'T00:00:00Z'):null;
    if(!nonempty(row.id)||seen.has(row.id)||!schema.$defs.source_type.enum.includes(row.source_type)||!nonempty(row.title)||!date||isNaN(date.getTime())||date.toISOString().slice(0,10)!==row.date||row.date.startsWith('0000'))throw Error('Each record needs a unique ID, type, title and real date.');
    seen.add(row.id);return {id:row.id,source_type:row.source_type,title:row.title,date:row.date};
  });
  var vessel={};['name','imo','mmsi','flag','vessel_type'].forEach(function(key){if(nonempty(value[key]))vessel[key]=value[key].trim();});
  var voyage={chokepoint:value.chokepoint};['origin','destination'].forEach(function(key){if(nonempty(value[key]))voyage[key]=value[key].trim();});
  var request={voyage:voyage,exposure_facets:value.facets,decision_stage:value.stage,dated_sources:sources,risk_question:value.question.trim(),requested_output:'structured_json'};
  if(Object.keys(vessel).length)request.vessel=vessel;
  if(nonempty(value.cargo))request.cargo=value.cargo.trim();
  if(nonempty(value.insurer))request.counterparties=[{role:'insurer_or_pi_club',name:value.insurer.trim()}];
  return request;
}
function mountGulfWizard(schema){
 var root=document.getElementById('gulf-wizard');if(!root)return;
 var byId=function(id){return document.getElementById(id);};
 var make=function(tag,text){var el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 schema.$defs.exposure_facet.enum.forEach(function(value){var label=make('label');label.style.display='block';var box=make('input');box.type='checkbox';box.value=value;label.appendChild(box);label.appendChild(make('span',' '+value.replaceAll('_',' ')));byId('gulf-facets').appendChild(label);});
 byId('gulf-add-source').onclick=function(){
   var rows=byId('gulf-sources');if(rows.children.length>=30)return;var row=make('fieldset');row.appendChild(make('legend','Document reference'));
   ['id','source_type','title','date'].forEach(function(field){var label=make('label',field.replaceAll('_',' '));label.style.display='block';var control=make(field==='source_type'?'select':'input');control.setAttribute('data-field',field);
     if(field==='source_type'){var empty=make('option','Choose');empty.value='';control.appendChild(empty);schema.$defs.source_type.enum.forEach(function(v){var option=make('option',v.replaceAll('_',' '));option.value=v;control.appendChild(option);});}
     if(field==='date')control.type='date';label.appendChild(control);row.appendChild(label);});
   var remove=make('button','Remove');remove.type='button';remove.onclick=function(){row.remove();};row.appendChild(remove);rows.appendChild(row);
 };
 byId('gulf-prepare').onclick=function(){try{
   var value={};['name','imo','mmsi','flag','vessel_type','origin','destination','cargo','insurer','chokepoint','stage','question'].forEach(function(key){value[key]=byId('gulf-'+key).value;});
   value.facets=[...byId('gulf-facets').querySelectorAll('input')].filter(function(el){return el.checked;}).map(function(el){return el.value;});
   value.sources=[...byId('gulf-sources').children].map(function(row){var item={};row.querySelectorAll('[data-field]').forEach(function(field){item[field.getAttribute('data-field')]=field.value;});return item;});
   var request=gulfAssemble(value,schema);byId('profile-request').value=JSON.stringify(request,null,2);if(byId('profile-intake').updateFromJson)byId('profile-intake').updateFromJson();
   byId('gulf-status').textContent='Request prepared locally. No evaluation, upload, identity verification or trial attempt occurred. Review it below before submitting.';byId('profile-console').scrollIntoView({behavior:'smooth'});
 }catch(error){byId('gulf-status').textContent=error.message+' No request was sent; the previous input is unchanged.';}};
}
`;
export function gulfWizardHtml(schema,requiredSources=[]){
 const opts=values=>(values||[]).map(x=>`<option value="${x}">${x.replaceAll('_',' ')}</option>`).join('');
 const list=requiredSources.filter(x=>schema?.$defs?.source_type?.enum?.includes(x)).map(x=>`<li>${x.replaceAll('_',' ')}</li>`).join('');
 return `<section id="gulf-wizard" aria-label="Prepare voyage review"><h2>Prepare a voyage file before fixture</h2>
 <p>Enter only authorized, redacted information. Identifiers and document references are caller claims, not verified facts. Preparing this form does not submit or consume a trial.</p>
 <fieldset><legend>1. Vessel and voyage</legend><label>IMO (if known) <input id="gulf-imo"></label><label>MMSI (if known) <input id="gulf-mmsi"></label><label>Vessel name <input id="gulf-name"></label><label>Flag <input id="gulf-flag"></label><label>Vessel type <input id="gulf-vessel_type"></label>
 <label>Chokepoint <select id="gulf-chokepoint"><option value="">Choose</option>${opts(schema?.$defs?.voyage?.properties?.chokepoint?.enum)}</select></label><label>Origin <input id="gulf-origin"></label><label>Destination <input id="gulf-destination"></label><label>Cargo <input id="gulf-cargo"></label>
 <label>P&amp;I club or insurer (leave blank if unknown) <input id="gulf-insurer"></label><label>Decision stage <select id="gulf-stage">${opts(schema?.properties?.decision_stage?.enum)}</select></label><label>Review question <input id="gulf-question" value="What evidence is missing before human review of this voyage?"></label></fieldset>
 <fieldset><legend>2. Exposure facets</legend><p>Select relevant facets yourself. STS requires an additional history reference. AIS quality is not assessed.</p><div id="gulf-facets"></div></fieldset>
 <fieldset><legend>3. Document references</legend><p>The baseline checklist is below. References are not uploaded or verified; omit anything you do not have.</p><ul>${list}</ul><div id="gulf-sources"></div><button id="gulf-add-source" type="button">Add document reference</button> <button id="gulf-prepare" type="button">Prepare request — no evaluation</button><p id="gulf-status" role="status"></p></fieldset>
 <details><summary>Voyage playbook prompts</summary><p>Use these as prompts for a reviewer, not as automatically verified conditions. The baseline five categories above apply to every request; select applicable facets and records yourself.</p><ul>
 <li>Hormuz crude: ask for cargo/bill-of-lading and origin records alongside sanctions and cover references.</li>
 <li>Red Sea container: ask for route advisories, cargo and cover records.</li>
 <li>Bab-el-Mandeb transit: ask for current route and war-risk cover information.</li>
 <li>Gulf of Oman STS: select STS and provide transfer history if it exists; AIS alone cannot establish an STS event.</li></ul></details>
 <p>Related checks: <a href="https://cis-secondary-sanctions.agendamcp.dpdns.org/">CIS counterparties</a>, <a href="https://dual-use-technology-export.agendamcp.dpdns.org/">dual-use cargo</a>, <a href="https://agent-financial-guard.agendamcp.dpdns.org/">payment review</a>. Each has separate admission; opening a link transfers no case data.</p></section>`;
}
export function gulfGateHtml(result,escape){
 const gate=result?.voyage_gate;if(!gate||!Array.isArray(gate.blocking_reasons))return '';
 return `<section><h3>Voyage evidence gate: ${escape(gate.verdict)}</h3><p>Review stage: ${escape(gate.readiness_level)}. AIS quality: ${escape(gate.ais_quality)}.</p><p>Blocking reason codes: ${gate.blocking_reasons.length?gate.blocking_reasons.map(escape).join(', '):'none reported'}</p><p>${escape(gate.notice)}</p></section>`;
}
