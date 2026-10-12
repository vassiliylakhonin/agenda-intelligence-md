// Discoverable facets of existing evaluations, not new RPC methods or grants.
// Keep output pointers tied to the actual response; contract tests execute each
// published example and fail if a declared result stops being returned.
const FACETS = {
  agentic_interaction_trust: [
    ['agentic-authority-evidence-gaps', 'Delegated authority and scope evidence gaps',
      'Lists missing principal authorization, tool-scope and session evidence for the proposed action. Supplied references do not authenticate the actor or grant authority.',
      ['delegation', 'tool-scope', 'evidence-gaps'], ['/minimum_sources_before_action', '/evidence_gaps', '/top_risk_dimensions'],
      'Which principal authorization and tool-scope evidence is missing for this proposed action?'],
    ['agentic-human-review-handoff', 'Agent-action human-review handoff',
      'Returns the readiness label, triage recommendation and review packet for the requested action. The consuming integration must enforce its own permissions and human approval.',
      ['human-review', 'agent-to-agent', 'readiness'], ['/triage_recommendation', '/decision_readiness_label', '/readiness_contract'],
      'Prepare the evidence-readiness handoff before a human reviews this agent action.']
  ],
  cis_secondary_sanctions: [
    ['cis-source-coverage-review', 'Counterparty source-coverage review',
      'Identifies missing sanctions, ownership, banking and transit reference categories and unusable source metadata. Reference coverage is not identity or sanctions clearance.',
      ['counterparty', 'source-coverage', 'evidence-gaps'], ['/minimum_sources_before_review', '/evidence_gaps', '/source_record_review'],
      'Which dated source categories are missing from this counterparty review file?'],
    ['cis-exposure-review-handoff', 'Secondary-exposure human-review handoff',
      'Separates exposure dimensions, readiness and review routing for the supplied counterparty file. Configured upstream availability remains explicit; no legal determination is issued.',
      ['secondary-sanctions', 'human-review', 'readiness'], ['/top_exposure_dimensions', '/decision_readiness_label', '/triage_recommendation'],
      'Prepare the exposure dimensions and human-review routing for this counterparty file.']
  ],
  gulf_maritime_exposure: [
    ['gulf-voyage-evidence-gaps', 'Vessel and voyage evidence-gap review',
      'Reports missing voyage, insurance and counterparty source categories and reference-metadata issues. Does not verify physical vessel identity, ownership or cover.',
      ['maritime', 'vessel', 'evidence-gaps'], ['/minimum_sources_before_review', '/evidence_gaps', '/source_record_review'],
      'Which voyage and insurance evidence is missing before fixture review?'],
    ['gulf-chokepoint-review-watch', 'Chokepoint review watchlist',
      'Returns route-related disruption questions and watch-next indicators from the supplied voyage. This is a static review checklist, not live maritime monitoring.',
      ['chokepoint', 'hormuz', 'review-checklist'], ['/chokepoint_disruption_watch', '/watch_next', '/triage_recommendation'],
      'Which chokepoint questions and changes should a human reviewer watch for on this voyage?']
  ],
  market_entry_readiness: [
    ['market-entry-claim-audit', 'Market-entry commitment claim audit',
      'Distinguishes supported, assumption-only and unsupported commitment statements using the supplied file and open blockers. It does not verify source truth or authorize a launch.',
      ['kazakhstan', 'claim-audit', 'commitment-review'], ['/claim_audit', '/assumptions', '/strongest_reason_to_pause'],
      'Which validation and launch-commitment claims are unsupported by this market-entry file?'],
    ['market-entry-owner-action-plan', 'Market-entry evidence owner action plan',
      'Returns missing documents, responsible owners and next actions for the current decision stage. Local legal, tax and customs conclusions require qualified human review.',
      ['market-entry', 'owner-actions', 'evidence-gaps'], ['/evidence_gaps', '/owner_actions', '/readiness_label'],
      'Prepare the missing-document and owner-action plan before the next market-entry commitment.']
  ],
  critical_minerals_due_diligence: [
    ['mineral-document-quality-review', 'Mineral dossier document-quality review',
      'Checks supplied document metadata, excerpts, validity and project/commodity/origin scope. It does not authenticate the issuer, certify mineral origin or perform an assay.',
      ['critical-minerals', 'document-quality', 'source-scope'], ['/dossier_review/source_reviews', '/dossier_review/eligible_source_types'],
      'Which supplied mineral documents have scope, validity or excerpt-quality issues?'],
    ['mineral-procurement-evidence-plan', 'Mineral procurement evidence action plan',
      'Returns stage-specific missing evidence and owner actions before procurement or offtake review. Applicability questions remain for human review; no compliance certification is issued.',
      ['offtake', 'procurement', 'owner-actions'], ['/dossier_review/owner_actions', '/minimum_sources_before_go', '/evidence_gaps'],
      'Which supplier and counsel actions are needed before this mineral offtake review?']
  ],
  dual_use_technology_export: [
    ['export-file-reference-review', 'Export-file reference and evidence review',
      'Reviews supplied dated references and returns the evidence ledger and gaps. It does not determine an ECCN, retrieve control lists or verify source content.',
      ['export-controls', 'source-coverage', 'evidence-gaps'], ['/export_risk_triage/evidence_ledger', '/export_risk_triage/source_record_review', '/export_risk_triage/evidence_gaps'],
      'Which dated classification and end-user references need review in this export file?'],
    ['export-diversion-review-handoff', 'Export diversion-question human-review handoff',
      'Returns declared classification, end-user and transit review questions, including a bundled HS reference lead where applicable. A reference lead does not establish applicable controls or a licensing decision.',
      ['end-user', 'transit', 'human-review'], ['/export_risk_triage/primary_risk_vectors', '/export_risk_triage/status', '/export_risk_triage/human_review_required'],
      'Prepare the end-user and transit questions for a qualified export-control reviewer.']
  ],
  corridor_sanctions_assistant: [
    ['corridor-structured-gate-routing', 'Route a deal question to a structured gate',
      'Selects the existing corridor, counterparty, maritime, market-entry or export gate and returns its address and required input. This orientation does not run the selected evaluation.',
      ['routing', 'corridor', 'agent-discovery'], ['/selected_route', '/next_gate_input', '/gates'],
      'Which structured gate should review a counterparty ownership file in Kazakhstan?'],
    ['corridor-review-intake-handoff', 'Person-led deal-review intake handoff',
      'Returns the public contact, support hours and scoping steps for person-led review. No message is sent and no engagement or fee is accepted by this call.',
      ['intake', 'human-review', 'deal-review'], ['/engagement/contact_email', '/engagement/support_hours', '/engagement/next_step'],
      'What context should I prepare for person-led review of an Aktau to Baku shipment?']
  ],
  agent_financial_guard: [
    ['financial-approval-pattern-review', 'Token approval and intent-pattern review',
      'Reviews the proposed transaction method and intent for local risk-rule findings. The returned checks and violations are heuristic evidence for a human, not transaction authorization.',
      ['token-approval', 'intent', 'pre-sign'], ['/financial_guard_verdict/checks', '/financial_guard_verdict/violations', '/financial_guard_verdict/decision'],
      'Review this proposed token approval and its supplied intent before a human signs.'],
    ['financial-spending-evidence-gaps', 'Spending-policy evidence-gap review',
      'Reports spending-policy and current-screening evidence gaps with the actual check scope. Caller-reported spending history is unverified; no authoritative spending limit is enforced here.',
      ['spending-policy', 'evidence-gaps', 'human-review'], ['/financial_guard_verdict/check_scope', '/financial_guard_verdict/evidence_gaps', '/financial_guard_verdict/execution_advisory'],
      'Which spending-policy and screening evidence is missing before signing this transfer?']
  ],
  m2m_escrow_arbiter: [
    ['escrow-artifact-integrity-review', 'Delivered artifact integrity and schema review',
      'Reports supplied artifact hash and bounded offline-schema check status, including missing or unsupported evidence. It does not independently prove delivery or authorize settlement.',
      ['artifact-integrity', 'json-schema', 'delivery-evidence'], ['/arbitration_ruling/check_status/hash', '/arbitration_ruling/check_status/schema', '/arbitration_ruling/evidence_gaps'],
      'Review the expected hash, supplied artifact and schema evidence in this delivery dispute.'],
    ['escrow-deadline-slo-review', 'Delivery deadline and SLO evidence review',
      'Reports deadline and SLO check status for the submitted evidence and proposed review outcome. Timestamps and telemetry remain caller-reported; human approval is required before settlement.',
      ['deadline', 'slo', 'human-review'], ['/arbitration_ruling/check_status/deadline', '/arbitration_ruling/check_status/slo', '/arbitration_ruling/settlement_authorized'],
      'Review deadline and SLO evidence in this delivery dispute before human settlement review.']
  ]
};

