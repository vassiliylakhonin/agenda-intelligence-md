// Suggestions only: do not change a service result, score, evidence or authorization.
// Also serialized into the browser; avoid named nested helpers (Wrangler keepNames).
export function corridorOwnerActions(request, response) {
  if (!request || typeof request !== 'object' || !response || typeof response !== 'object' || response.error || response.code ||
      !Array.isArray(response.minimum_sources_before_go) || !Array.isArray(response.evidence_gaps) ||
      !Array.isArray(response.supplied_sources) || response.human_review_required !== true || response.authorization_granted !== false ||
      typeof request.decision_stage !== 'string' || !Array.isArray(request.counterparties)) return [];
  const owners = {
    counterparty_registry_extract:'Counterparty / compliance reviewer',beneficial_ownership_source:'Counterparty / compliance reviewer',
    sanctions_list_extract:'Sanctions / compliance reviewer',customs_or_regulatory_source:'Customs / trade operations',
    insurance_clause_or_underwriter_note:'Insurance / risk owner',vessel_or_carrier_history:'Logistics / carrier reviewer'
  };
  const priority = {
    pre_signature:['counterparty_registry_extract','beneficial_ownership_source','sanctions_list_extract'],
    pre_shipment:['sanctions_list_extract','customs_or_regulatory_source','vessel_or_carrier_history'],
    in_transit:['vessel_or_carrier_history','insurance_clause_or_underwriter_note','customs_or_regulatory_source'],
    committee_review:['counterparty_registry_extract','beneficial_ownership_source','sanctions_list_extract']
  }[request.decision_stage] || [];
  const gaps=response.minimum_sources_before_go;
  if (gaps.some(type=>typeof type!=='string' || !Object.hasOwn(owners,type))) return [];
  const ordered=[...priority.filter(type=>gaps.includes(type)),...gaps.filter(type=>!priority.includes(type))];
  const actions=ordered.map(source_type=>({owner:owners[source_type],source_type,
    action:`For ${request.decision_stage}, request ${source_type.replaceAll('_',' ')}; independently verify issuer, date, content and relevance before review.`,
    suggested:true}));
  if (response.evidence_gaps.some(gap=>typeof gap==='string' && /configured upstream screening is unavailable|identity resolution|sanitization and credential rotation/iu.test(gap))) {
    actions.unshift({owner:'Compliance / security reviewer',action:'Resolve the reported screening or data-protection problem and review the complete gate result before any action.',suggested:true});
  }
  if (Array.isArray(response.top_risks) && response.top_risks.some(risk=>typeof risk==='string' && risk.includes('cargo includes a potential dual-use')) &&
      !response.supplied_sources.includes('end_user_or_reexport_evidence')) {
    actions.push({owner:'Export-control / compliance reviewer',source_type:'end_user_or_reexport_evidence',
      action:'Obtain end-user and re-export evidence and independently assess classification and destination; this keyword lead is not a licensing determination.',suggested:true});
  }
  if (request.counterparties.some(counterparty=>counterparty && counterparty.role==='bank') || /\b(?:bank|letter of credit|trade finance)\b/iu.test(`${request.risk_question || ''} ${request.notes || ''}`)) {
    actions.push({owner:'Banking / trade-finance owner',source_type:'contract_or_invoice_extract',
      action:'Ask the bank for its deal-specific requirements and review payment clauses; bank acceptance is not verified.',suggested:true});
  }
  return actions;
}

export function corridorOwnerActionsHtml(request, response, escape) {
  const actions=corridorOwnerActions(request,response);
  if (!actions.length) return '';
  return '<section aria-label="Suggested deal-file actions"><h3>Suggested next actions</h3>'+
    '<p>Ordered for the stated stage. These are suggestions, not assignments or legal requirements; all missing gate categories remain open. Verify issuer, date and content.</p><ol>'+
    actions.map(item=>'<li><strong>'+escape(item.owner)+':</strong> '+escape(item.action)+'</li>').join('')+
    '</ol><p>No signature, shipment, bank acceptance or other action is authorized.</p></section>';
}
