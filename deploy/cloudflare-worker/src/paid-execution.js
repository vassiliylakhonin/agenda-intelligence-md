import { paymentLedger, readPayment, claimPayment, tokenHash } from './payment-ledger.js';
import { verifyBaseTransactionReceipt } from './settlement.js';
import { verifyPersonalSignature } from './ethsig.js';
import { jcs } from './jws.js';
import { MAX_JSON_BODY_BYTES } from './request-body.js';

// Weak keys only: no request, proof or response survives its Request object.
const contexts = new WeakMap();
export const paidContext = request => contexts.get(request);
const TTL = 24 * 3600000;
const LEASE = 120000;
const fail = (status, code, extra = {}) => Response.json({ error: code, code, ...extra }, {
  status, headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' }
});

export async function paidRequestHash(request, body) {
  return tokenHash(jcs({ method: request.method, url: request.url, body,
    task_token_hash: await tokenHash(request.headers.get('x-task-token') || ''),
    a2a_version: request.headers.get('a2a-version') || '',
    mcp_protocol_version: request.headers.get('mcp-protocol-version') || '' }));
}
export function paidRequestChallenge(txHash, requestHash) {
  return 'Agenda Intelligence MD paid request v2\ntx_hash: ' + txHash.toLowerCase() +
    '\nrequest_sha256: ' + requestHash;
}

// The signed request proof also protects the cached response at rest. Retain
// this exact proof for retries; a new signature cannot decrypt the old result.
async function responseKey(signature) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature.toLowerCase()));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(value, signature) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv },
    await responseKey(signature), new TextEncoder().encode(JSON.stringify(value))));
  const encode = buffer => btoa(Array.from(buffer, x => String.fromCharCode(x)).join(''));
  return JSON.stringify({ iv: encode(iv), data: encode(bytes) });
}
async function unseal(value, signature) {
  const object = JSON.parse(value);
  const decode = s => Uint8Array.from(atob(s), x => x.charCodeAt(0));
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(object.iv) },
    await responseKey(signature), decode(object.data));
  return JSON.parse(new TextDecoder().decode(bytes));
}
function restored(value, replay) {
  return new Response(value.body, { status: value.status,
    headers: { ...value.headers, 'cache-control': 'no-store', 'x-payment-replayed': replay ? '1' : '0', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'X-Payment-Replayed' } });
}
async function boundedResponse(response) {
  const reader = response.body?.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_JSON_BODY_BYTES) { await reader.cancel(); throw new Error('paid_result_too_large'); }
      chunks.push(value);
    }
  } finally { reader?.releaseLock(); }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  const headers = {};
  for (const name of ['content-type', 'a2a-version', 'x-payment-protocol']) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  return { status: response.status, headers, body: new TextDecoder().decode(buffer) };
}

