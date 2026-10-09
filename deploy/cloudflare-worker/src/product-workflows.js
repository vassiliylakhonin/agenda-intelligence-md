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
    owner: 'Agent operator / security reviewer',
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
    owner: 'Trade dossier owner / compliance reviewer',
    group: 'Prepare a dossier', task: 'Prepare a Middle Corridor shipment for review',
    bring: 'Route, cargo, counterparties, decision stage and dated source records.',
    get: 'Missing shipment documents and an escalation checklist.',
    next: 'Collect the flagged records and hand the dossier to the responsible trade reviewer.'
  },
  cis_secondary_sanctions: {
    owner: 'Counterparty owner / compliance reviewer',
    group: 'Prepare a dossier', task: 'Prepare a CIS counterparty for review',
    bring: 'Counterparty identity, exposure facets, decision stage and dated ownership/screening records.',
    get: 'Ownership and sanctions-evidence gaps with reviewer tasks.',
    next: 'Resolve identity and ownership evidence with the reviewer before onboarding or commitment.'
  },
  gulf_maritime_exposure: {
    owner: 'Voyage dossier owner / maritime reviewer',
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

// These projections are serialized into the browser with Function.toString().
// Keep callbacks anonymous: Wrangler's keepNames adds out-of-scope __name calls
// to locally named helpers. The bundled-browser regression exercises this seam.
// Unknown/error bodies cannot become positive results; raw responses stay available.
export function reviewSummary(response, workflow = {}) {
  if (!response || typeof response !== 'object' || Array.isArray(response) || response.error || response.code) return null;
  const value = response.financial_guard_verdict || response.arbitration_ruling || response.export_risk_triage || response;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const readiness = value.readiness_contract || {};
  const route = readiness.routing?.value || value.verdict || value.triage_recommendation || value.gate_decision || value.decision || value.ruling ||
    (response.export_risk_triage ? value.status : null) ||
    value.selected_route?.name || (value.kind === 'orientation_and_routing' ? value.next_gate_input : null) ||
    value.signal_screen?.recommended_mcp_tool;
  if (typeof route !== 'string') return null;
  const [gaps, suppliedActions] = [
    Array.isArray(readiness.blocking_gaps) ? readiness.blocking_gaps : Array.isArray(value.evidence_gaps) ? value.evidence_gaps :
      Array.isArray(value.signal_screen?.evidence_gaps) ? value.signal_screen.evidence_gaps : [],
    Array.isArray(readiness.owner_actions) ? readiness.owner_actions : Array.isArray(value.owner_actions) ? value.owner_actions :
      Array.isArray(value.next_actions) ? value.next_actions : typeof value.next_gate_input === 'string' ? [value.next_gate_input] : [],
  ].map(items => items.map(item => typeof item === 'string' ? item :
    item && typeof item === 'object' ? [item.owner, item.action || item.next_action || item.evidence_needed || item.description]
      .filter(v => typeof v === 'string').join(': ') : '').filter(Boolean));
  const leads = Array.isArray(value.primary_risk_vectors) ? value.primary_risk_vectors.filter(item => typeof item === 'string') : [];
  const actionsSuggested = suppliedActions.length === 0 && gaps.length > 0;
  const actions = actionsSuggested ? gaps.map(item => (workflow.owner || 'Dossier owner / reviewer') +
    ': Request the evidence needed to resolve: ' + item + ' Check issuer, date, content and applicability before relying on it.') : suppliedActions;
  const notice = readiness.boundary_notice || value.boundary_notice || value.not_advice_notice;
  const selectedGate = typeof value.selected_route?.a2a === 'string' &&
    /^https:\/\/(?:middle-corridor-deal-risk-gate|cis-secondary-sanctions|gulf-maritime-exposure|kazakhstan-market-entry-readiness|dual-use-technology-export)-a2a\.vassiliy-lakhonin\.workers\.dev\/?$/.test(value.selected_route.a2a)
    ? value.selected_route.a2a :
    Array.isArray(value.next_actions) && value.next_actions.some(item => typeof item === 'string' && item.includes('https://kazakhstan-market-entry-readiness-a2a.vassiliy-lakhonin.workers.dev/'))
      ? 'https://kazakhstan-market-entry-readiness-a2a.vassiliy-lakhonin.workers.dev/' : null;
  return { route, gaps, actions, actionsSuggested, leads,
    selectedGate,
    referencesOnly: value.source_record_review?.source_content_verified === false || value.factual_verification_performed === false,
    notice: typeof notice === 'string' ? notice : 'Review the full response and its evidence boundaries before acting.' };
}

export function reviewSummaryHtml(response, escape, workflow = {}) {
  const summary = reviewSummary(response, workflow);
  if (!summary) return '';
  const [gaps, remainingGaps, actions] = [summary.gaps.slice(0, 3), summary.gaps.slice(3), summary.actions]
    .map(items => '<ul>' + items.map(item => '<li>' + escape(item) + '</li>').join('') + '</ul>');
  return '<section aria-label="Review summary"><h3>Review summary</h3><p><strong>Returned route:</strong> ' + escape(summary.route) + '</p>' +
    (summary.selectedGate ? '<p><a href="' + escape(summary.selectedGate) + '">Open the selected evidence-review gate</a>. Prepare its required fields; your current input is not sent to another product.</p>' : '') +
    (summary.referencesOnly ? '<p>Document coverage only: source content and factual truth have not been verified. More declared records do not authorize a decision.</p>' : '') +
    (summary.leads.length ? '<strong>Review leads and missing inputs</strong><ul>' + summary.leads.map(item => '<li>' + escape(item) + '</li>').join('') + '</ul>' : '') +
    (summary.gaps.length ? '<strong>Evidence to resolve (' + summary.gaps.length + ')</strong>' + gaps +
      (summary.gaps.length > 3 ? '<details><summary>Remaining evidence gaps</summary>' + remainingGaps + '</details>' : '')
      : '<p>No blocking gaps listed. This does not establish factual truth or permission to act.</p>') +
    (summary.actions.length ? '<strong>' + (summary.actionsSuggested ? 'Suggested document requests — assign a person to each' : 'Assigned next steps') + '</strong>' +
      (summary.actionsSuggested ? '<details><summary>Document requests (' + summary.actions.length + ')</summary>' + actions + '</details>' : actions) : '') +
    '<p>' + escape(summary.notice) + '</p></section>';
}

export function reviewDeltaHtml(previous, current, escape) {
  const before = reviewSummary(previous);
  const after = reviewSummary(current);
  if (!before || !after) return '';
  const removed = [...before.gaps, ...before.leads].filter(item => ![...after.gaps, ...after.leads].includes(item));
  const added = [...after.gaps, ...after.leads].filter(item => ![...before.gaps, ...before.leads].includes(item));
  return '<section aria-label="Changes since previous check"><h3>Changes since previous check</h3>' +
    '<p>Reported gaps: ' + before.gaps.length + ' → ' + after.gaps.length + '. Returned route: ' + escape(before.route) + ' → ' + escape(after.route) + '.</p>' +
    (removed.length ? '<strong>No longer reported</strong><ul>' + removed.map(item => '<li>' + escape(item) + '</li>').join('') + '</ul>' : '') +
    (added.length ? '<strong>Newly reported</strong><ul>' + added.map(item => '<li>' + escape(item) + '</li>').join('') + '</ul>' : '') +
    '<p>Compared with the previous successful check on this page. Changed inputs can change scope; a disappearing item does not establish factual verification or permission.</p></section>';
}

export function taskChooserHtml(directory, escape) {
  return '<section aria-label="Choose by task"><h2>What do you need to do?</h2>' +
    ['Review agent work', 'Prepare a dossier', 'Choose a review'].map(group => '<h3>' + group + '</h3><ul>' +
      Object.entries(PRODUCT_WORKFLOWS).filter(([, work]) => work.group === group).map(([profile, work]) => {
        const gate = directory.gates.find(item => item.profile === profile);
        return gate ? '<li><a href="' + escape(gate.canonical_endpoint) + '/">' + escape(work.task) + '</a></li>' : '';
      }).join('') + '</ul>').join('') + '</section>';
}
