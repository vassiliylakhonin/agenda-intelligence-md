// Short-lived, stateless readiness receipts for the hosted decision Gate.
//
// A receipt proves that this Worker signed one deterministic pre_action_check
// result for one exact canonical request. It is deliberately not an identity,
// delegated-authority, legal-clearance, or factual-truth token. The enforcing
// caller must compare both hashes and require gate_passed=true before using it.

import { base64urlEncode, jcs, publicJwkFromPrivate } from "./jws.js";

export const DECISION_RECEIPT_FORMAT = "agenda-readiness-receipt+jws";
export const DECISION_RECEIPT_TTL_SECONDS = 300;
export const DECISION_POLICY_VERSION = "pre-action-check.v1";
export const DECISION_NOT_AUTHORIZATION_NOTICE =
  "A valid readiness receipt is not authorization, identity proof, factual verification, legal clearance, or " +
  "external approval. It proves only that this Worker signed the stated pre-action readiness result for the " +
  "bound request during the receipt lifetime; the caller remains responsible for enforcement and the action.";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const DECISIONS = Object.freeze(["continue", "request_evidence", "require_approval", "stop"]);
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function readJwk(input) {
  if (typeof input === "string") return JSON.parse(input);
  return input;
}

function base64urlDecode(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("invalid base64url value");
  }
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replace(/-/gu, "+").replace(/_/gu, "/") + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseBase64urlJson(value) {
  return JSON.parse(TEXT_DECODER.decode(base64urlDecode(value)));
}

function isoFromSeconds(seconds) {
  return new Date(seconds * 1000).toISOString();
}

function jwksUrl(issuer) {
  const url = new URL(issuer);
  if (url.protocol !== "https:") throw new Error("decision receipt issuer must use HTTPS");
  return new URL("/.well-known/jwks.json", url).toString();
}

export async function sha256Jcs(value) {
  const digest = await crypto.subtle.digest("SHA-256", TEXT_ENCODER.encode(jcs(value)));
  return (
    "sha256:" +
    Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  );
}

function actionIdentity(request) {
  return {
    actor: request.actor,
    requested_action: request.requested_action,
    target: request.target,
    risk_tier: request.risk_tier
  };
}

export async function decisionRequestHashes(request) {
  const [requestHash, actionHash] = await Promise.all([sha256Jcs(request), sha256Jcs(actionIdentity(request))]);
  return { request_hash: requestHash, action_hash: actionHash };
}

export function decisionPolicyCatalog() {
  return {
    policies: [
      {
        policy_id: DECISION_POLICY_VERSION,
        policy_version: DECISION_POLICY_VERSION,
        decision_tool: "decision_check",
        verify_tool: "decision_verify",
        // raw, not the blob view: a caller told this is its input schema has to
        // be able to parse what comes back, and the blob URL serves an HTML page.
        input_schema:
          "https://raw.githubusercontent.com/vassiliylakhonin/agenda-intelligence-md/main/schemas/v1/pre-action-check-request.schema.json",
        decisions: [...DECISIONS],
        positive_decision: "continue",
        receipt_ttl_seconds: DECISION_RECEIPT_TTL_SECONDS
      }
    ],
    receipt_format: DECISION_RECEIPT_FORMAT,
    binding: {
      // JCS canonicalizes structure, not text, so two implementations that both
      // follow RFC 8785 still disagree when the same name arrives decomposed.
      // The Gate hashes what it received and normalizes nothing; a caller whose
      // text can reach it in more than one normal form has to settle that
      // itself, before hashing, or it gets binding_mismatch on a request both
      // sides would call identical.
      unicode_normalization: "none",
      request_hash: {
        algorithm: "SHA-256",
        canonicalization: "RFC8785-JCS",
        input: "complete_request"
      },
      action_hash: {
        algorithm: "SHA-256",
        canonicalization: "RFC8785-JCS",
        fields: ["actor", "requested_action", "target", "risk_tier"]
      }
    },
    not_authorization_notice: DECISION_NOT_AUTHORIZATION_NOTICE
  };
}

function assertDecision(decision, request) {
  if (!decision || typeof decision !== "object") throw new Error("decision result is required");
  if (!DECISIONS.includes(decision.decision)) throw new Error("decision result has an unsupported decision");
  if (decision.policy_version !== DECISION_POLICY_VERSION) throw new Error("decision policy version is unsupported");
  if (decision.run_id !== request.run_id) throw new Error("decision run_id does not match request run_id");
  for (const field of ["decision_id", "run_id", "reason_code"]) {
    if (typeof decision[field] !== "string" || decision[field].length === 0) {
      throw new Error(`decision result is missing ${field}`);
    }
  }
}