function focusedExample(base, profile, id, question) {
  const example = structuredClone(base);
  const part = example.request.params.message.parts[0];
  if (profile === 'corridor_sanctions_assistant') part.text = question;
  else if (profile === 'agent_financial_guard') part.data.intent.prompt = question;
  else if (profile === 'm2m_escrow_arbiter') part.data.dispute_claim.reason = question;
  else if (profile === 'critical_minerals_due_diligence') part.data.decision_question = question;
  else part.data.risk_question = question;
  if (id === 'financial-approval-pattern-review') {
    part.data.transaction.method = 'approve';
    part.data.transaction.calldata = '0x095ea7b3' + '0'.repeat(24) +
      '1111111111111111111111111111111111111111' + 'f'.repeat(64);
  }
  if (id === 'escrow-artifact-integrity-review') {
    part.data.delivery_submission.artifact_data = 'synthetic delivery';
    part.data.specification.expected_artifact_sha256 = 'bb7777d519c2d97f25e40e680308971a9504e4f2fe4977b956c93f8040b80a1b';
    part.data.specification.expected_schema = { type: 'string', minLength: 1 };
  }
  if (id === 'escrow-deadline-slo-review') {
    part.data.delivery_submission.submitted_at = '2026-09-18T12:00:00Z';
  }
  return example;
}

