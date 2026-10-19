import { readBoundedJson } from './request-body.js';
import { normalizePaymentTrace } from './payment-trace.js';
import { trialClientKey } from './output-trial.js';

export const TRIAL_FEEDBACK_SCHEMA = {
  type:'object',additionalProperties:false,required:['attempt_id','response'],
  properties:{attempt_id:{type:'string',format:'uuid'},
    response:{type:'string',enum:['useful_next_step','still_blocked']}}
};

// The email draft remains optional and is never sent automatically.
export function trialFeedbackMailto(profile, status, email, helpfulness = null) {
  const product = /^[a-z][a-z0-9_]{0,63}$/.test(profile || '') ? profile : 'unknown';
  const state = status === 200 ? 'Completed' : status === 429 ? 'Allowance reached' :
    status === 400 || status === 413 ? 'Input needs correction' : status === 503 ? 'Temporarily unavailable' :
    status === null ? 'Not submitted' : 'Request failed';
  const subject = 'Trial feedback: ' + product;
  const usefulness = helpfulness === 'useful_next_step' ? 'Useful next step' : helpfulness === 'still_blocked' ? 'Still blocked' : 'Not answered';
  const body = 'Product: ' + product + '\nCheck: ' + state + '\n\n' +
    'Useful next step: ' + usefulness + '\n\n' +
    'What was missing or confusing? (Optional; no sensitive details)\n\n' +
    'Please review this draft before sending. Do not attach confidential inputs, credentials or payment details.';
  return 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}

// Self-reported usefulness, bound to an actual completion and its network/product.
// No request/result payload or free-text fields. Repeated responses are deduped
// by completed attempt in the archive, taking the latest choice in each window.
export async function handleTrialFeedback(request, env, profile, {log, respond}) {
  if (request.method !== 'POST') return respond({error:'Use POST.'},405,{allow:'POST'});
  if (request.headers.get('origin') !== new URL(request.url).origin) return respond({error:'Same-origin feedback only.'},403);
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return respond({error:'Use application/json.'},400);
  let body;
  try {body=await readBoundedJson(request,512);}
  catch(error) {return respond({error:'Send a bounded feedback object.'},error.status===413?413:400);}
  return recordTrialFeedback(request,env,profile,body,{log,respond});
}

// Native MCP/A2A callers share this completion/network check, not the browser
// route's Origin requirement. The protocol adapters retain production auth.
export async function recordTrialFeedback(request, env, profile, body, {log,respond}) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 2 ||
      !normalizePaymentTrace(body.attempt_id) || !['useful_next_step','still_blocked'].includes(body.response)) {
    return respond({error:'Send only attempt_id and response: useful_next_step or still_blocked.'},400);
  }
  let receipt;
  try {
    const network=await trialClientKey(request,env,profile);
    receipt=await env.PAYMENT_LEDGER.prepare(`SELECT c.origin_group
      FROM trial_completion_receipts c JOIN output_verification_trials r ON r.reservation_id=c.attempt_id
      WHERE c.attempt_id=?1 AND c.agent_profile=?2 AND r.client_hash=?3 AND c.completed_at>=?4`)
      .bind(normalizePaymentTrace(body.attempt_id),profile,network,new Date(Date.now()-7*86400000).toISOString()).first();
  } catch {return respond({error:'Feedback is temporarily unavailable.'},503);}
  if (!receipt) return respond({error:'A recent completed check for this network and product is required.'},404);
  await log({attempt_id:normalizePaymentTrace(body.attempt_id),response:body.response,origin_group:receipt.origin_group});
  return new Response(null,{status:204,headers:{'cache-control':'no-store'}});
}