export async function executePaidRequest(request, body, env, minimum, execute) {
  const tx = (request.headers.get('x-payment-tx') || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(tx)) return fail(400, 'invalid_payment_tx');
  const hash = await paidRequestHash(request, body);
  const challenge = paidRequestChallenge(tx, hash);
  const signature = request.headers.get('x-payment-signature') || '';
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) return fail(401, 'payer_signature_required', {
    challenge_message: challenge, request_hash: hash, signature_header: 'X-Payment-Signature'
  });
  let nonce;
  let db;
  try {
    db = paymentLedger(env);
    let details = await readPayment(env, tx);
    if (details && !['signed_activation', 'signed_call'].includes(details.settled_via)) {
      return fail(409, 'already_claimed', { instruction: 'Contact support for legacy claims; do not pay again.' });
    }
    const proof = details?.settled_via === 'signed_call' ? details :
      await verifyBaseTransactionReceipt(tx, env, { allowCallClaim: true, expectedAmountUsdc: minimum });
    if (!proof.valid && proof.settled_via !== 'signed_call') return fail(proof.code === 'insufficient_payment' ? 402 : 400, proof.code || 'payment_not_verified');
    if (!verifyPersonalSignature(challenge, signature, proof.payer)) return fail(403, 'payer_signature_invalid');
    if (proof.amount_usdc < minimum) return fail(402, 'insufficient_payment', { required_usdc: minimum });
    if (details?.settled_via === 'signed_call' && details.request_hash !== hash) return fail(409, 'payment_request_mismatch');
    const bound = { settled_via: 'signed_call', request_hash: hash, payer: proof.payer,
      amount_usdc: proof.amount_usdc, recipient: proof.recipient, contract: proof.contract,
      tier: details?.tier || 'tier_micro_check' };
    if (!details) {
      await claimPayment(env, tx, bound);
    } else if (details.settled_via === 'signed_activation') {
      await db.prepare('UPDATE payment_claims SET details = ?1 WHERE tx_hash = ?2 AND details = ?3')
        .bind(JSON.stringify(bound), tx, JSON.stringify(details)).run();
    }
    details = await readPayment(env, tx);
    if (details?.settled_via !== 'signed_call' || details.request_hash !== hash) return fail(409, 'payment_request_mismatch');
    await db.prepare("INSERT OR IGNORE INTO paid_executions(tx_hash, request_hash, payer, state, created_ms) VALUES (?1, ?2, ?3, 'ready', ?4)")
      .bind(tx, hash, proof.payer, Date.now()).run();
    let row = await db.prepare('SELECT * FROM paid_executions WHERE tx_hash = ?1').bind(tx).first();
    if (row.state === 'completed') {
      if (row.response_expires_ms <= Date.now()) {
        await db.prepare('UPDATE paid_executions SET response_ciphertext = NULL WHERE tx_hash = ?1 AND response_expires_ms <= ?2').bind(tx, Date.now()).run();
        return fail(410, 'paid_result_expired', { instruction: 'Contact support; do not pay again.' });
      }
      try { return restored(await unseal(row.response_ciphertext, signature), true); }
      catch { return fail(409, 'original_payment_signature_required'); }
    }
    nonce = crypto.randomUUID();
    const started = await db.prepare("UPDATE paid_executions SET state = 'running', lease_nonce = ?1, lease_until_ms = ?2 WHERE tx_hash = ?3 AND (state = 'ready' OR (state = 'running' AND lease_until_ms < ?4))")
      .bind(nonce, Date.now() + LEASE, tx, Date.now()).run();
    if (started.meta.changes !== 1) return fail(409, 'payment_execution_pending', { retry_after_seconds: 5 });
    contexts.set(request, { ...proof, valid: true, tx_hash: tx, request_hash: hash });
    const response = await execute();
    const saved = await boundedResponse(response);
    let parsed = null;
    try { parsed = JSON.parse(saved.body); } catch { /* Non-JSON is never a paid result. */ }
    if (saved.status >= 400 || !parsed || parsed.error || parsed.result?.isError) {
      await db.prepare("UPDATE paid_executions SET state = 'ready', lease_nonce = NULL, lease_until_ms = 0 WHERE tx_hash = ?1 AND lease_nonce = ?2")
        .bind(tx, nonce).run();
      return restored(saved, false);
    }
    const result = await db.prepare("UPDATE paid_executions SET state = 'completed', response_ciphertext = ?1, response_expires_ms = ?2, lease_until_ms = 0 WHERE tx_hash = ?3 AND lease_nonce = ?4 AND state = 'running'")
      .bind(await seal(saved, signature), Date.now() + TTL, tx, nonce).run();
    if (result.meta.changes !== 1) return fail(409, 'payment_execution_pending');
    return restored(saved, false);
  } catch {
    if (db && nonce) {
      try { await db.prepare("UPDATE paid_executions SET state = 'ready', lease_nonce = NULL, lease_until_ms = 0 WHERE tx_hash = ?1 AND lease_nonce = ?2 AND state = 'running'").bind(tx, nonce).run(); }
      catch { /* Lease expires; identical signed retry remains recoverable. */ }
    }
    return fail(503, 'paid_execution_unavailable', { instruction: 'Retry the identical request and signature with the same payment; do not pay again.' });
  } finally { contexts.delete(request); }
}
