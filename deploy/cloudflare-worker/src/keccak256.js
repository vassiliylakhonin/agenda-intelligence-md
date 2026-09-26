// keccak-256 for the Cloudflare Worker runtime, vendored from @noble/hashes
// v1.8.0 (sha3.js + _u64.js internals; MIT license, (c) Paul Miller,
// https://github.com/paulmillr/noble-hashes). Trimmed to the single function
// this worker needs: keccak256(Uint8Array) -> Uint8Array(32).
//
// Vendored instead of hand-rolled: a custom BigInt keccak failed known-answer
// tests during the 2026-09-26 security round, and hash bugs here silently
// break payer-signature verification in settlement.js.
//
// Only the keccak permutation (keccakP) and the 0x01-domain sponge are kept;
// the full @noble/hashes API surface (SHA3/SHAKE/cSHAKE, XOF, incremental
// Hash class) is intentionally not exported.

const _0n = BigInt(0);
const _1n = BigInt(1);
const _2n = BigInt(2);
const _7n = BigInt(7);
const _256n = BigInt(256);
const _0x71n = BigInt(0x71);

const SHA3_PI = [];
const SHA3_ROTL = [];
const _SHA3_IOTA = [];
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((((round + 1) * (round + 2)) / 2) % 64);
  let t = _0n;
  for (let j = 0; j < 7; j++) {
    R = ((R << _1n) ^ ((R >> _7n) * _0x71n)) % _256n;
    if (R & _2n) t ^= _1n << ((_1n << BigInt(j)) - _1n);
  }
  _SHA3_IOTA.push(t);
}
const IOTAS = splitIotas(_SHA3_IOTA);
const SHA3_IOTA_H = IOTAS[0];
const SHA3_IOTA_L = IOTAS[1];

function splitIotas(lst) {
  const Ah = new Uint32Array(lst.length);
  const Al = new Uint32Array(lst.length);
  for (let i = 0; i < lst.length; i++) {
    // little-endian u64 split (noble fromBig with le=true)
    Ah[i] = Number(lst[i] & 0xffffffffn);
    Al[i] = Number((lst[i] >> 32n) & 0xffffffffn);
  }
  return [Ah, Al];
}

// u64-as-two-u32 left rotations (noble _u64.js)
const rotlSH = (h, l, s) => (h << s) | (l >>> (32 - s));
const rotlSL = (h, l, s) => (l << s) | (h >>> (32 - s));
const rotlBH = (h, l, s) => (l << (s - 32)) | (h >>> (64 - s));
const rotlBL = (h, l, s) => (h << (s - 32)) | (l >>> (64 - s));
const rotlH = (h, l, s) => (s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s));
const rotlL = (h, l, s) => (s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s));

const isLE = new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44;
function swap32IfBE(u32arr) {
  if (isLE) return u32arr;
  for (let i = 0; i < u32arr.length; i++) {
    const v = u32arr[i];
    u32arr[i] = ((v << 24) & 0xff000000) | ((v << 8) & 0x00ff0000) | ((v >>> 8) & 0x0000ff00) | ((v >>> 24) & 0x000000ff);
  }
  return u32arr;
}

function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    // Theta
    for (let x = 0; x < 10; x++) B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    // Rho + Pi
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    // Chi
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++) B[x] = s[y + x];
      for (let x = 0; x < 10; x++) s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    // Iota
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
}

const BLOCK_LEN = 136; // keccak-256 rate in bytes

export function keccak256(data) {
  const state = new Uint8Array(200);
  const state32 = new Uint32Array(state.buffer);
  let pos = 0;
  for (let i = 0; i < data.length; i++) {
    state[pos++] ^= data[i];
    if (pos === BLOCK_LEN) {
      swap32IfBE(state32);
      keccakP(state32);
      swap32IfBE(state32);
      pos = 0;
    }
  }
  // pad10*1 with the keccak (not SHA3) domain suffix 0x01
  state[pos] ^= 0x01;
  state[BLOCK_LEN - 1] ^= 0x80;
  swap32IfBE(state32);
  keccakP(state32);
  swap32IfBE(state32);
  return state.slice(0, 32);
}
