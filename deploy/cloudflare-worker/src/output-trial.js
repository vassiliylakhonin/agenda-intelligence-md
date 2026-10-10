import { readBoundedJson } from './request-body.js';
import { paymentTraceId, paymentTraceResponse } from './payment-trace.js';
import { tokenHash } from './payment-ledger.js';
import { trialProfile, trialPath, OUTPUT_TRIAL_PATH } from './trial-profiles.js';
import { recordTrialCompletion } from './trial-receipts.js';

export { OUTPUT_TRIAL_PATH };
export const OUTPUT_TRIAL_LIMIT = 2;
export const OUTPUT_TRIAL_DAILY_LIMIT = 1000;

export function outputTrialEnabled(profile, env = {}) {
  return Boolean(trialProfile(profile)) && (env.WORKER_FREE_TRIAL === '1' ||
    (profile === 'agent_output_verification' && env.OUTPUT_VERIFICATION_TRIAL === '1'));
}

export function outputTrialTerms(profile = 'agent_output_verification') {
  const config = trialProfile(profile);
  return { endpoint: trialPath(profile), agent_profile: profile, tool: config.tool,
    evaluation_kind: config.kind || 'evidence_review', attempts_per_network: OUTPUT_TRIAL_LIMIT,
    daily_service_limit: OUTPUT_TRIAL_DAILY_LIMIT, payment_required: false,
    scope: 'Two attempts per network address per product for this trial campaign; shared networks share the allowance. Daily capacity is shared across all products.',
    paid_endpoint: config.route || '/mcp', paid_transport: config.route ? 'rest' : 'mcp',
    paid_price_usdc: profile === 'm2m_escrow_arbiter' ? 0.5 : 0.05 };
}

// One INSERT serializes both limits. Client-controlled labels, cookies and UA
// never create another allowance. Only Cloudflare's connecting address is used.
export async function reserveOutputTrial(request, env, attempt = crypto.randomUUID(), profile = 'agent_output_verification') {
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip || !env.PAYMENT_LEDGER?.prepare || !env.PAYMENT_LEDGER?.batch) throw new Error('trial_store_unavailable');
  // Preserve the already shipped Output campaign keys; all other profiles have
  // independent allowances in the same table and the same fleet-wide daily cap.
  const namespace = profile === 'agent_output_verification' ? 'output-trial-v1:' : 'worker-trial-v1:' + profile + ':';
  const client = await tokenHash(namespace + (env.CALLER_HASH_SALT || '') + ':' + ip.trim().toLowerCase());
  const now = new Date().toISOString();
  // D1 batch is one transaction: observe the exact pre-reservation limits and
  // perform the unchanged atomic INSERT without another caller interleaving.
  // Network exhaustion takes precedence when both limits are reached: waiting
  // until tomorrow does not restore this product's campaign allowance.
  const [state, inserted] = await env.PAYMENT_LEDGER.batch([
    env.PAYMENT_LEDGER.prepare(`SELECT CASE
      WHEN (SELECT COUNT(*) FROM output_verification_trials WHERE client_hash = ?1) >= ?3
        THEN 'network_allowance_exhausted'
      WHEN (SELECT COUNT(*) FROM output_verification_trials WHERE reserved_day = ?2) >= ?4
        THEN 'daily_capacity_exhausted'
      ELSE NULL END AS limit_reason`).bind(client, now.slice(0, 10), OUTPUT_TRIAL_LIMIT, OUTPUT_TRIAL_DAILY_LIMIT),
    env.PAYMENT_LEDGER.prepare(`
    INSERT INTO output_verification_trials(reservation_id, client_hash, reserved_day, reserved_at)
    SELECT ?1, ?2, ?3, ?4
    WHERE (SELECT COUNT(*) FROM output_verification_trials WHERE client_hash = ?2) < ?5
      AND (SELECT COUNT(*) FROM output_verification_trials WHERE reserved_day = ?3) < ?6
    RETURNING reservation_id
  `).bind(attempt, client, now.slice(0, 10), now,
    OUTPUT_TRIAL_LIMIT, OUTPUT_TRIAL_DAILY_LIMIT)
  ]);
  const limit = state?.results?.[0]?.limit_reason;
  const reserved = inserted?.results?.[0]?.reservation_id === attempt;
  if (state?.success !== true || inserted?.success !== true ||
      ![null, 'network_allowance_exhausted', 'daily_capacity_exhausted'].includes(limit) ||
      reserved !== (limit === null)) throw new Error('trial_store_unavailable');
  return { reserved, limit_reason: limit,
    reset_at: limit === 'daily_capacity_exhausted' ? Date.parse(now.slice(0, 10) + 'T00:00:00Z') + 86400000 : null };
}

