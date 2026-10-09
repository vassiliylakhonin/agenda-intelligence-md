// A user-reviewed email draft, never an automatic send or an analytics event.
export function trialFeedbackMailto(profile, status, email) {
  const product = /^[a-z_]{1,64}$/.test(profile || '') ? profile : 'unknown';
  const state = status === 200 ? 'Completed' : status === 429 ? 'Allowance reached' :
    status === 400 || status === 413 ? 'Input needs correction' : status === 503 ? 'Temporarily unavailable' :
    status === null ? 'Not submitted' : 'Request failed';
  const subject = 'Trial feedback: ' + product;
  const body = 'Product: ' + product + '\nCheck: ' + state + '\n\n' +
    'What task were you trying to complete? (No sensitive details)\n\n' +
    'What was useful?\n\nWhat was missing or confusing?\n\n' +
    'Did the result change your next step?\n\nWould you use this again for a similar task?\n\n' +
    'Please review this draft before sending. Do not attach confidential inputs, credentials or payment details.';
  return 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}
