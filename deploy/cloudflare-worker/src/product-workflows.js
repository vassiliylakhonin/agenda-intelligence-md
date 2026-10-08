// Presentation only: task selection never changes a service decision or evidence.
export const PRODUCT_WORKFLOWS = Object.freeze({
  agenda: {
    group: 'Choose a review', task: 'Find the review for my task',
    bring: 'The question, proposed next decision and geography. Then prepare the selected profile’s structured inputs.',
    get: 'Suggested review modules and an evidence plan.',
    next: 'Open the selected profile and inspect its required inputs before submitting a dossier.'
  },
  corridor_sanctions_assistant: {
    group: 'Choose a review', task: 'Prepare a corridor review request',
    bring: 'Your corridor question, route, cargo and decision stage; keep unknown facts explicit.',
    get: 'A suggested evidence-review gate and the inputs it needs.',
    next: 'Prepare the selected gate’s dossier; routing does not evaluate or clear the shipment.'
  },
  agent_output_verification: {
    group: 'Review agent work', task: 'Check an AI report before sending it',
    bring: 'The claims to check, source IDs, actual source excerpts and any exact supporting quotes.',
    get: 'Unsupported claims, broken references, quote issues and repair steps for the reviewer.',
    next: 'Correct or remove unsupported claims, then rerun the same handoff. A reviewer still checks factual truth.'
  },
  agentic_interaction_trust: {
    group: 'Review agent work', task: 'Review another agent’s proposed action',
    bring: 'The declared actor, requested action, target, authorization and dated evidence.',
    get: 'Missing identity, authority and action-scope evidence before execution.',
    next: 'Have the action owner resolve the gaps and obtain the required authorization.'
  },
  agent_financial_guard: {
    group: 'Review agent work', task: 'Review a wallet action before signing',
    bring: 'The transaction network, recipient, amount, method, intent and any supplied policy limits.',
    get: 'Local transaction risk flags and explicit gaps in policy, history and screening.',
    next: 'Resolve the reported gaps with the wallet owner before signing; the review does not enforce limits.'
  },
  m2m_escrow_arbiter: {
    group: 'Review agent work', task: 'Review evidence of a delivered artifact',
    bring: 'Deal terms, specification, expected hash/schema, actual artifact and delivery evidence.',
    get: 'Delivery checks, missing evidence and a proposed allocation when supported.',
    next: 'Have the authorized parties review the delivery and settlement separately; no payout is executed.'
  },
  kazakhstan: {
    group: 'Prepare a dossier', task: 'Prepare a Middle Corridor shipment for review',
    bring: 'Route, cargo, counterparties, decision stage and dated source records.',
    get: 'Missing shipment documents and an escalation checklist.',
    next: 'Collect the flagged records and hand the dossier to the responsible trade reviewer.'
  },
  cis_secondary_sanctions: {
    group: 'Prepare a dossier', task: 'Prepare a CIS counterparty for review',
    bring: 'Counterparty identity, exposure facets, decision stage and dated ownership/screening records.',
    get: 'Ownership and sanctions-evidence gaps with reviewer tasks.',
    next: 'Resolve identity and ownership evidence with the reviewer before onboarding or commitment.'
  },
  gulf_maritime_exposure: {
    group: 'Prepare a dossier', task: 'Prepare a vessel and voyage file',
    bring: 'Vessel identifiers, voyage, cargo, counterparties and dated registry/insurance records.',
    get: 'Voyage dossier gaps and leads that need independent screening.',
    next: 'Ask the maritime reviewer to resolve vessel identity, ownership and cover before commitment.'
  },
  market_entry_readiness: {
    group: 'Prepare a dossier', task: 'Prepare a Kazakhstan entry decision',
    bring: 'Project, partner, decision stage, decision question and supplied document records.',
    get: 'Stage-specific blockers, document requests, owners and committee routing.',
    next: 'Assign the returned tasks to project, legal, tax and banking owners; rerun when evidence changes.'
  },
  critical_minerals_due_diligence: {
    group: 'Prepare a dossier', task: 'Prepare a mineral supplier for offtake review',
    bring: 'Commodity, project, origin/processing/target market, assessment date and scoped document excerpts.',
    get: 'Stage-specific origin, ownership and traceability gaps with document-owner tasks.',
    next: 'Request the missing issuer, date, excerpt and scope evidence before the next offtake decision.'
  },
  dual_use_technology_export: {
    group: 'Prepare a dossier', task: 'Prepare an export-control review file',
    bring: 'Shipment, supplied classification, destination, end user and dated supporting records.',
    get: 'Reference membership and export-dossier gaps; HS does not establish ECCN.',
    next: 'Have the qualified export reviewer resolve classification, end use and applicable requirements.'
  }
});

