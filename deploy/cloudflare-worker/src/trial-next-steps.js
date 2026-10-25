// Browser-only continuation. It never evaluates input, changes quotas or starts payment.
// Keep browser code as data: Wrangler keepNames helpers must not leak into it.
export const TRIAL_NEXT_STEPS_SCRIPT = String.raw`function createTrialNextSteps({document, fetch, headers, readInput, tool, validationUrl, paidPrice}) {
  const element = id => document.getElementById(id);
  let validating = false;
  function showRecovery(reason, resetAt = null) {
    const panel = element('profile-recovery');
    if (panel) panel.hidden = false;
    const message = element('profile-recovery-message');
    if (!message) return;
    let text = reason === 'network_allowance_exhausted'
      ? 'This shared network has used this product’s campaign allowance. Waiting until tomorrow does not restore it.'
      : reason === 'daily_capacity_exhausted'
        ? 'The shared daily trial capacity is full. Free admission can reopen after the next UTC midnight.'
        : 'Free admission is unavailable or could not be confirmed. Checking input format remains a separate step.';
    if (reason === 'daily_capacity_exhausted' && typeof resetAt === 'string' && Number.isFinite(Date.parse(resetAt))) {
      text += ' Reset time: ' + new Date(resetAt).toISOString() + '.';
    }
    message.textContent = text + ' Your edited input and any last completed result stay on this page. ' +
      'Validate the input free, inspect the saved example, or explicitly choose a separate paid review (' + paidPrice +
      ' USDC). Input validation does not restore allowance or verify evidence. No automatic retry or payment.';
  }
  async function validateInput() {
    if (validating) return;
    const status = element('profile-input-status');
    const button = element('profile-validate-input');
    if (!status) return;
    let raw, input;
    try {
      raw = readInput(); input = JSON.parse(raw);
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('object_required');
    } catch {
      status.textContent = 'Use a valid JSON object. Nothing was submitted; your input and last result are unchanged.';
      return;
    }
    validating = true;
    if (button) button.disabled = true;
    status.textContent = 'Checking input format only; no evaluation, payment or trial attempt…';
    try {
      const response = await fetch(validationUrl, {method:'POST', headers:headers(),
        body:JSON.stringify({tool,input})});
      const body = await response.json();
      if (readInput() !== raw) {
        status.textContent = 'Your input changed while validation was running. Validate the current input again; no evaluation was performed.';
        return;
      }
      if (response.status === 401) {
        status.textContent = 'This host requires configured production authentication. No evaluation or trial attempt was made.';
        return;
      }
      if (!response.ok || body.tool !== tool || typeof body.valid !== 'boolean' ||
          body.evaluation_performed !== false || body.attempt_consumed !== false ||
          body.payment_required !== false || body.authorization_granted !== false) throw new Error('unconfirmed_preflight');
      const missing = Array.isArray(body.missing_fields)
        ? body.missing_fields.filter(v=>typeof v==='string').slice(0,8).map(v=>v.slice(0,160)) : [];
      status.textContent = body.valid
        ? 'Input format matches the published schema. Evidence quality and evaluation availability are not checked. No payment or trial attempt was made.'
        : 'Input needs correction.' + (missing.length ? ' Missing fields: ' + missing.join(', ') + '.' : ' Inspect the published input schema.') +
          ' No evaluation, payment or trial attempt was made; your last completed result is unchanged.';
    } catch {
      status.textContent = 'Input validation could not be confirmed. Your input and last result are unchanged; no evaluation or payment was started.';
    } finally {
      validating = false;
      if (button) button.disabled = false;
    }
  }
  function revise() {
    const intake = element('profile-intake');
    const input = intake?.querySelector?.('input:not([type="hidden"]),textarea') || element('profile-request');
    (intake || input)?.scrollIntoView?.({behavior:'smooth',block:'center'});
    input?.focus?.();
  }
  function completed() {
    const panel = element('profile-followthrough');
    if (panel) panel.hidden = false;
  }
  function feedbackControls(disabled) {
    for (const name of ['profile-helpful','profile-blocked']) {
      const button = element(name); if (button) button.disabled = disabled;
    }
  }
  return {showRecovery,validateInput,revise,completed,feedbackControls};
}`;
