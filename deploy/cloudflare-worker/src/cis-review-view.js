// Presentation-only projection. A cell is never an applicability or screening verdict.
// Serialized for the browser; callbacks are anonymous for Wrangler keepNames.
export function cisReviewView(request,response) {
  if (!request || typeof request!=='object' || !response || typeof response!=='object' || response.error || response.code ||
      response.human_review_required!==true || response.authorization_granted!==false ||
      !Array.isArray(response.minimum_sources_before_review) || !Array.isArray(response.exposure_facets)) return null;
  const owners={ofac_sdn_extract:'Sanctions / compliance reviewer',eu_consolidated_extract:'Sanctions / compliance reviewer',
    ownership_chain_evidence:'Counterparty / ownership reviewer',bank_correspondent_evidence:'Treasury / banking reviewer',
    transit_or_invoice_evidence:'Trade operations reviewer'};
  const missing=response.minimum_sources_before_review;
  if(missing.some(value=>typeof value!=='string'||!Object.hasOwn(owners,value)))return null;
  const actions=missing.map(source=>({owner:owners[source],source_type:source,
    action:'Obtain '+source.replaceAll('_',' ')+' and independently review issuer, date, content and relevance.'}));
  const screening=response.screening_assessment;
  if(!screening || screening.status!=='name_screen_only' || screening.freshness!=='fresh') actions.unshift({owner:'Sanctions / compliance reviewer',
    action:'Establish the current screening status and obtain a fresh authorized screening result before relying on a negative match.'});
  if(response.vizier_status==='degraded' || response.vizier_status==='unknown') actions.unshift({owner:'Compliance / security reviewer',
    action:'Resolve the unavailable ownership-screening step and independently verify the ownership chain.'});
  if(response.exposure_facets.includes('ict_or_dual_use_goods') && Array.isArray(response.supplied_sources) && !response.supplied_sources.includes('dual_use_export_evidence')) {
    actions.push({owner:'Export-control / compliance reviewer',source_type:'dual_use_export_evidence',
      action:'Consider obtaining classification and end-use evidence; the gate does not classify the product or determine licensing.'});
  }
  const facets=response.exposure_facets.filter(value=>typeof value==='string').slice(0,20);
  const scopes=Array.isArray(request.jurisdiction_review_scope)?request.jurisdiction_review_scope.filter(value=>typeof value==='string').slice(0,12):[];
  const auto=Array.isArray(response.auto_fetched_sources)?response.auto_fetched_sources.slice(0,10).map(item=>({
    source_type:typeof item?.source_type==='string'?item.source_type:'unknown',
    title:typeof item?.title==='string'?item.title:'Unnamed record'})):null;
  return {facets,scopes,actions,next_one_thing:actions[0]?.action || 'Have a qualified reviewer verify the sources and complete result.',
    screening_status:typeof screening?.status==='string'?screening.status:'not_reported',
    freshness:typeof screening?.freshness==='string'?screening.freshness:'not_reported',
    match_count:Number.isInteger(screening?.name_matches)?screening.name_matches:null,auto,
    auto_total:Array.isArray(response.auto_fetched_sources)?response.auto_fetched_sources.length:null,
    live_status:typeof response.live_retrieval_status==='string'?response.live_retrieval_status:'not_reported',
    live_upstream:typeof response.live_retrieval_upstream==='string'?response.live_retrieval_upstream:null,
    snapshot_date:typeof response.live_retrieval_snapshot_generated_at==='string'?response.live_retrieval_snapshot_generated_at:null,
    ownership_screening:typeof response.vizier_status==='string'?response.vizier_status:'not_reported',
    ownership_assessment:typeof response.beneficial_ownership_clearance?.assessment_status==='string'?response.beneficial_ownership_clearance.assessment_status:'not_reported'};
}
export function cisReviewViewHtml(request,response,escape) {
  const view=cisReviewView(request,response);if(!view)return '';
  const rows=view.facets.map(facet=>'<tr><th scope="row">'+escape(facet)+'</th>'+view.scopes.map(()=>'<td>Not assessed</td>').join('')+'</tr>').join('');
  const matrix=view.facets.length&&view.scopes.length ? '<div style="overflow-x:auto"><table><caption>Facet × requested scope — applicability and per-cell risk not assessed</caption><thead><tr><th>Facet</th>'+view.scopes.map(scope=>'<th>'+escape(scope)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>'
    : '<p>No facet or jurisdiction scope was supplied for a matrix. Do not infer applicability or a negative result.</p>';
  const matches=view.auto===null?'<p>Detailed auto-fetched records were not included in this response; enrichment availability is unknown.</p>' :
    view.auto.length?'<p>Reported auto-fetched records (showing '+view.auto.length+' of '+view.auto_total+'; possible matches require identity and ownership review):</p><ul>'+view.auto.map(item=>'<li>'+escape(item.source_type)+': '+escape(item.title)+'</li>').join('')+'</ul>'
      :'<p>No auto-fetched records were reported. This alone does not distinguish disabled, unavailable or no-match enrichment.</p>';
  const next=view.actions.length?'<ol>'+view.actions.map(item=>'<li><strong>'+escape(item.owner)+':</strong> '+escape(item.action)+'</li>').join('')+'</ol>'
    :'<p>No source-category gaps were returned; independent verification and human review remain required.</p>';
  return '<section aria-label="CIS review context"><h3>Suggested next actions</h3><p>Suggestions only, not assignments or legal requirements.</p>'+next+
    '<h3>Requested review matrix</h3>'+matrix+'<p>The table records the caller’s requested facets and scope only; it does not assess legal applicability, sanctions exposure or semantic support.</p>'+
    '<h3>Screening and enrichment</h3><p>Name screening: '+escape(view.screening_status)+'; freshness: '+escape(view.freshness)+'; possible matches: '+(view.match_count===null?'not reported':escape(view.match_count))+'. Upstream: '+escape(view.live_status)+(view.live_upstream?' ('+escape(view.live_upstream)+')':'')+(view.snapshot_date?'; snapshot: '+escape(view.snapshot_date):'')+'.</p>'+matches+
    '<p>Reported ownership screening status: '+escape(view.ownership_screening)+'; reported ownership assessment: '+escape(view.ownership_assessment)+'. A separate GLEIF execution status is not exposed here.</p>'+
    '<p>A name match is not identity verification or a sanctions determination. No source title, score or empty list authorizes onboarding. Human review remains required.</p></section>';
}
