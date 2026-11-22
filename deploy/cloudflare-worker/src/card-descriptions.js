// Task-first card copy. Admission details below are derived from serving config.
export const CARD_DESCRIPTIONS = Object.freeze({
  "agenda": "Check a strategic-risk memo before handoff. Find missing source references and weak follow-up actions, or turn a question into an evidence plan and specialist review request.",
  "agent_output_verification": "Check an AI answer against the source excerpts you supply. Find missing citations and quote mismatches before a person reviews the answer for sharing. Not a fact check.",
  "agentic_interaction_trust": "Before accepting an external agent's request, review its claimed identity, action and authority evidence. Get the missing delegation records to request from the tool owner. Not identity verification or authorization.",
  "kazakhstan": "Before signature or shipment, review this route, cargo and counterparty file. Get missing customs, carrier and counterparty evidence for human review.",
  "cis_secondary_sanctions": "Prepare a CIS, Caucasus or Central Asia counterparty file before onboarding. Identify gaps in legal-entity, disclosed-ownership and dated screening records for compliance review. Not sanctions clearance.",
  "gulf_maritime_exposure": "Before chartering or fixture, review the vessel, voyage dates and route. Get the missing identity, ownership and P&I records to request for a human maritime review. No live vessel tracking or ownership verification.",
  "market_entry_readiness": "Prepare a Kazakhstan partner-signature or launch review. Bring the project, partner, decision stage and dated records; get missing documents, suggested owners and a review brief.",
  "corridor_sanctions_assistant": "Describe your shipment or trade counterparty and the decision ahead. Get a matching specialist, missing input fields and a draft request to complete. Routing is free; specialist evaluations have separate admission.",
  "critical_minerals_due_diligence": "Prepare a mineral supplier or offtake dossier for review. Find gaps in origin, ownership and traceability records, draft evidence requests, then compare the follow-up dossier. Records are not independently verified.",
  "dual_use_technology_export": "Prepare a technology shipment file for an export reviewer. Bring the declared HS code, supplied ECCN, end user, route and dated records; get reference hints and evidence gaps. Classification and licensing require a qualified reviewer.",
  "agent_financial_guard": "Review a proposed agent transaction against declared limits, approval patterns and a local denylist. Get risk flags and missing context before human signing review. No transaction is submitted or authorized.",
  "m2m_escrow_arbiter": "Compare delivered artifacts with agreed hashes, supported schemas and reported timing. Give the dispute reviewer a structured evidence comparison. The parties decide settlement; the service does not execute it."
});

// Keep the job first, then surface the existing opt-in trial before the rest
// of the product copy. Free routing already has a no-trial entry path.
export function cardDescription(profile, access, fallback = '') {
  const description = CARD_DESCRIPTIONS[profile] || fallback;
  if (!access?.free_trial || access.free_routing) return description;
  const end = description.indexOf('. ');
  const first = end < 0 ? description : description.slice(0, end + 1);
  const rest = end < 0 ? '' : description.slice(end + 2);
  const trial = `No-wallet trial: call MCP ${access.free_trial.mcp_status_tool}, then ${access.free_trial.mcp_tool} with its inputSchema arguments; for A2A use x_agenda_intelligence.a2a_free_trial. Shared-network limits and configured authentication apply.`;
  return [first, trial, rest].filter(Boolean).join(' ');
}
