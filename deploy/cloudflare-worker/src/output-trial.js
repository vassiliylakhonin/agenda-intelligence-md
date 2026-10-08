import { readBoundedJson } from './request-body.js';
import { paymentTraceId, paymentTraceResponse } from './payment-trace.js';
import { tokenHash } from './payment-ledger.js';

export const OUTPUT_TRIAL_PATH = '/v1/agent-output/trial';
export const OUTPUT_TRIAL_LIMIT = 2;
export const OUTPUT_TRIAL_DAILY_LIMIT = 1000;

export function outputTrialEnabled(profile, env = {}) {
  return profile === 'agent_output_verification' && env.OUTPUT_VERIFICATION_TRIAL === '1';
}

export function outputTrialTerms() {
  return { endpoint: OUTPUT_TRIAL_PATH, attempts_per_network: OUTPUT_TRIAL_LIMIT,
    daily_service_limit: OUTPUT_TRIAL_DAILY_LIMIT, payment_required: false,
    scope: 'Two evaluation attempts per network address for this trial campaign; shared networks share the allowance.',
    paid_endpoint: '/v1/agent-output/verification', paid_price_usdc: 0.05 };
}

// One INSERT serializes both limits. Client-controlled labels, cookies and UA
// never create another allowance. Only Cloudflare's connecting address is used.
export async function reserveOutputTrial(request, env) {
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip || !env.PAYMENT_LEDGER?.prepare) throw new Error('trial_store_unavailable');
  const client = await tokenHash('output-trial-v1:' + (env.CALLER_HASH_SALT || '') + ':' + ip.trim().toLowerCase());
  const now = new Date().toISOString();
  const reservation = await env.PAYMENT_LEDGER.prepare(`
    INSERT INTO output_verification_trials(reservation_id, client_hash, reserved_day, reserved_at)
    SELECT ?1, ?2, ?3, ?4
    WHERE (SELECT COUNT(*) FROM output_verification_trials WHERE client_hash = ?2) < ?5
      AND (SELECT COUNT(*) FROM output_verification_trials WHERE reserved_day = ?3) < ?6
    RETURNING reservation_id
  `).bind(crypto.randomUUID(), client, now.slice(0, 10), now,
    OUTPUT_TRIAL_LIMIT, OUTPUT_TRIAL_DAILY_LIMIT).first();
  return Boolean(reservation);
}

export async function handleOutputTrial(request, env, { validate, evaluate, emit, respond }) {
  const attempt = crypto.randomUUID();
  const trace = paymentTraceId(request);
  const log = (stage, reason, status, validation = null) => emit({ stage, reason, status, validation,
    attempt_id: attempt, payment_trace_id: trace, minimum_usdc: 0 });
  const reply = (body, status = 200) => paymentTraceResponse(respond(body, status,
    { 'cache-control': 'no-store' }), trace, attempt);
  log('request_received', 'free_trial', null);
  if (request.headers.has('x-payment-tx') || request.headers.has('x-payment-signature') || request.headers.has('authorization')) {
    log('preview_failed', 'trial_credentials_not_applicable', 400);
    return reply({ code: 'trial_credentials_not_applicable', error: 'Do not send payment or access credentials to the free trial.', trial: outputTrialTerms() }, 400);
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
    return reply({ code: 'invalid_trial_request', errors: checked.errors, trial: outputTrialTerms() }, 400);
  }
  log('request_validated', 'free_trial', null);
  let reserved;
  try { reserved = await reserveOutputTrial(request, env); }
  catch {
    log('preview_failed', 'trial_unavailable', 503);
    return reply({ code: 'trial_unavailable', error: 'Free trial is temporarily unavailable. No payment was requested.', trial: outputTrialTerms() }, 503);
  }
  if (!reserved) {
    log('preview_failed', 'trial_exhausted', 429);
    return reply({ code: 'trial_exhausted', error: 'The network allowance or daily service trial limit has been reached. You can choose a separate paid evaluation.', trial: outputTrialTerms() }, 429);
  }
  try {
    const result = await evaluate(checked.value);
    log('preview_completed', 'free_trial', 200);
    return reply({ ...result, trial: { ...outputTrialTerms(), attempt_consumed: true,
      note: 'Free evaluation; not a paid execution. Human review is required.' } });
  } catch {
    log('preview_failed', 'trial_evaluation_failed', 503);
    return reply({ code: 'trial_evaluation_failed', error: 'Evaluation could not complete. This reserved trial attempt was consumed; no payment was requested.', trial: outputTrialTerms() }, 503);
  }
}