// This self-contained projection also runs in the browser. Unknown/error bodies
// cannot become positive results, and raw structured responses remain available.
export function reviewSummary(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response) || response.error || response.code) return null;
  const value = response.financial_guard_verdict || response.arbitration_ruling || response.export_risk_triage || response;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const readiness = value.readiness_contract || {};
  const route = readiness.routing?.value || value.verdict || value.triage_recommendation || value.gate_decision || value.decision || value.ruling ||
    (response.export_risk_triage ? value.status : null) ||
    value.selected_route?.name || (value.kind === 'orientation_and_routing' ? value.next_gate_input : null) ||
    value.signal_screen?.recommended_mcp_tool;
  if (typeof route !== 'string') return null;
  const text = item => typeof item === 'string' ? item :
    item && typeof item === 'object' ? [item.owner, item.action || item.next_action || item.evidence_needed || item.description].filter(v => typeof v === 'string').join(': ') : '';
  const gaps = (Array.isArray(readiness.blocking_gaps) ? readiness.blocking_gaps : Array.isArray(value.evidence_gaps) ? value.evidence_gaps :
    Array.isArray(value.signal_screen?.evidence_gaps) ? value.signal_screen.evidence_gaps : []).map(text).filter(Boolean);
  const actions = (Array.isArray(readiness.owner_actions) ? readiness.owner_actions : Array.isArray(value.owner_actions) ? value.owner_actions :
    Array.isArray(value.next_actions) ? value.next_actions : typeof value.next_gate_input === 'string' ? [value.next_gate_input] : []).map(text).filter(Boolean);
  const notice = readiness.boundary_notice || value.boundary_notice || value.not_advice_notice;
  return { route, gaps, actions,
    notice: typeof notice === 'string' ? notice : 'Review the full response and its evidence boundaries before acting.' };
}

export function reviewSummaryHtml(response, escape) {
  const summary = reviewSummary(response);
  if (!summary) return '';
  const list = items => '<ul>' + items.map(item => '<li>' + escape(item) + '</li>').join('') + '</ul>';
  return '<section aria-label="Review summary"><h3>Review summary</h3><p><strong>Returned route:</strong> ' + escape(summary.route) + '</p>' +
    (summary.gaps.length ? '<strong>Evidence to resolve (' + summary.gaps.length + ')</strong>' + list(summary.gaps.slice(0, 3)) +
      (summary.gaps.length > 3 ? '<details><summary>Remaining evidence gaps</summary>' + list(summary.gaps.slice(3)) + '</details>' : '')
      : '<p>No blocking gaps listed. This does not establish factual truth or permission to act.</p>') +
    (summary.actions.length ? '<strong>Assigned next steps</strong>' + list(summary.actions) : '') +
    '<p>' + escape(summary.notice) + '</p></section>';
}

export function taskChooserHtml(directory, escape) {
  return '<section aria-label="Choose by task"><h2>What do you need to do?</h2>' +
    ['Review agent work', 'Prepare a dossier', 'Choose a review'].map(group => '<h3>' + group + '</h3><ul>' +
      Object.entries(PRODUCT_WORKFLOWS).filter(([, work]) => work.group === group).map(([profile, work]) => {
        const gate = directory.gates.find(item => item.profile === profile);
        return gate ? '<li><a href="' + escape(gate.canonical_endpoint) + '/">' + escape(work.task) + '</a></li>' : '';
      }).join('') + '</ul>').join('') + '</section>';
}
