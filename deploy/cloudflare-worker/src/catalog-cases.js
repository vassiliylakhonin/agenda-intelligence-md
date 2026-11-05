// Public starter copy for a saved synthetic case. Each command selects only
// its own profile's fixture and never evaluates caller-supplied evidence.
export const CATALOG_CASES = Object.freeze({
  kazakhstan: ['Show a shipment memo example', 'Review an Aktau–Baku shipment memo for missing sources and follow-up before handoff.'],
  agent_output_verification: ['Show a one-claim citation check', 'One claim, one supplied source excerpt: see what happens when the excerpt does not contain the quoted words.'],
  m2m_escrow_arbiter: ['Show a hash and deadline check', 'Compare an agreed hash and deadline with a changed, late delivery before dispute review.'],
  cis_secondary_sanctions: ['Show a counterparty ownership example', 'Start with a company name, confirm its identity, then check which dated ownership records are missing.'],
  gulf_maritime_exposure: ['Show a voyage document check', 'Review a synthetic vessel, IMO, route and passage date for missing voyage records before fixture.'],
  market_entry_readiness: ['Show a Kazakhstan partner pre-sign check', 'See which dated documents to request before signing with a Kazakhstan partner.'],
  critical_minerals_due_diligence: ['Show an origin and processing mismatch', 'Review a fictional lithium dossier where a processing document has a different scope from the declared route.'],
  dual_use_technology_export: ['Show a full export-file check', 'Use an HS code for a preliminary hint; use the full file for ECCN, end-user, route and dated evidence review.'],
  corridor_sanctions_assistant: ['Show how to route an Aktau–Baku shipment', 'Start with a one-line trade question; get a specialist endpoint and a checklist of fields to complete. Routing is free.'],
  agentic_interaction_trust: ['Show an external agent with missing delegation', 'Review an external agent request that supplies identity claims but lacks evidence of delegated authority.'],
  agent_financial_guard: ['Show an unlimited token approval check', 'Inspect why an unlimited token approval is flagged before signing. No signature or transaction is submitted.']
});
