import {tokenHash} from './payment-ledger.js';
import {seal,unseal} from './paid-execution.js';
import {jcs} from './jws.js';

export const TRIAL_REFUND_NETWORK_CAP = 2;
export const TRIAL_REFUND_DAILY_CAP = 100;
const TTL = 86400000;

// Keys must be caller-generated random values. Never put them in telemetry.
export async function beginTrialRecovery(request,env,client,attempt,input,tool) {
  const raw = request.headers.get('idempotency-key');
  if (raw === null) return null;
  if (!/^[a-zA-Z0-9_-]{32,128}$/u.test(raw)) return {error:'invalid_idempotency_key',status:400};
  const key = raw.toLowerCase(), keyHash = await tokenHash(key);
  const digest = await tokenHash(jcs({tool,input}));
  const now = new Date().toISOString();
  // INSERT OR IGNORE is the exclusive ownership operation, including races.
  const row = await env.PAYMENT_LEDGER.prepare(`INSERT OR IGNORE INTO trial_result_recovery
    (client_hash,key_hash,request_hash,attempt_id,created_at) VALUES (?1,?2,?3,?4,?5) RETURNING attempt_id`)
    .bind(client,keyHash,digest,attempt,now).first();
  if (row?.attempt_id === attempt) return {client,keyHash,key,attempt};
  const existing = await env.PAYMENT_LEDGER.prepare(`SELECT request_hash,attempt_id,created_at,response_ciphertext
    FROM trial_result_recovery WHERE client_hash=?1 AND key_hash=?2`).bind(client,keyHash).first();
  if (!existing) throw new Error('trial_recovery_unavailable');
  if (existing.request_hash !== digest) return {error:'idempotency_conflict',status:409};
  if (Date.now()-Date.parse(existing.created_at) >= TTL) {
    await env.PAYMENT_LEDGER.prepare('UPDATE trial_result_recovery SET response_ciphertext=NULL WHERE client_hash=?1 AND key_hash=?2').bind(client,keyHash).run();
    return {error:'trial_recovery_expired',status:410};
  }
  if (!existing.response_ciphertext) return {error:'trial_in_progress',status:409};
  return {replayed:await unseal(existing.response_ciphertext,key),attempt:existing.attempt_id};
}
export const sealTrialResult = (result,recovery) => seal(result,recovery.key);
export async function abandonTrialRecovery(env,recovery,attempt) {
  if (!recovery?.keyHash) return;
  await env.PAYMENT_LEDGER.prepare(`DELETE FROM trial_result_recovery
    WHERE client_hash=?1 AND key_hash=?2 AND attempt_id=?3 AND response_ciphertext IS NULL`)
    .bind(recovery.client,recovery.keyHash,attempt).run();
}
export async function refundTechnicalTrial(env,client,attempt,recovery) {
  const now = new Date().toISOString();
  const statements = [env.PAYMENT_LEDGER.prepare(`INSERT OR IGNORE INTO trial_technical_refunds
    (attempt_id,client_hash,refunded_day,reserved_day,refunded_at)
    SELECT ?1,?2,?3,(SELECT reserved_day FROM output_verification_trials WHERE reservation_id=?1),?4 WHERE EXISTS (SELECT 1 FROM output_verification_trials WHERE reservation_id=?1 AND client_hash=?2)
    AND NOT EXISTS (SELECT 1 FROM trial_completion_receipts WHERE attempt_id=?1)
    AND (SELECT COUNT(*) FROM trial_technical_refunds WHERE client_hash=?2) < ?5
    AND (SELECT COUNT(*) FROM trial_technical_refunds WHERE refunded_day=?3) < ?6 RETURNING attempt_id`)
    .bind(attempt,client,now.slice(0,10),now,TRIAL_REFUND_NETWORK_CAP,TRIAL_REFUND_DAILY_CAP),
    env.PAYMENT_LEDGER.prepare(`DELETE FROM output_verification_trials WHERE reservation_id=?1
      AND EXISTS (SELECT 1 FROM trial_technical_refunds WHERE attempt_id=?1)
      AND NOT EXISTS (SELECT 1 FROM trial_completion_receipts WHERE attempt_id=?1)`).bind(attempt)];
  if (recovery?.keyHash) statements.push(env.PAYMENT_LEDGER.prepare(`DELETE FROM trial_result_recovery
    WHERE attempt_id=?1 AND response_ciphertext IS NULL
    AND EXISTS (SELECT 1 FROM trial_technical_refunds WHERE attempt_id=?1)`).bind(attempt));
  await env.PAYMENT_LEDGER.batch(statements);
  return Boolean(await env.PAYMENT_LEDGER.prepare('SELECT attempt_id FROM trial_technical_refunds WHERE attempt_id=?1').bind(attempt).first());
}
