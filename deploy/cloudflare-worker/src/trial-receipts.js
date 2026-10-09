import { trialProfile } from './trial-profiles.js';

const GROUPS = ['excluded', 'external_candidate', 'unknown_origin'];

export function trialOriginGroup(event) {
  if (event.likely_probe || ['owner_synthetic', 'self_test', 'benchmark_probe', 'service_probe', 'verification_probe'].includes(event.caller_kind)) return 'excluded';
  return ['external', 'unsigned_external'].includes(event.caller_kind) ? 'external_candidate' : 'unknown_origin';
}

export async function recordTrialCompletion(env, attempt, profile, group) {
  if (!env.PAYMENT_LEDGER?.prepare || !trialProfile(profile) || !GROUPS.includes(group) ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(attempt || '')) throw new Error('trial_receipt_store_unavailable');
  const now = new Date().toISOString();
  const row = await env.PAYMENT_LEDGER.prepare(`
    INSERT INTO trial_completion_receipts(attempt_id, agent_profile, completed_day, completed_at, origin_group)
    SELECT ?1, ?2, ?3, ?4, ?5
    WHERE EXISTS (SELECT 1 FROM output_verification_trials WHERE reservation_id = ?1)
    RETURNING attempt_id
  `).bind(attempt, profile, now.slice(0,10), now, group).first();
  if (!row) throw new Error('trial_receipt_store_unavailable');
}

export async function trialCompletionStats(env, date) {
  const empty = status => ({ contract_version: 1, status, date, total_completed: null, groups: null, rows: [],
    coverage: 'instrumented_completions_only' });
  if (!env.PAYMENT_LEDGER?.prepare) return empty('not_configured');
  try {
    const epoch = await env.PAYMENT_LEDGER.prepare("SELECT complete_from FROM trial_receipt_coverage WHERE id = 'fleet'").first();
    if (!epoch?.complete_from) return empty('rollout_in_progress');
    const fromMs = Date.parse(epoch.complete_from);
    if (!Number.isFinite(fromMs)) return empty('unavailable');
    const day = Date.parse(date+'T00:00:00.000Z');
    const endMs = Math.min(day+86400000, Date.now());
    if (endMs <= fromMs || day >= endMs) return empty('not_instrumented');
    const start = new Date(Math.max(day,fromMs)).toISOString();
    const end = new Date(endMs).toISOString();
    const result = await env.PAYMENT_LEDGER.prepare(`
      SELECT agent_profile, origin_group, COUNT(*) AS completed
      FROM trial_completion_receipts WHERE completed_day = ?1 AND completed_at >= ?2 AND completed_at <= ?3
      GROUP BY agent_profile, origin_group ORDER BY agent_profile, origin_group
    `).bind(date, start, end).all();
    if (result.success === false || !Array.isArray(result.results)) return empty('unavailable');
    const groups = Object.fromEntries(GROUPS.map(group=>[group,0]));
    const rows = result.results;
    for (const row of rows) {
      if (!trialProfile(row.agent_profile) || !GROUPS.includes(row.origin_group) ||
          !Number.isSafeInteger(row.completed) || row.completed < 0) return empty('unavailable');
      groups[row.origin_group] += row.completed;
    }
    return { contract_version: 1, status: start === date+'T00:00:00.000Z' && endMs === day+86400000 ? 'complete' : 'partial_window', date,
      total_completed: Object.values(groups).reduce((a,b)=>a+b,0), groups, rows,
      coverage: 'instrumented_completions_only', window_start: start, window_end: end,
      fleet_complete_from: new Date(fromMs).toISOString() };
  } catch { return empty('unavailable'); }
}
