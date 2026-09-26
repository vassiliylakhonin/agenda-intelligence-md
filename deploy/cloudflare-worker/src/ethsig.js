// Minimal, dependency-free EIP-191 ("personal_sign") verification for the
// Cloudflare Worker runtime. Workers ship no secp256k1/keccak primitives, and
// bundling ethers for one verify call is not an option, so the small amount of
// curve math needed for ECDSA public-key recovery lives here.
//
// Scope: verify that `signature` is `expectedAddress`'s personal_sign over
// `message`. Nothing else. No signing, no transactions, no key storage.
//
// Test vectors are generated with eth-account (Python) in
// test/security-settlement.test.js; keccak256 is additionally pinned against
// the well-known empty-string and "hello world" digests.

// keccak-256 is vendored in ./keccak256.js (from @noble/hashes, MIT): the
// worker has no built-in keccak, and the hand-rolled BigInt version failed
// known-answer tests in this security round.
import { keccak256 } from "./keccak256.js";
export { keccak256 };

// ------------------------------------------------------------- secp256k1

const FIELD_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const ORDER_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

function mod(a, m) {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

function modInv(a, m) {
  let [lm, hm, low, high] = [1n, 0n, mod(a, m), m];
  while (low > 1n) {
    const ratio = high / low;
    [lm, hm] = [hm - lm * ratio, lm];
    [low, high] = [high - low * ratio, low];
  }
  return mod(lm, m);
}

// Affine point addition; null is the point at infinity.
function pointAdd(p, q) {
  if (p === null) return q;
  if (q === null) return p;
  const [x1, y1] = p;
  const [x2, y2] = q;
  if (x1 === x2) {
    if (mod(y1 + y2, FIELD_P) === 0n) return null;
    // Doubling.
    const slope = mod(3n * x1 * x1 * modInv(2n * y1, FIELD_P), FIELD_P);
    const x3 = mod(slope * slope - 2n * x1, FIELD_P);
    return [x3, mod(slope * (x1 - x3) - y1, FIELD_P)];
  }
  const slope = mod((y2 - y1) * modInv(x2 - x1, FIELD_P), FIELD_P);
  const x3 = mod(slope * slope - x1 - x2, FIELD_P);
  return [x3, mod(slope * (x1 - x3) - y1, FIELD_P)];
}

function pointMul(k, p) {
  let result = null;
  let addend = p;
  while (k > 0n) {
    if (k & 1n) result = pointAdd(result, addend);
    addend = pointAdd(addend, addend);
    k >>= 1n;
  }
  return result;
}

function bytesToBigInt(bytes) {
  let out = 0n;
  for (const b of bytes) out = (out << 8n) | BigInt(b);
  return out;
}

export function hexToBytes(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bigIntTo32Bytes(value) {
  const out = new Uint8Array(32);
  let v = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

// Recover the signer's Ethereum address from an EIP-191 personal_sign
// signature. Returns the 0x-prefixed lowercase address, or null when the
// signature is malformed.
export function recoverPersonalSignAddress(message, signatureHex) {
  const sig = hexToBytes(String(signatureHex || ""));
  if (!sig || sig.length !== 65) return null;
  const r = bytesToBigInt(sig.subarray(0, 32));
  const s = bytesToBigInt(sig.subarray(32, 64));
  let v = sig[64];
  if (v >= 27 && v <= 30) v -= 27;
  if (v !== 0 && v !== 1) return null;
  if (r <= 0n || r >= ORDER_N || s <= 0n || s >= ORDER_N) return null;

  const msgBytes = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`Ethereum Signed Message:\n${msgBytes.length}`);
  const digestInput = new Uint8Array(prefix.length + msgBytes.length);
  digestInput.set(prefix);
  digestInput.set(msgBytes, prefix.length);
  const e = bytesToBigInt(keccak256(digestInput));

  // R = (x, y) with x = r (recovery ids 0/1 never need x = r + n on this curve
  // for realistic signatures) and y parity from v.
  const ySq = mod(r * r * r + 7n, FIELD_P);
  let y = modPow(ySq, (FIELD_P + 1n) / 4n, FIELD_P);
  if (modPow(y, 2n, FIELD_P) !== ySq) return null; // no curve point for this r
  if (Number(y & 1n) !== v) y = FIELD_P - y;
  const R = [r, y];

  // Q = r^-1 (s*R - e*G)
  const rInv = modInv(r, ORDER_N);
  const sR = pointMul(s, R);
  const eG = pointMul(mod(e, ORDER_N), [GX, GY]);
  const negEG = eG === null ? null : [eG[0], mod(-eG[1], FIELD_P)];
  const Q = pointMul(rInv, pointAdd(sR, negEG));
  if (Q === null) return null;

  const pubBytes = new Uint8Array(64);
  pubBytes.set(bigIntTo32Bytes(Q[0]), 0);
  pubBytes.set(bigIntTo32Bytes(Q[1]), 32);
  const hash = keccak256(pubBytes);
  const addrBytes = hash.subarray(12);
  return "0x" + Array.from(addrBytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function modPow(base, exp, m) {
  let result = 1n;
  let b = mod(base, m);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = mod(result * b, m);
    b = mod(b * b, m);
    e >>= 1n;
  }
  return result;
}

// True when `signature` is `expectedAddress`'s personal_sign over `message`.
export function verifyPersonalSignature(message, signatureHex, expectedAddress) {
  if (!expectedAddress || typeof expectedAddress !== "string") return false;
  const recovered = recoverPersonalSignAddress(message, signatureHex);
  return recovered !== null && recovered === expectedAddress.toLowerCase();
}
