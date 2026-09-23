// Public commercial terms. No SLA or certification is implied by an evaluation.
import { TIER_PRO_USDC_AMOUNT, TIER_DOSSIER_USDC_AMOUNT, TIER_MICRO_CHECK_USDC_AMOUNT, TIER_MICRO_DISPUTE_USDC_AMOUNT, TIER_BANKABILITY_DOSSIER_USDC_AMOUNT } from "./profiles.js";
export const PRICING_MODELS = {
  tier_1_sandbox: { id: "tier-1-sandbox", name: "Community Sandbox", price: 0, billing_scheme: "per_hour", rate_limit: "50 queries/hour", auth_required: false, terms: "Evaluation only. Best-effort per-IP limit; no availability SLA." },
  tier_2_pro: { id: "tier-2-pro", name: "Pro API Access", price: TIER_PRO_USDC_AMOUNT, billing_scheme: "monthly", quota: "10,000 queries/month", auth_required: true, auth_type: "Bearer", terms: "API access. Support, custom policies and any SLA require a separate written agreement." },
  tier_micro_check: { id: "tier-micro-check", name: "Pre-sign evidence review", price: TIER_MICRO_CHECK_USDC_AMOUNT, billing_scheme: "per_call", auth_required: false, settlement_header: "X-Payment-Tx", terms: "Local risk evaluation; no transaction authorization or sanctions clearance. Payment does not improve evidence quality or guarantee a receipt." },
  tier_micro_dispute: { id: "tier-micro-dispute", name: "Escrow evidence review", price: TIER_MICRO_DISPUTE_USDC_AMOUNT, billing_scheme: "per_call", auth_required: false, settlement_header: "X-Payment-Tx", terms: "Evidence evaluation only. No settlement execution or clearance receipt." },
  tier_3_deal_dossier: { id: "tier-3-dossier", name: "Evidence Review Pilot", price: TIER_DOSSIER_USDC_AMOUNT, pilot_price: TIER_DOSSIER_USDC_AMOUNT, billing_scheme: "per_deal", terms: "Confirm scope and delivery date by email before payment. Human-reviewed evidence gaps; no legal opinion, certification or bank acceptance guarantee.", deliverables: ["Source and evidence-gap review within agreed scope", "Human-review handoff; no guaranteed JWS attestation"] },
  tier_bankability_dossier: { id: "tier-bankability-dossier", name: "Corridor financial-model export", price: TIER_BANKABILITY_DOSSIER_USDC_AMOUNT, billing_scheme: "per_deal", terms: "Illustrative model export based on supplied assumptions; no lender approval or investment advice." }
};
export function pricingHtml(escapeHtml) {
  return `<ul>${Object.values(PRICING_MODELS).map(p => `<li><strong>${escapeHtml(p.name)} — $${p.price}${p.billing_scheme === "monthly" ? " / month" : ""}</strong>: ${escapeHtml(p.terms)}${p.rate_limit ? ` ${escapeHtml(p.rate_limit)}.` : ""}${p.quota ? ` ${escapeHtml(p.quota)}.` : ""}</li>`).join("")}</ul>`;
}
