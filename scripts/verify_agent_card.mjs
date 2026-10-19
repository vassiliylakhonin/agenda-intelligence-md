// Offline verifier for the configured fleet's A2A v1 ES256 cards. No network,
// private key, signing operation, evaluation or payment is used here.
import {createPublicKey, verify} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {jcs} from '../deploy/cloudflare-worker/src/jws.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
class InvalidCard extends Error {}
function requireValue(condition, reason) {
  if (!condition) throw new InvalidCard(reason);
}
function decode(value, maxBytes, reason) {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9_-]+$/u.test(value) && value.length <= maxBytes * 2, reason);
  const bytes = Buffer.from(value, 'base64url');
  requireValue(bytes.length <= maxBytes && bytes.toString('base64url') === value, reason);
  return bytes;
}

export function verifyAgentCard({origin, card, jwks} = {}) {
  try {
    const url = new URL(origin);
    requireValue(url.protocol === 'https:' && url.origin === origin, 'invalid_origin');
    requireValue(record(card) && typeof card.name === 'string' && card.name.length > 0, 'invalid_card');
    requireValue(Array.isArray(card.signatures) && card.signatures.length > 0, 'missing_signature');
    requireValue(card.signatures.length <= 4, 'too_many_signatures');
    requireValue(record(jwks) && Array.isArray(jwks.keys) && jwks.keys.length > 0 && jwks.keys.length <= 16, 'invalid_jwks');
    const keys = new Map();
    for (const jwk of jwks.keys) {
      requireValue(record(jwk) && typeof jwk.kid === 'string' && jwk.kid.length > 0 && jwk.kid.length <= 256, 'invalid_key_id');
      requireValue(!keys.has(jwk.kid), 'ambiguous_key_id');
      requireValue(!['d','p','q','dp','dq','qi','oth','k'].some(field => Object.hasOwn(jwk, field)), 'private_key_in_jwks');
      keys.set(jwk.kid, jwk);
    }
    const unsigned = {...card};
    delete unsigned.signatures;
    const payload = Buffer.from(jcs(unsigned)).toString('base64url');
    const tampered = Buffer.from(jcs({...unsigned, name: unsigned.name + ' [monitor tamper probe]'})).toString('base64url');
    for (const signature of card.signatures) {
      requireValue(record(signature), 'invalid_signature_entry');
      const header = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(decode(signature.protected, 4096, 'invalid_protected_header')));
      requireValue(record(header) && header.alg === 'ES256', 'unsupported_algorithm');
      requireValue(!Object.hasOwn(header, 'crit') && (!Object.hasOwn(header, 'b64') || header.b64 === true), 'unsupported_critical_header');
      requireValue(header.jku === origin + '/.well-known/jwks.json', 'untrusted_key_url');
      const jwk = keys.get(header.kid);
      requireValue(jwk !== undefined, 'unknown_key_id');
      requireValue(jwk.kty === 'EC' && jwk.crv === 'P-256' && (jwk.alg === undefined || jwk.alg === 'ES256') &&
        (jwk.use === undefined || jwk.use === 'sig') && (jwk.key_ops === undefined ||
          (Array.isArray(jwk.key_ops) && jwk.key_ops.length === 1 && jwk.key_ops[0] === 'verify')), 'unsupported_key');
      requireValue(decode(jwk.x, 32, 'invalid_public_key').length === 32 && decode(jwk.y, 32, 'invalid_public_key').length === 32, 'invalid_public_key');
      const key = createPublicKey({key:{kty:jwk.kty, crv:jwk.crv, x:jwk.x, y:jwk.y}, format:'jwk'});
      const proof = decode(signature.signature, 64, 'invalid_signature_encoding');
      requireValue(proof.length === 64, 'invalid_signature_encoding');
      const options = {key, dsaEncoding:'ieee-p1363'};
      requireValue(verify('sha256', Buffer.from(signature.protected + '.' + payload), options, proof), 'invalid_signature');
      requireValue(!verify('sha256', Buffer.from(signature.protected + '.' + tampered), options, proof), 'tamper_check_failed');
    }
    return {passed:true, algorithm:'ES256', verified_signatures:card.signatures.length,
      tampered_card_rejected:true, key_source:'configured_origin_jwks'};
  } catch (error) {
    return {passed:false, reason:error instanceof InvalidCard ? error.message : 'invalid_signature_document'};
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let output;
  try {
    let size = 0;
    const chunks = [];
    for await (const chunk of process.stdin) {
      size += chunk.length;
      requireValue(size <= 2_100_000, 'input_too_large');
      chunks.push(chunk);
    }
    output = verifyAgentCard(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch (error) {
    output = {passed:false, reason:error instanceof InvalidCard ? error.message : 'invalid_signature_document'};
  }
  process.stdout.write(JSON.stringify(output) + '\n');
  process.exitCode = output.passed ? 0 : 1;
}