export async function signDecisionReceipt({
  request,
  decision,
  privateJwk: privateJwkInput,
  issuer,
  kid = null,
  nowSeconds = Math.floor(Date.now() / 1000)
}) {
  assertDecision(decision, request);
  const privateJwk = readJwk(privateJwkInput);
  if (!privateJwk || privateJwk.kty !== "EC" || privateJwk.crv !== "P-256" || !privateJwk.d) {
    throw new Error("decision receipt signing key must be a private EC P-256 JWK");
  }
  const effectiveKid = kid || privateJwk.kid || null;
  const issuedAt = Math.trunc(nowSeconds);
  const expiresAt = issuedAt + DECISION_RECEIPT_TTL_SECONDS;
  const hashes = await decisionRequestHashes(request);
  const payload = {
    receipt_id: crypto.randomUUID(),
    decision_id: decision.decision_id,
    run_id: decision.run_id,
    policy_version: decision.policy_version,
    decision: decision.decision,
    reason_code: decision.reason_code,
    request_hash: hashes.request_hash,
    action_hash: hashes.action_hash,
    iat: issuedAt,
    exp: expiresAt,
    iss: issuer,
    not_authorization: true
  };
  const header = {
    alg: "ES256",
    typ: DECISION_RECEIPT_FORMAT,
    jku: jwksUrl(issuer)
  };
  if (effectiveKid) header.kid = effectiveKid;

  const headerB64 = base64urlEncode(TEXT_ENCODER.encode(jcs(header)));
  const payloadB64 = base64urlEncode(TEXT_ENCODER.encode(jcs(payload)));
  const signingInput = TEXT_ENCODER.encode(`${headerB64}.${payloadB64}`);
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cryptoKey, signingInput);
  const token = `${headerB64}.${payloadB64}.${base64urlEncode(new Uint8Array(signature))}`;

  return {
    format: DECISION_RECEIPT_FORMAT,
    token,
    receipt_id: payload.receipt_id,
    issued_at: isoFromSeconds(issuedAt),
    expires_at: isoFromSeconds(expiresAt),
    request_hash: payload.request_hash,
    action_hash: payload.action_hash,
    verification_tool: "decision_verify"
  };
}

function emptyVerification(reasonCode) {
  return {
    signature_valid: false,
    binding_matches: false,
    expired: false,
    gate_passed: false,
    reason_code: reasonCode,
    receipt: null,
    not_authorization_notice: DECISION_NOT_AUTHORIZATION_NOTICE
  };
}

function decodedReceipt(payload) {
  return {
    receipt_id: payload.receipt_id,
    decision_id: payload.decision_id,
    run_id: payload.run_id,
    policy_version: payload.policy_version,
    decision: payload.decision,
    reason_code: payload.reason_code,
    request_hash: payload.request_hash,
    action_hash: payload.action_hash,
    issued_at: isoFromSeconds(payload.iat),
    expires_at: isoFromSeconds(payload.exp),
    issuer: payload.iss,
    not_authorization: payload.not_authorization
  };
}

function validPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      typeof payload.receipt_id === "string" &&
      payload.receipt_id.length > 0 &&
      typeof payload.decision_id === "string" &&
      payload.decision_id.length > 0 &&
      typeof payload.run_id === "string" &&
      payload.run_id.length > 0 &&
      payload.policy_version === DECISION_POLICY_VERSION &&
      DECISIONS.includes(payload.decision) &&
      typeof payload.reason_code === "string" &&
      payload.reason_code.length > 0 &&
      HASH_PATTERN.test(payload.request_hash) &&
      HASH_PATTERN.test(payload.action_hash) &&
      Number.isInteger(payload.iat) &&
      Number.isInteger(payload.exp) &&
      payload.exp > payload.iat &&
      typeof payload.iss === "string" &&
      new URL(payload.iss).protocol === "https:" &&
      payload.not_authorization === true
  );
}

export async function verifyDecisionReceipt({
  token,
  publicJwk: publicJwkInput,
  expectedRequestHash,
  expectedActionHash,
  expectedIssuer = null,
  nowSeconds = Math.floor(Date.now() / 1000)
}) {
  if (!publicJwkInput) return emptyVerification("signing_key_unavailable");
  if (!HASH_PATTERN.test(expectedRequestHash || "") || !HASH_PATTERN.test(expectedActionHash || "")) {
    return emptyVerification("invalid_receipt_format");
  }

  let headerB64;
  let payloadB64;
  let signatureB64;
  let header;
  let payload;
  try {
    const parts = typeof token === "string" ? token.split(".") : [];
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
      return emptyVerification("invalid_receipt_format");
    }
    [headerB64, payloadB64, signatureB64] = parts;
    header = parseBase64urlJson(headerB64);
    payload = parseBase64urlJson(payloadB64);
    if (
      header.alg !== "ES256" ||
      header.typ !== DECISION_RECEIPT_FORMAT ||
      !validPayload(payload) ||
      header.jku !== jwksUrl(payload.iss)
    ) {
      return emptyVerification("invalid_receipt_format");
    }
  } catch (_error) {
    return emptyVerification("invalid_receipt_format");
  }

  try {
    const publicJwk = publicJwkFromPrivate(readJwk(publicJwkInput));
    if (publicJwk.kid && header.kid !== publicJwk.kid) {
      return emptyVerification("invalid_signature");
    }
    const verifyKey = await crypto.subtle.importKey(
      "jwk",
      publicJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const signatureValid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      verifyKey,
      base64urlDecode(signatureB64),
      TEXT_ENCODER.encode(`${headerB64}.${payloadB64}`)
    );
    if (!signatureValid) return emptyVerification("invalid_signature");
  } catch (_error) {
    return emptyVerification("invalid_signature");
  }

  const bindingMatches =
    payload.request_hash === expectedRequestHash &&
    payload.action_hash === expectedActionHash &&
    (!expectedIssuer || payload.iss === expectedIssuer);
  const expired = Math.trunc(nowSeconds) >= payload.exp;
  let reasonCode = "valid_continue_receipt";
  if (!bindingMatches) reasonCode = "binding_mismatch";
  else if (expired) reasonCode = "receipt_expired";
  else if (payload.decision !== "continue") reasonCode = "decision_not_continue";

  return {
    signature_valid: true,
    binding_matches: bindingMatches,
    expired,
    gate_passed: bindingMatches && !expired && payload.decision === "continue",
    reason_code: reasonCode,
    receipt: decodedReceipt(payload),
    not_authorization_notice: DECISION_NOT_AUTHORIZATION_NOTICE
  };
}
