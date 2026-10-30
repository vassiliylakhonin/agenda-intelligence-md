/** A supplied-content check; it does not verify the attestation or authorize settlement. */
export interface DeliveryReview {
  escrow_action: "HOLD";
  proposed_allocation: null;
  hash_check: "pass" | "fail" | "missing";
  schema_check: "pass" | "fail" | "missing" | "unsupported" | "unverified";
  deadline_check: "unverified";
  reported_timing: "within_deadline" | "late" | "unknown";
  slo_check: "unverified";
  independent_attestations: { references_provided: number; verification_status: "not_verified" };
  next_one_thing: string;
  notice: string;
}

export function parseDeliveryReview(value: unknown): DeliveryReview | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const r = value as Record<string, unknown>;
  const a = r.independent_attestations as Record<string, unknown> | null;
  if (r.escrow_action !== "HOLD" || r.proposed_allocation !== null ||
      (typeof r.hash_check !== "string" || !["pass", "fail", "missing"].includes(r.hash_check)) ||
      (typeof r.schema_check !== "string" || !["pass", "fail", "missing", "unsupported", "unverified"].includes(r.schema_check)) ||
      r.deadline_check !== "unverified" || r.slo_check !== "unverified" ||
      (typeof r.reported_timing !== "string" || !["within_deadline", "late", "unknown"].includes(r.reported_timing)) ||
      !a || typeof a !== "object" || Array.isArray(a) || a.verification_status !== "not_verified" ||
      !Number.isInteger(a.references_provided) || (a.references_provided as number) < 0 ||
      (a.references_provided as number) > 10 || typeof r.next_one_thing !== "string" ||
      r.next_one_thing.length > 2048 || typeof r.notice !== "string" || r.notice.length > 2048) return undefined;
  return { escrow_action: "HOLD", proposed_allocation: null,
    hash_check: r.hash_check as DeliveryReview["hash_check"],
    schema_check: r.schema_check as DeliveryReview["schema_check"], deadline_check: "unverified",
    reported_timing: r.reported_timing as DeliveryReview["reported_timing"], slo_check: "unverified",
    independent_attestations: { references_provided: a.references_provided as number, verification_status: "not_verified" },
    next_one_thing: r.next_one_thing, notice: r.notice };
}
