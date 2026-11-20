// Short reader-facing views of the saved inputs and the next human action.
import { corridorOwnerActions } from './corridor-owner-actions.js';
import { escrowReviewHtml } from './escrow-review-view.js';
import { financialGuardViewHtml } from './fleet-review-view.js';
import { MEMO_QUALITY_EXAMPLE, CORRIDOR_MEMO_EXAMPLE, MEMO_QUALITY_TOOL } from './memo-quality-gate.js';
import { REPOSITORY_URL } from './profiles.js';

const captions = {
  agentic_interaction_trust: 'External agent requests checkout access',
  cis_secondary_sanctions: 'CIS counterparty onboarding file',
  gulf_maritime_exposure: 'Vessel handoff before fixture',
  market_entry_readiness: 'Kazakhstan partner file before signature',
  critical_minerals_due_diligence: 'Lithium supplier evidence request'
};

export function memoExampleHtml(isKazakhstan, escape) {
  const example = isKazakhstan ? CORRIDOR_MEMO_EXAMPLE : MEMO_QUALITY_EXAMPLE;
  const claim = example.memo_json.analysis.facts[0];
  const followUp = isKazakhstan
    ? 'Attach the dated booking record or mark the claim for verification before forwarding the memo.'
    : 'Add the dated continuity plan and the page or passage that supports this claim before circulation.';
  return `<section class="card" id="memo-example" aria-labelledby="memo-example-title">
    <h2 id="memo-example-title">Check a drafted ${isKazakhstan ? 'shipment' : 'strategic-risk'} memo</h2>
    <p>Saved fictional example · no trial attempt. The memo says “${escape(claim)}” without a source reference.</p>
    <p><strong>Finding.</strong> Source missing for a factual claim. ${followUp}</p>
    <p><code>${MEMO_QUALITY_TOOL}</code> checks the memo structure for free. A reviewer follows the source and confirms the claim.</p>
    <p><a href="/.well-known/examples/tools/${MEMO_QUALITY_TOOL}.json">Open the example request</a> · <a href="${REPOSITORY_URL}/blob/main/docs/deployment/memo-quality-gate.md">Call the memo checker over MCP or A2A</a></p>
  </section>`;
}

export function firstResultHtml(profile, request, response, escape) {
  const examples = {
    agentic_interaction_trust: [
      ['Record missing', 'Delegated authority for the checkout action. The actor supplies an identity claim.'],
      ['Who can supply it', 'Ask the agent operator for a scoped grant or record covering the action and target.'],
      ['Handoff', 'Give the proposed action and the authority record to the tool owner before execution.']
    ],
    cis_secondary_sanctions: [
      ['Identify the entity', 'The supplied name and jurisdiction need a registry reference or registration identifier.'],
      ['Ownership', 'Ask the onboarding owner for current documents covering the disclosed ownership layers.'],
      ['Screening evidence', 'The packet supplies a dated list excerpt. The example reports screening as unassessed. Ask compliance to confirm identity, coverage and date.']
    ],
    gulf_maritime_exposure: [
      ['Vessel identity', 'The dossier states an IMO. Ask maritime operations for a dated registry extract tying the identifier to the named vessel.'],
      ['Insurance and period', 'The file lacks a P&I certificate. Ask the broker for the issuer, policy period and cover for the proposed voyage.'],
      ['Ownership or control', 'Ask the maritime reviewer for a dated ownership or control record before handling the fixture decision.']
    ],
    market_entry_readiness: [
      ['Stage', 'Partner signature. The project lead sends the evidence request before the committee reviews the commitment.'],
      ['Illustrative document update', 'A current company-register extract matching the legal entity gives legal a record to check for this one gap.'],
      ['What stays open in this illustration', 'Review who can sign for the entity and whether the permits cover the planned activity. The saved software follow-up shows why placeholder references leave gaps open.']
    ]
  };
  if (Object.hasOwn(examples, profile)) {
    const items = examples[profile].map(([heading, value]) => `<div><dt>${escape(heading)}</dt><dd>${escape(value)}</dd></div>`).join('');
    return `<section aria-label="${escape(captions[profile])}"><h3>${escape(captions[profile])}</h3><dl class="result-list">${items}</dl></section>`;
  }
  if (profile === 'kazakhstan') {
    const reasons = {
      beneficial_ownership_source: 'Tie disclosed owners to the legal entities in the shipment file.',
      customs_or_regulatory_source: 'Confirm which dated declaration or regulatory record covers the cargo and route.',
      vessel_or_carrier_history: 'Identify the carrier and check that the booking and operating records cover the intended crossing.'
    };
    const actions = corridorOwnerActions(request, response).filter(item => Object.hasOwn(reasons, item.source_type));
    return `<h3>Aktau–Baku shipment document checklist</h3>
      <p>The fictional file names a route and cargo. Ask these reviewers for the first documents to check before handing off the shipment dossier.</p>
      <dl class="result-list">${actions.map(item => `<div><dt>${escape(item.source_type.replaceAll('_', ' '))}</dt><dd>${escape(reasons[item.source_type])} <strong>Owner.</strong> ${escape(item.owner)}.</dd></div>`).join('')}</dl>`;
  }
  if (profile === 'm2m_escrow_arbiter') return escrowReviewHtml(response, escape);
  if (profile === 'agent_financial_guard') return financialGuardViewHtml(response, escape, request);
  if (profile === 'corridor_sanctions_assistant' && response.handoff_draft) {
    const { copied_fields, required_fields_to_complete } = response.handoff_draft;
    return `<h3>Handoff for the Aktau–Baku question</h3>
      <p><strong>Copied into the draft.</strong> ${escape(copied_fields.join(', '))}. <strong>Fill in before sending.</strong> ${escape(required_fields_to_complete.map(field => field.replaceAll('_', ' ')).join(', '))}.</p>
      <p>Select “Prepare recommended gate” after routing your own question. Review the draft before submitting it under the specialist’s separate access terms.</p>`;
  }
  if (profile === 'critical_minerals_due_diligence') {
    const requests = response.dossier_review?.evidence_workflow?.evidence_requests ?? [];
    const request = requests.find(item => item.source_type === 'processing_and_refining_tolling_agreement');
    if (!request) return '';
    return `<h3>${captions[profile]}</h3>
      <p>The processing record needs to cover the declared project, commodity and processing chain. Send this draft to the supplier after review.</p>
      <blockquote>${escape(request.request_text)}</blockquote>
      <p>When the document arrives, keep the same project, commodity, origin, processing jurisdiction, target market and decision scope. Put the original request in <code>previous_submission</code> to compare which evidence categories are now reviewable. A reviewer checks the new evidence.</p>`;
  }
  return '';
}