export async function handleOutputTrial(request, env, { validate, evaluate, emit, respond, originGroup = () => 'unknown_origin', profile = 'agent_output_verification' }) {
  const terms = outputTrialTerms(profile);
  const attempt = crypto.randomUUID();
  const trace = paymentTraceId(request);
  const log = (stage, reason, status, validation = null, trial_limit_reason = null) => emit({ stage, reason, status, validation, trial_limit_reason,
    attempt_id: attempt, payment_trace_id: trace, minimum_usdc: 0 });
  const reply = (body, status = 200, headers = {}) => paymentTraceResponse(respond(body, status,
    { 'cache-control': 'no-store', ...headers }), trace, attempt);
  log('request_received', 'free_trial', null);
  if (request.headers.has('x-payment-tx') || request.headers.has('x-payment-signature') || request.headers.has('authorization')) {
    log('preview_failed', 'trial_credentials_not_applicable', 400);
    return reply({ code: 'trial_credentials_not_applicable', error: 'Do not send payment or access credentials to the free trial.', trial: terms }, 400);
  }
  let checked;
  try { checked = validate(await readBoundedJson(request)); }
  catch (error) {
    const status = error.status === 413 ? 413 : 400;
    log('payment_rejected', 'invalid_paid_request', status,
      { category: status === 413 ? 'body_too_large' : 'invalid_json', error_count: 1 });
    return reply({ code: 'invalid_trial_request', error: status === 413 ? 'Request body is too large.' : 'Send a valid JSON object.' }, status);
  }
  if (checked.errors.length) {
    log('payment_rejected', 'invalid_paid_request', 400, { category: 'schema_validation_failed', error_count: checked.errors.length });
    return reply({ code: 'invalid_trial_request', errors: checked.errors, trial: terms }, 400);
  }
  log('request_validated', 'free_trial', null);
  let admission;
  try { admission = await reserveOutputTrial(request, env, attempt, profile); }
  catch {
    log('preview_failed', 'trial_unavailable', 503);
    return reply({ code: 'trial_unavailable', error: 'Free trial is temporarily unavailable. No payment was requested.', trial: terms }, 503);
  }
  if (!admission.reserved) {
    const daily = admission.limit_reason === 'daily_capacity_exhausted';
    const retry = Math.max(1, Math.ceil((admission.reset_at - Date.now()) / 1000));
    log('preview_failed', 'trial_exhausted', 429, null, admission.limit_reason);
    return reply({ code: 'trial_exhausted', error: daily
      ? 'Today\'s free-trial capacity is full. Retry after the next UTC midnight. No trial attempt was consumed.'
      : 'This network address has used this product\'s two campaign attempts. Shared networks share the allowance; it does not reset daily. You can choose a separate paid evaluation.',
      trial: { ...terms, limit_reason: admission.limit_reason, attempt_consumed: false,
        ...(daily ? { retry_after_seconds: retry } : {}) } }, 429, daily ? { 'retry-after': String(retry) } : {});
  }
  let result;
  try {
    result = await evaluate(checked.value);
  } catch {
    log('preview_failed', 'trial_evaluation_failed', 503);
    return reply({ code: 'trial_evaluation_failed', error: 'Evaluation could not complete. This reserved trial attempt was consumed; no payment was requested.', trial: terms }, 503);
  }
  try { await recordTrialCompletion(env, attempt, profile, originGroup(checked.value)); }
  catch {
    log('preview_failed', 'trial_recording_unavailable', 503);
    return reply({ code: 'trial_recording_unavailable', error: 'The result could not be recorded reliably. This reserved attempt was consumed; no payment was requested.',
      trial: { ...terms, attempt_consumed: true } }, 503);
  }
  log('preview_completed', 'free_trial', 200);
  return reply({ ...result, trial: { ...terms, attempt_consumed: true, completion_recorded: true,
    note: 'Free evaluation; not a paid execution. Human review is required.' } });
}