export function addSkillDiscovery(card, profile) {
  const facets = FACETS[profile];
  const base = card.x_agenda_intelligence?.a2a_send_message_example;
  if (!facets || !base) return card;
  const contracts = [{ skill_id: card.skills[0].id, a2a_example: structuredClone(base),
    result_root: '/result/task/metadata/response', result_pointers: [] }];
  for (const [id, name, description, tags, pointers, question] of facets) {
    const example = focusedExample(base, profile, id, question);
    const part = example.request.params.message.parts[0];
    card.skills.push({ id, name, description,
      tags: [...tags, 'supplied-evidence', 'human-review'],
      examples: [JSON.stringify(part.data || part.text)],
      inputModes: [part.data ? 'application/json' : 'text/plain'],
      outputModes: [...card.skills[0].outputModes] });
    contracts.push({ skill_id: id, a2a_example: example,
      result_root: '/result/task/metadata/response', result_pointers: pointers });
  }
  card.x_agenda_intelligence.skill_invocations = {
    version: '1',
    scope: 'These skills are useful facets of the same existing profile evaluation, not separate RPC methods. ' +
      'Send the complete example request; no skillId selector is required. The same authentication, payment and human-review boundaries apply.',
    examples_are: 'Synthetic illustrative inputs; replace with supplied evidence. No live payment or evaluation is performed by discovery.',
    result_pointer_format: 'JSON Pointer relative to result_root in the A2A JSON-RPC response.',
    skills: contracts
  };
  return card;
}
