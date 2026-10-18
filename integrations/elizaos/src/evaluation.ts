/** Advisory evidence metadata; these fields never grant signing or settlement authority. */
export type NextAction = "block" | "review" | "insufficient";
export type CheckStatus = "pass" | "fail" | "not_assessed";
export interface EvidenceDiagnostics {
  next_action?: NextAction;
  authorization_granted?: false;
  decision_kind?: "evidence_review";
  score_kind?: "risk" | "evidence_readiness" | "not_scored";
  check_status?: Record<string, CheckStatus>;
  check_scope?: Record<string, string>;
  vizier_status?: "attestation_unavailable";
}
export function evidenceDiagnostics(value: any, blocked = false, insufficient = false): EvidenceDiagnostics {
  const next = value?.next_action;
  const statuses: Record<string,CheckStatus> = {};
  const scopes: Record<string,string> = {};
  for (const [key,status] of Object.entries(value?.check_status || {}).slice(0,32)) {
    if (/^[a-z][a-z0-9_]{0,63}$/.test(key) && ["pass","fail","not_assessed"].includes(status as string)) statuses[key]=status as CheckStatus;
  }
  for (const [key,scope] of Object.entries(value?.check_scope || {}).slice(0,32)) {
    if (/^[a-z][a-z0-9_]{0,63}$/.test(key) && typeof scope === "string" && /^[a-z][a-z0-9_]{0,99}$/.test(scope)) scopes[key]=scope;
  }
  return {
    next_action: blocked || next === "block" || Boolean(value?.violations?.length) ? "block" : insufficient ? "insufficient" : ["review","insufficient"].includes(next) ? next :
      Array.isArray(value?.evidence_gaps) && value.evidence_gaps.length ? "insufficient" : "review",
    authorization_granted: false,
    decision_kind: "evidence_review",
    score_kind: ["risk","evidence_readiness","not_scored"].includes(value?.score_kind) ? value.score_kind : "not_scored",
    check_status: statuses,
    check_scope: scopes,
    vizier_status: "attestation_unavailable"
  };
}
