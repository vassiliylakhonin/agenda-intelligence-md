// Fixed server-side operations: a trial cannot select another tool or profile.
export const WORKER_TRIAL_PATH = '/v1/trial';
export const OUTPUT_TRIAL_PATH = '/v1/agent-output/trial';
export const TRIAL_PROFILES = Object.freeze({
  agenda: { tool: 'strategic_risk_triage', kind: 'routing' },
  corridor_sanctions_assistant: { tool: 'corridor_sanctions_assistant', kind: 'routing' },
  kazakhstan: { tool: 'middle_corridor_deal_risk', schema: 'schemas/v1/middle-corridor-deal-risk-request.schema.json' },
  agent_output_verification: { tool: 'agent_output_verification', route: '/v1/agent-output/verification' },
  agentic_interaction_trust: { tool: 'agentic_interaction_trust', route: '/v1/agentic-interaction/trust' },
  agent_financial_guard: { tool: 'agent_financial_pre_sign_check', route: '/v1/agent-financial/pre-sign-check' },
  m2m_escrow_arbiter: { tool: 'm2m_escrow_arbitration_ruling', route: '/v1/m2m-escrow/evaluate-dispute' },
  cis_secondary_sanctions: { tool: 'cis_secondary_sanctions_exposure', route: '/v1/cis-secondary-sanctions/exposure' },
  gulf_maritime_exposure: { tool: 'gulf_maritime_exposure', route: '/v1/gulf-maritime/exposure' },
  market_entry_readiness: { tool: 'kazakhstan_market_entry_readiness', route: '/v1/market-entry/readiness' },
  critical_minerals_due_diligence: { tool: 'critical_minerals_due_diligence', route: '/v1/critical-minerals/due-diligence' },
  dual_use_technology_export: { tool: 'dual_use_technology_export', route: '/v1/dual-use/technology-export' }
});
export function trialProfile(profile) {
  return Object.hasOwn(TRIAL_PROFILES, profile) ? TRIAL_PROFILES[profile] : null;
}
export function trialPath(profile) {
  return profile === 'agent_output_verification' ? OUTPUT_TRIAL_PATH : WORKER_TRIAL_PATH;
}
