import {TIER_MICRO_CHECK_USDC_AMOUNT, TIER_MICRO_DISPUTE_USDC_AMOUNT,
  TIER_BANKABILITY_DOSSIER_USDC_AMOUNT} from './profiles.js';

const ROUTING_TOOLS = Object.freeze({
  agenda: 'strategic_risk_triage',
  corridor_sanctions_assistant: 'corridor_sanctions_assistant'
});
export const routingToolForProfile = profile => ROUTING_TOOLS[profile] || null;
export const isFreeRoutingTool = (profile, name) => Boolean(name && routingToolForProfile(profile) === name);

// A shared host is not a price boundary: named screening and model exports
// remain paid even on a host whose ordinary orientation route is free.
export const evaluationAmount = (profile, name) => name === 'corridor_bankability_screen'
  ? TIER_BANKABILITY_DOSSIER_USDC_AMOUNT : isFreeRoutingTool(profile,name) ? 0
  : profile === 'm2m_escrow_arbiter' ? TIER_MICRO_DISPUTE_USDC_AMOUNT : TIER_MICRO_CHECK_USDC_AMOUNT;
