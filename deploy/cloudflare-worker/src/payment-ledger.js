// D1 is the authoritative settlement and quota ledger; KV is telemetry only.
// Every deployment must bind PAYMENT_LEDGER to the same database.
export function paymentLedger(env) {
  if (!env?.PAYMENT_LEDGER?.prepare) throw new Error("settlement_store_unavailable");
  return env.PAYMENT_LEDGER;
}

export async function tokenHash(token) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function claimPayment(env, txHash, details) {
  const result = await paymentLedger(env).prepare(
    "INSERT OR IGNORE INTO payment_claims(tx_hash, details, claimed_at) VALUES (?1, ?2, ?3)"
  ).bind(txHash.toLowerCase(), JSON.stringify(details), new Date().toISOString()).run();
  if (result.success === false) throw new Error("settlement_store_unavailable");
  return result.meta.changes === 1;
}

export async function readPayment(env, txHash) {
  const row = await paymentLedger(env).prepare(
    "SELECT details FROM payment_claims WHERE tx_hash = ?1"
  ).bind(txHash.toLowerCase()).first();
  return row ? JSON.parse(row.details) : null;
}

export async function consumeProQuota(token, env) {
  // UPDATE plus predicate is one atomic write. Parallel calls cannot overspend.
  const row = await paymentLedger(env).prepare(
    "UPDATE pro_tokens SET used = used + 1 WHERE token_hash = ?1 AND valid_until_ms > ?2 AND used < quota RETURNING details, used, quota"
  ).bind(await tokenHash(token), Date.now()).first();
  return row ? { ...JSON.parse(row.details), used: row.used, quota: row.quota } : null;
}
