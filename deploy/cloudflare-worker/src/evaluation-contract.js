import {buildRemediation} from './remediation.js';
// Advisory routing metadata. Domain verdicts remain unchanged; no authority is granted.
const BLOCK = new Set(['block', 'reject', 'stop', 'no_go', 'block_until_verified', 'block_unsafe_claims', 'REFUND_TO_BUYER']);
const INSUFFICIENT = new Set(['insufficient_information', 'not_decision_ready', 'pause_for_evidence', 'request_evidence']);

export function evaluationContract(response) {
  const value = response.financial_guard_verdict || response.arbitration_ruling || response;
  const routes = ['verdict', 'decision', 'gate_decision', 'triage_recommendation', 'ruling'].map(key => value[key]);
  routes.push(value.operational_decision?.decision);
  let blocked = routes.some(route => BLOCK.has(route)) || Boolean(value.violations?.length);
  let insufficient = value.orientation?.status === 'EVIDENCE_NOT_ASSESSED' || Boolean(value.evidence_gaps?.length || value.blocking_gaps?.length) || routes.some(route => INSUFFICIENT.has(route));
  for (const item of value.results || []) {
    const action = item?.response ? evaluationContract(item.response).next_action : 'insufficient';
    blocked ||= action === 'block';
    insufficient ||= action === 'insufficient';
  }
  return {
    next_action: blocked ? 'block' : insufficient ? 'insufficient' : 'review',
    decision_kind: 'evidence_review',
    authorization_granted: false,
    score_kind: response.financial_guard_verdict ? 'risk'
      : ['decision_readiness_score', 'readiness_score'].some(key => Number.isFinite(value[key])) ? 'evidence_readiness' : 'not_scored'
  };
}

export function withEvaluationContract(response, options={}) {
  const remediation=response.remediation||buildRemediation(response,options);
  return {...response, ...evaluationContract(response), ...(remediation?{remediation}:{})};
}
