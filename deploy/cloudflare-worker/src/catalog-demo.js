import { WORKED_EXAMPLES } from './worked-examples.js';
import { reviewSummary } from './product-workflows.js';

export const CATALOG_DEMO_PROMPT = 'Show a free worked example';

// A read-only view of a public fixture. Never reinterpret a case, context,
// capability, attachment or task continuation as a request for this view.
export function isCatalogDemo(body) {
  if (!body || body.jsonrpc !== '2.0' ||
      !['SendMessage', 'message/send', 'tasks/send'].includes(body.method) ||
      Object.keys(body).some(key => !['jsonrpc', 'id', 'method', 'params'].includes(key)) ||
      !['string', 'number'].includes(typeof body.id) ||
      (typeof body.id === 'number' && !Number.isFinite(body.id))) return false;
  const params = body.params;
  if (!params || Object.keys(params).some(key => key !== 'message')) return false;
  const message = params.message;
  if (!message || Object.keys(message).some(key => !['messageId', 'message_id', 'role', 'parts', 'kind'].includes(key)) ||
      !['ROLE_USER', 'user'].includes(message.role) || !Array.isArray(message.parts) || message.parts.length !== 1) return false;
  const part = message.parts[0];
  return Boolean(part && Object.keys(part).every(key => ['kind', 'text'].includes(key)) &&
    (!part.kind || part.kind === 'text') && typeof part.text === 'string' &&
    part.text.trim().toLowerCase() === CATALOG_DEMO_PROMPT.toLowerCase());
}

export function addCatalogDemo(card, profile, origin) {
  if (!WORKED_EXAMPLES[profile] || !card.skills.length) return card;
  card.skills[0] = {
    ...card.skills[0],
    description: card.skills[0].description +
      ` Send "${CATALOG_DEMO_PROMPT}" alone to inspect a saved synthetic example without payment or a trial attempt; this does not evaluate your input.`,
    examples: [CATALOG_DEMO_PROMPT, ...(card.skills[0].examples || []).filter(value => value !== CATALOG_DEMO_PROMPT)]
  };
  card.x_agenda_intelligence.catalog_demo = {
    operation: 'worked_example', prompt: CATALOG_DEMO_PROMPT,
    endpoint: `${origin}/message/send`, method: 'SendMessage',
    input: 'One text part containing only the exact prompt; no case data, metadata or continuation.',
    result: 'A saved synthetic input, findings and repair example where available, with a link to review your own input.',
    evaluation_performed: false, attempt_consumed: false, authorization_granted: false,
    authentication: 'The serving deployment authorization still applies.'
  };
  return card;
}

export function catalogDemoContent(profile, origin, trial) {
  const example = structuredClone(WORKED_EXAMPLES[profile]);
  if (!example) return null;
  const summary = reviewSummary(example.response);
  const followUp = reviewSummary(example.follow_up?.response);
  const next = {
    review_url: `${origin}/`,
    ...(trial ? { trial_terms_url: `${origin}${trial.endpoint}` } : {}),
    instruction: trial ? 'Open the product page, replace the illustrative input with your own authorized evidence, and deliberately run a free check. Shared allowance limits apply.'
      : 'Open the product page and read its input and access requirements before submitting your own evidence.'
  };
  const markdown = [
    '# Saved worked example',
    'Precomputed synthetic example. Your own material has not been evaluated. No payment or trial attempt was consumed.',
    '## Illustrative input',
    '```json\n' + JSON.stringify(example.request, null, 2) + '\n```',
    ...(summary ? [
      `## Saved findings\nReturned route: **${summary.route}**`,
      ...summary.gaps.slice(0, 6).map(gap => '- ' + gap),
      ...(summary.gaps.length > 6 ? [`The structured example contains all ${summary.gaps.length} reported gaps.`] : []),
      ...(summary.actions.length ? ['## Next steps for this example', ...summary.actions.slice(0, 3).map(action => '- ' + action)] : [])
    ] : ['The structured example contains the saved result and its review boundaries.']),
    ...(followUp ? [`## Saved follow-up\nAfter the illustrated correction or change: **${followUp.route}**. This is another saved fixture, not a new evaluation.`] : []),
    `## Review your own material\n[Open the product page](${next.review_url}). ${next.instruction}`,
    ...(trial ? [`[Read the free-trial input and limits](${next.trial_terms_url}).`] : []),
    'Human review is required. This example does not verify factual truth or authorize an action.'
  ].join('\n\n');
  return { markdown, data: {
    schema_version: 1, kind: 'precomputed_synthetic_fixture', product_profile: profile,
    evaluation_performed: false, attempt_consumed: false, authorization_granted: false,
    human_review_required: true, example, next
  } };
}
