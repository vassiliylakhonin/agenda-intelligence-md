// Presentation-only projections: never change a service decision or assert document validity.
export function marketEntryView(request,response){
 if(!request||typeof request!=='object'||!response||typeof response!=='object'||response.error||response.code||response.human_review_required!==true||response.authorization_granted!==false||!Array.isArray(response.evidence_gaps)||!['proceed_to_validation','pause_for_evidence','route_to_committee','escalate_before_signature','not_decision_ready','stop'].includes(response.gate_decision)||!['insufficient_information','concept_ready','validation_ready','committee_review_ready','launch_commitment_ready'].includes(response.readiness_label))return null;
 const signature=['partner_company_profile','product_or_project_description','law_firm_opinion','counterparty_registry_extract','beneficial_ownership_source','counterparty_integrity_due_diligence','authority_to_sign_evidence','contract_or_term_sheet_draft'];
 const finance=['bank_account_and_kyc_onboarding','business_substance_evidence','tax_accounting_note','permanent_establishment_or_tax_residency_assessment','currency_control_and_repatriation_note','bankability_note'];
 const ops=['work_permit_and_local_employment_quota_note','customs_broker_memo','hs_code_classification','certification_pathway','packing_list_and_incoterms','battery_safety_documents','freight_forwarder_quote','insurance_or_cargo_handling_note','landed_cost_model','supplier_moq_payment_terms','land_or_site_control_evidence','grid_connection_and_offtake_evidence','service_partner_confirmation'];
 const groups=[{title:'Signature and partner review',items:[]},{title:'Banking, finance and tax review',items:[]},{title:'Import and launch operations',items:[]},{title:'Other returned gaps',items:[]}];
 for(const gap of response.evidence_gaps){
  if(!gap||typeof gap!=='object'||typeof gap.source_type!=='string'||typeof gap.next_action!=='string'||typeof gap.owner!=='string')return null;
  const index=signature.includes(gap.source_type)?0:finance.includes(gap.source_type)?1:ops.includes(gap.source_type)?2:3;
  groups[index].items.push({source_type:gap.source_type,owner:gap.owner,action:gap.next_action,blocked:typeof gap.decision_blocked==='string'?gap.decision_blocked:'Review the full result.'});
 }
 // A stop or pause can arise from the caller's blocker or upstream screening even without a matching document gap.
 const pause=typeof response.strongest_reason_to_pause==='string'?response.strongest_reason_to_pause:'';
 const first=groups.flatMap(g=>g.items)[0];
 const urgent=response.gate_decision==='stop'||(Array.isArray(request.known_blockers)&&request.known_blockers.length>0)||/upstream screening/i.test(pause);
 const next=urgent ? pause || 'Stop advancement and have a qualified reviewer inspect the complete result.' : first ? first.owner+': '+first.action : pause || 'Have a qualified reviewer examine the complete result and the sources.';
 const assumptions=Array.isArray(response.assumptions)?response.assumptions.filter(x=>typeof x==='string'):[];
 const lines=['Market-entry review — decision support only','Project: '+String(request.project_name||'not provided'),'Partner: '+String(request.partner_or_company||'not provided'),'Market: '+String(request.market||'not provided'),'Stage: '+String(request.decision_stage||'not provided'),'Returned decision: '+response.gate_decision,'Readiness label: '+response.readiness_label,'Next: '+next,'','Reported evidence gaps:'];
 for(const group of groups)for(const item of group.items)lines.push('- '+group.title+' | '+item.owner+' | '+item.action+' | '+item.blocked);
 const usable=response.source_record_review?.usable_source_types;
 lines.push('','Reference categories reported (content not verified):',...(Array.isArray(usable)&&usable.length?usable.filter(x=>typeof x==='string').map(x=>'- '+x):['- None reported']));
 lines.push('','Assumptions (not verified):',...(assumptions.length?assumptions.map(x=>'- '+x):['- None reported']), '', 'Source references and facts are not independently verified. Human review is required; no authorization is granted.');
 return {groups,next_one_thing:next,memo:lines.join('\n'),route:response.gate_decision,readiness:response.readiness_label,assumptions};
}
export function marketEntryViewHtml(request,response,escape){
 const view=marketEntryView(request,response);if(!view)return '';
 const sections=view.groups.filter(g=>g.items.length).map(g=>'<h4>'+escape(g.title)+'</h4><ul>'+g.items.map(item=>'<li><strong>'+escape(item.owner)+':</strong> '+escape(item.action)+' <small>Reported impact: '+escape(item.blocked)+'</small></li>').join('')+'</ul>').join('');
 return '<section aria-label="Market entry critical path"><h3>One next step</h3><p>'+escape(view.next_one_thing)+'</p><h3>Suggested owner plan</h3><p>Grouped for navigation from the returned gaps; owners are suggestions, not confirmed assignments or legal requirements.</p>'+(sections||'<p>No evidence gaps reported; verify the complete result and its limitations.</p>')+'<details><summary>Committee memo — copy locally</summary><p>Review and redact before sharing. No data is sent by preparing this memo.</p><textarea id="market-entry-memo" rows="16" readonly>'+escape(view.memo)+'</textarea><button id="market-entry-copy" type="button">Copy memo</button><span id="market-entry-copy-status" role="status"></span></details><p>Source references do not establish validity, and human review remains required.</p></section>';
}
export function marketEntryProgress(previousInput,previous,currentInput,current){
 const valid=['project_name','partner_or_company','market','decision_stage','decision_question'];
 if(!previousInput||!currentInput||!previous||!current||!valid.every(k=>typeof previousInput[k]==='string'&&previousInput[k].trim()!==''&&previousInput[k]===currentInput[k])||String(previousInput.sector||'')!==String(currentInput.sector||'')||String(previousInput.commercial_objective||'')!==String(currentInput.commercial_objective||'')||JSON.stringify(previousInput.counterparties||[])!==JSON.stringify(currentInput.counterparties||[])||!marketEntryView(previousInput,previous)||!marketEntryView(currentInput,current))return null;
 const removed=[],added=[];
 for(const [left,right,out] of [[previous.evidence_gaps,current.evidence_gaps,removed],[current.evidence_gaps,previous.evidence_gaps,added]]){
  const counts=new Map();for(const item of right){const k=JSON.stringify([item.source_type,item.owner,item.next_action]);counts.set(k,(counts.get(k)||0)+1);}
  for(const item of left){const k=JSON.stringify([item.source_type,item.owner,item.next_action]),count=counts.get(k)||0;if(count)counts.set(k,count-1);else out.push(item.source_type);}
 }
 return {before_count:previous.evidence_gaps.length,after_count:current.evidence_gaps.length,before_route:previous.gate_decision,after_route:current.gate_decision,no_longer_reported:removed,newly_reported:added,notice:'Inputs, assumptions or screening state can change. Fewer listed gaps do not verify records or authorize a commitment.'};
}
export function marketEntryProgressHtml(previousInput,previous,currentInput,current,escape){
 const progress=marketEntryProgress(previousInput,previous,currentInput,current);if(!progress)return '';
 return '<section aria-label="Changes since previous review"><h3>Changes since previous check — same stated project and scope</h3><p>Reported gaps: '+progress.before_count+' → '+progress.after_count+'. Returned decision: '+escape(progress.before_route)+' → '+escape(progress.after_route)+'.</p>'+(progress.no_longer_reported.length?'<p>No longer reported: '+progress.no_longer_reported.map(escape).join(', ')+'</p>':'')+(progress.newly_reported.length?'<p>Newly reported: '+progress.newly_reported.map(escape).join(', ')+'</p>':'')+'<p>'+escape(progress.notice)+'</p></section>';
}
