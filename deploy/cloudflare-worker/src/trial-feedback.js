// A user-reviewed email draft, never an automatic send or an analytics event.
export function trialFeedbackMailto(profile, status, email, helpfulness = null) {
  const product = /^[a-z_]{1,64}$/.test(profile || '') ? profile : 'unknown';
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
