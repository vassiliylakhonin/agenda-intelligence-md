// Presentation only; never mutate a decision or turn absent screening into a pass.
export function financialGuardViewHtml(response,escape){
 const v=response?.financial_guard_verdict;if(!v||!['REJECT','HUMAN_REVIEW'].includes(v.pre_sign_verdict)||v.can_auto_sign!==false||!Array.isArray(v.blocking_reasons))return '';
 return '<section aria-label="Pre-sign review"><h3>Pre-sign review: '+escape(v.pre_sign_verdict)+'</h3><p>Automatic signing: not permitted by this review. Local denylist match: '+escape(String(v.local_denylist_hit))+'.</p><p><strong>Next:</strong> '+escape(v.next_one_thing)+'</p><ul>'+v.blocking_reasons.map(reason=>'<li>'+escape(reason)+'</li>').join('')+'</ul><p>Current sanctions, policy authority and spending history remain unverified. This service does not enforce signer behavior.</p></section>';
}
export function dualUseViewHtml(response,escape){
 const r=response?.export_risk_triage?.export_review;if(!r||!['NOT_READY','READY_FOR_EXPORT_CONTROL_REVIEW'].includes(r.verdict)||!Array.isArray(r.blocking_gaps)||!Array.isArray(r.review_leads))return '';
 return '<section aria-label="Export dossier review"><h3>Export dossier: '+escape(r.verdict)+'</h3><p>Stage: '+escape(r.stage)+'; classification: '+escape(r.classification_status)+'.</p><p><strong>Next:</strong> '+escape(r.next_one_thing)+'</p>'+(r.blocking_gaps.length?'<p>Missing review references:</p><ul>'+r.blocking_gaps.map(g=>'<li>'+escape(g)+'</li>').join('')+'</ul>':'<p>No missing reference categories reported; independent review remains required.</p>')+(r.review_leads.length?'<p>Review leads:</p><ul>'+r.review_leads.map(x=>'<li>'+escape(x)+'</li>').join('')+'</ul>':'')+'<p>'+escape(r.notice)+'</p><p>Related reviews: <a href="https://corridor-sanctions-assistant.agendamcp.dpdns.org/">Corridor Assistant</a>, <a href="https://middle-corridor-deal-risk-gate.agendamcp.dpdns.org/">Middle Corridor</a>, <a href="https://cis-secondary-sanctions.agendamcp.dpdns.org/">CIS Secondary Sanctions</a>. No case data is transferred by opening a link; each service has separate admission.</p></section>';
}

export function corridorPlanHtml(response,escape){
 if(response?.role!=='orientation_only'||response.not_a_clearance!==true||!Array.isArray(response.route_plan)||!response.desk_checklist)return '';
 const bank=Array.isArray(response.desk_checklist.bank_compliance)?response.desk_checklist.bank_compliance:[];
 const insurer=Array.isArray(response.desk_checklist.insurer)?response.desk_checklist.insurer:[];
 const route=response.route_plan.filter(x=>x&&typeof x.name==='string'&&typeof x.why==='string');
 const hint=response.hs_hint;
 return '<section aria-label="Orientation and specialist plan"><h3>Orientation only — not a clearance</h3><p><strong>Bank / compliance:</strong> '+bank.map(escape).join('; ')+'</p><p><strong>Insurer:</strong> '+insurer.map(escape).join('; ')+'</p><h3>Suggested specialist reviews</h3>'+(route.length?'<ol>'+route.map(x=>'<li>'+escape(x.name)+': '+escape(x.why)+'</li>').join('')+'</ol>':'<p>Clarify the subject and decision to select a specialist.</p>')+(hint?'<p>HS '+escape(hint.hs6)+': '+(hint.match_in_snapshot?'match':'no match')+' in the dated reference snapshot. '+escape(hint.notice)+'</p>':'')+'<p><strong>Next:</strong> '+escape(response.next_one_thing||'Review the selected gate requirements.')+'</p><p>'+escape(response.handoff_notice||'')+'</p></section>';
}
