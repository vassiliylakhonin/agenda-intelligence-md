// JWS (RFC 7515) detached signature helpers for A2A agent cards.
//
// Per the Agenstry conformance criterion `jws_signature`, agent cards may
// carry an ES256 detached JWS that the verifier reconstructs by stripping the
// `signature` field, JCS-canonicalising (RFC 8785) the remaining card, and
// verifying against the public JWKS hosted at `/.well-known/jwks.json`.
//
// This module provides:
//   - `jcs(value)`             — RFC 8785 JSON canonicalization
//   - `signCardDetached(card, privateJwkString, kid)` — returns compact
//                                detached JWS `<header>..<signature>` for
//                                embedding in `card.signature`; the protected
//                                header carries `jku` for the card host's JWKS
//   - `publicJwkFromPrivate(privateJwk)` — strips `d` and returns the public
//                                portion ready for `/.well-known/jwks.json`
//
// The signing pipeline uses Cloudflare Worker's built-in WebCrypto
// (ECDSA P-256 + SHA-256). No external dependencies.
// `jku` semantics and TLS requirements: RFC 7515 section 4.1.2.
// https://www.rfc-editor.org/rfc/rfc7515#section-4.1.2

// ---------------------------------------------------------------------------
// JCS — RFC 8785 JSON Canonicalization Scheme
// ---------------------------------------------------------------------------

/**
 * Return the RFC 8785 JCS canonical string serialization of a JSON value.
 *
 * - Strings: JSON.stringify (RFC 8259 string escaping)
 * - Numbers: JSON.stringify (close to ES2017 ToString; finite numbers only)
 * - Booleans / null: literal
 * - Arrays: "[" + items.join(",") + "]"  (each item canonicalised)
 * - Objects: "{" + entries sorted by key (UTF-16 code-point order)
 *            .map(k => JSON.stringify(k) + ":" + jcs(v)).join(",") + "}"
 * - `undefined` values inside objects are skipped (matches JSON.stringify)
 *
 * Throws on non-finite numbers and on functions / symbols.
 */
export function jcs(value) {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("JCS forbids non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(jcs).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort(); // JS default string sort is UTF-16 code-point order for BMP keys
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + jcs(value[k])).join(",") + "}";
  }
  throw new TypeError(`JCS cannot serialize ${typeof value}`);
}

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------

export function base64urlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// JWS signing
// ---------------------------------------------------------------------------

const TEXT_ENCODER = new TextEncoder();

function readPrivateJwk(input) {
  if (typeof input === "string") return JSON.parse(input);
  return input;
}

export function jwksUrlFromCard(card) {
  const interfaceUrl = card?.supportedInterfaces?.find(
    (entry) => typeof entry?.url === "string" && entry.url.length > 0
  )?.url;
  if (!interfaceUrl) {
    throw new Error("jwksUrlFromCard: card must declare a supported interface URL");
  }
  const url = new URL(interfaceUrl);
  if (url.protocol !== "https:") {
    throw new Error("jwksUrlFromCard: supported interface URL must use HTTPS");
  }
  return new URL("/.well-known/jwks.json", url).toString();
}

/**
 * Sign an agent card with a detached JWS (RFC 7515 §A.5, RFC 7797).
 *
 * The signature input is `base64url(header) + "." + payload` where payload is
 * the raw JCS canonical bytes of the card with `signature` stripped (since the
 * signature is what we're producing). The output is compact JWS with empty
 * payload field: `<headerB64>..<signatureB64>`.
 *
 * Verifier:
 *   1. Read card.signature → split on "."
 *   2. base64url-decode header, assert alg=ES256
 *   3. Strip signature from card, JCS-canonicalise the rest
 *   4. Reconstruct signing input = base64url(header) + "." + payloadBytes
 *   5. Verify ECDSA over signingInput against public JWKS key matching `kid`
 */
export async function signCardDetached(card, privateJwkInput, kid = null) {
  const privateJwk = readPrivateJwk(privateJwkInput);
  if (privateJwk.kty !== "EC" || privateJwk.crv !== "P-256") {
    throw new Error("signCardDetached: private JWK must be EC P-256");
  }
  const effectiveKid = kid || privateJwk.kid || null;

  const cardWithoutSignature = { ...card };
  delete cardWithoutSignature.signature;

  const payloadBytes = TEXT_ENCODER.encode(jcs(cardWithoutSignature));

  const header = {
    alg: "ES256",
    b64: false,
    crit: ["b64"],
    jku: jwksUrlFromCard(card)
  };
  if (effectiveKid) header.kid = effectiveKid;
  const headerB64 = base64urlEncode(TEXT_ENCODER.encode(JSON.stringify(header)));

  const dotBytes = TEXT_ENCODER.encode(".");
  const headerBytes = TEXT_ENCODER.encode(headerB64);
  const signingInput = new Uint8Array(headerBytes.length + dotBytes.length + payloadBytes.length);
  signingInput.set(headerBytes, 0);
  signingInput.set(dotBytes, headerBytes.length);
  signingInput.set(payloadBytes, headerBytes.length + dotBytes.length);

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    signingInput
  );
  const signatureB64 = base64urlEncode(new Uint8Array(signatureBuffer));

  return `${headerB64}..${signatureB64}`;
}

/**
 * Strip the private `d` parameter from a JWK and return the public portion.
 * Preserves kty/crv/x/y/kid/alg/use so the public key is JWKS-ready.
 */
export function publicJwkFromPrivate(privateJwkInput) {
  const privateJwk = readPrivateJwk(privateJwkInput);
  // Strip private parameters (`d`) and any sign-only usage hints (`key_ops`,
  // `ext`) so the public JWK can be imported by verifiers without
  // operation/usage conflicts.
  // eslint-disable-next-line no-unused-vars
  const { d, key_ops, ext, ...publicJwk } = privateJwk;
  publicJwk.alg = publicJwk.alg || "ES256";
  publicJwk.use = publicJwk.use || "sig";
  return publicJwk;
}

/**
 * Build a JWKS document from a private JWK (returns only the public portion).
 * Returns `{ keys: [] }` if the input is missing/malformed (caller's choice
 * whether to surface this as an empty JWKS or a 503).
 */
export function buildJwks(privateJwkInput) {
  if (!privateJwkInput) return { keys: [] };
  try {
    return { keys: [publicJwkFromPrivate(privateJwkInput)] };
  } catch (_error) {
    return { keys: [] };
  }
}

/**
 * Convenience: produce both the signed card and the JWKS in one call.
 * Used by the /.well-known/agent-card.json HTTP handler. Returns the original
 * card unchanged (no `signature` field) when no signing key is configured.
 */
export async function maybeSignCard(card, env = {}) {
  const privateJwkString = env.AGENT_CARD_SIGNING_KEY || env.AGENT_CARD_PRIVATE_JWK;
  if (!privateJwkString) return card;
  const kid = env.AGENT_CARD_SIGNING_KID || null;
  try {
    const signature = await signCardDetached(card, privateJwkString, kid);
    return { ...card, signature };
  } catch (_error) {
    // Signing failure must not break the card response. Return unsigned card.
    return card;
  }
}
