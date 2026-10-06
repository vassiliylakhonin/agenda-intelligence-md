// Operator-only initialization, invoked inside the validated deployment ALLOW.
// Private key material travels only in memory and Wrangler stdin, never argv/files/logs.
import { spawn } from 'node:child_process';
import { jcs } from '../src/jws.js';

export const signingBootstrapEnvironments = Object.freeze(['agent-financial-guard', 'm2m-escrow-arbiter']);
const ORIGINS = Object.freeze({
  'agent-financial-guard': 'https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev',
  'm2m-escrow-arbiter': 'https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev'
});
const WRANGLER_VERSION = '4.122.0';

export function assertBootstrapTarget(env) {
  if (!signingBootstrapEnvironments.includes(env)) throw new Error('Card signing bootstrap target is not allowed.');
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000), redirect: 'error', cache: 'no-store',
    headers: { 'X-Client-Id': 'agenda-owner-card-signing' } });
  if (!response.ok) throw new Error(`Public signing check returned HTTP ${response.status}.`);
  return response.json();
}

export async function assertSignedCard(card, jwks, origin) {
  if (!Array.isArray(card?.signatures) || card.signatures.length !== 1) throw new Error('Expected one card signature.');
  if (!Array.isArray(jwks?.keys) || jwks.keys.length !== 1) throw new Error('Expected one public signing key.');
  const { protected: encodedHeader, signature } = card.signatures[0];
  if (typeof encodedHeader !== 'string' || typeof signature !== 'string') throw new Error('Invalid card signature.');
  const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
  const jwk = jwks.keys[0];
  if (jwk.d !== undefined) throw new Error('JWKS contains a private key.');
  if (header.alg !== 'ES256' || header.jku !== `${origin}/.well-known/jwks.json` ||
      typeof header.kid !== 'string' || !header.kid || header.kid !== jwk.kid ||
      jwk.kty !== 'EC' || jwk.crv !== 'P-256') throw new Error('Invalid card signature header or public key.');
  const unsignedCard = { ...card };
  delete unsignedCard.signatures;
  const payload = Buffer.from(jcs(unsignedCard)).toString('base64url');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key,
    Buffer.from(signature, 'base64url'), Buffer.from(`${encodedHeader}.${payload}`));
  if (!valid) throw new Error('Card signature verification failed.');
}

export async function verifyLiveCardSigning(env, { fetchImpl = fetch } = {}) {
  assertBootstrapTarget(env);
  const origin = ORIGINS[env];
  const [card, jwks] = await Promise.all([
    fetchJson(`${origin}/.well-known/agent-card.json`, fetchImpl),
    fetchJson(`${origin}/.well-known/jwks.json`, fetchImpl)
  ]);
  await assertSignedCard(card, jwks, origin);
  return { target: env, status: 'signature_verified' };
}

// Output is captured rather than inherited, including on failure: Wrangler must
// never echo the secret into Actions logs. Report only the operation and exit code.
export function runSigningWrangler(args, input, { spawnImpl = spawn, environment = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl('npx', ['--yes', `wrangler@${WRANGLER_VERSION}`, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'], shell: false,
      env: { ...environment, WRANGLER_LOG: 'log', WRANGLER_LOG_SANITIZE: 'true', WRANGLER_SEND_METRICS: 'false' }
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 256 * 1024) child.kill(); });
    child.stderr.resume();
    child.stdin.on('error', () => { /* close/error below reports only a safe status */ });
    child.once('error', () => reject(new Error('Wrangler signing configuration could not start.')));
    child.once('close', code => {
      if (code === 0) resolve(output);
      else reject(new Error(`Wrangler signing configuration failed (exit ${code}).`));
    });
    child.stdin.end(input === undefined ? undefined : `${input}\n`);
  });
}

export async function initializeCardSigning(env, { fetchImpl = fetch, runWrangler = runSigningWrangler } = {}) {
  assertBootstrapTarget(env);
  const origin = ORIGINS[env];
  const [card, jwks] = await Promise.all([
    fetchJson(`${origin}/.well-known/agent-card.json`, fetchImpl),
    fetchJson(`${origin}/.well-known/jwks.json`, fetchImpl)
  ]);
  if (card?.signatures !== undefined || !Array.isArray(jwks?.keys) || jwks.keys.length !== 0) {
    await assertSignedCard(card, jwks, origin);
    return { target: env, status: 'already_signed' };
  }
  let secrets;
  try {
    secrets = JSON.parse(await runWrangler(['secret', 'list', '--env', env]));
  } catch {
    throw new Error('Worker secret inventory could not be read; stop before initialization.');
  }
  if (!Array.isArray(secrets) || secrets.some(item => typeof item?.name !== 'string')) {
    throw new Error('Invalid Worker secret inventory.');
  }
  if (secrets.some(item => ['AGENT_CARD_SIGNING_KEY', 'AGENT_CARD_PRIVATE_JWK'].includes(item.name))) {
    throw new Error('Existing signing credential detected; initialization refuses rotation.');
  }
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  Object.assign(jwk, { kid: `${env}-${crypto.randomUUID()}`, alg: 'ES256', use: 'sig' });
  await runWrangler(['secret', 'put', 'AGENT_CARD_SIGNING_KEY', '--env', env], JSON.stringify(jwk));
  return { target: env, status: 'initialized' };
}
