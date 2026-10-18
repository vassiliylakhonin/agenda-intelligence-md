// Evaluation attestation only. Never an execution, relay or settlement grant.
import { base64urlEncode, jcs, publicJwkFromPrivate } from "./jws.js";
import { sha256Jcs } from "./decision-receipt.js";

export const OUTPUT_RECEIPT_TYPE = "agenda-output-evaluation+jws";
export const OUTPUT_RECEIPT_POLICY = "output-evidence-review.v1";
export const OUTPUT_RECEIPT_TTL = 300;
const encoder = new TextEncoder();
const hashPattern = /^sha256:[a-f0-9]{64}$/;

// Explicitly bounded evaluation. Transport, trial and payment metadata is not
// attested. Consumers must use the returned verified evaluation, not a sibling.
export const OUTPUT_RECEIPT_FIELDS = Object.freeze([
  "verdict",
  "trust_signal",
  "readiness_score",
  "score_scope",
  "factual_verification_performed",
  "readiness_label",
  "claim_count",
  "grounded_claim_count",
  "unsafe_claims",
  "weak_claims",
  "unsupported_statements",
  "evidence_gaps",
  "owner_actions",
  "watch_next",
  "human_review_required",
  "not_advice_notice",
  "limitations",
  "next_action",
  "decision_kind",
  "authorization_granted",
  "score_kind",
  "reason_codes",
  "checks",
]);

export function outputEvaluation(value) {
  const evaluation = {};
  for (const field of OUTPUT_RECEIPT_FIELDS) {
    if (!Object.hasOwn(value, field))
      throw new Error("Incomplete output evaluation");
    evaluation[field] = value[field];
  }
  if (
    evaluation.authorization_granted !== false ||
    evaluation.human_review_required !== true ||
    evaluation.factual_verification_performed !== false ||
    !["block", "review", "insufficient"].includes(evaluation.next_action)
  ) {
    throw new Error("Invalid advisory evaluation boundary");
  }
  return JSON.parse(jcs(evaluation));
}

function origin(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || value !== url.origin)
    throw new Error("Pin an HTTPS origin");
  return url.origin;
}
const readKey = (key) => (typeof key === "string" ? JSON.parse(key) : key);
function decode(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("Invalid base64url");
  const b64 =
    segment.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (segment.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function signOutputReceipt({
  request,
  response,
  privateJwk,
  issuer,
  kid = null,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  const key = readKey(privateJwk);
  if (key?.kty !== "EC" || key.crv !== "P-256" || !key.d)
    throw new Error("Private P-256 key required");
  const evaluation = outputEvaluation(response);
  const payload = {
    iss: origin(issuer),
    iat: nowSeconds,
    exp: nowSeconds + OUTPUT_RECEIPT_TTL,
    jti: crypto.randomUUID(),
    policy_version: OUTPUT_RECEIPT_POLICY,
    not_authorization: true,
    request_hash: await sha256Jcs(request),
    response_hash: await sha256Jcs(evaluation),
  };
  const header = { alg: "ES256", typ: OUTPUT_RECEIPT_TYPE };
  if (kid || key.kid) header.kid = kid || key.kid;
  const prefix = [header, payload]
    .map((value) => base64urlEncode(encoder.encode(jcs(value))))
    .join(".");
  const signingKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    encoder.encode(prefix),
  );
  return {
    format: OUTPUT_RECEIPT_TYPE,
    token: prefix + "." + base64urlEncode(new Uint8Array(signature)),
    request_hash: payload.request_hash,
    response_hash: payload.response_hash,
    issued_at: new Date(payload.iat * 1000).toISOString(),
    expires_at: new Date(payload.exp * 1000).toISOString(),
  };
}

// No key discovery and no network here: neither jku nor an untrusted issuer can
// choose the verification key. The integrator supplies a trusted origin/key.
export async function verifyOutputReceipt({
  request,
  response,
  publicJwk,
  expectedIssuer,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  const refuse = (reason_code) => ({
    valid: false,
    reason_code,
    authorization_granted: false,
    evaluation: null,
  });
  try {
    if (!Number.isInteger(nowSeconds)) return refuse("INVALID_RECEIPT");
    const trustedOrigin = origin(expectedIssuer);
    const token = response?.evaluation_receipt?.token;
    if (typeof token !== "string" || token.length > 8192)
      return refuse("INVALID_RECEIPT");
    const parts = token.split(".");
    if (parts.length !== 3) return refuse("INVALID_RECEIPT");
    const parse = (s) =>
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decode(s)));
    const header = parse(parts[0]),
      payload = parse(parts[1]);
    const key = publicJwkFromPrivate(readKey(publicJwk));
    if (
      header.alg !== "ES256" ||
      header.typ !== OUTPUT_RECEIPT_TYPE ||
      Object.keys(header).some((k) => !["alg", "typ", "kid"].includes(k)) ||
      key.kty !== "EC" ||
      key.crv !== "P-256" ||
      (key.kid && header.kid !== key.kid)
    )
      return refuse("INVALID_RECEIPT");
    if (
      payload.iss !== trustedOrigin ||
      payload.policy_version !== OUTPUT_RECEIPT_POLICY ||
      payload.not_authorization !== true ||
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > OUTPUT_RECEIPT_TTL ||
      typeof payload.jti !== "string" ||
      !payload.jti ||
      !hashPattern.test(payload.request_hash) ||
      !hashPattern.test(payload.response_hash)
    )
      return refuse("INVALID_RECEIPT");
    const verifyKey = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const signature = decode(parts[2]);
    if (
      signature.length !== 64 ||
      !(await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        verifyKey,
        signature,
        encoder.encode(parts[0] + "." + parts[1]),
      ))
    )
      return refuse("INVALID_SIGNATURE");
    if (nowSeconds >= payload.exp) return refuse("RECEIPT_EXPIRED");
    if (payload.iat > nowSeconds + 30) return refuse("RECEIPT_NOT_YET_VALID");
    const evaluation = outputEvaluation(response);
    if (
      payload.request_hash !== (await sha256Jcs(request)) ||
      payload.response_hash !== (await sha256Jcs(evaluation))
    ) {
      return refuse("BINDING_MISMATCH");
    }
    return {
      valid: true,
      reason_code: "VALID_EVALUATION_RECEIPT",
      authorization_granted: false,
      evaluation,
    };
  } catch {
    return refuse("INVALID_RECEIPT");
  }
}
