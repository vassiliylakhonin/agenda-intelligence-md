import { WORKED_EXAMPLES } from './worked-examples.js';
import { reviewSummary } from './product-workflows.js';

export const CATALOG_DEMO_PROMPT = 'Show a free worked example';
export const CATALOG_STARTERS = Object.freeze([
  {prompt: CATALOG_DEMO_PROMPT, operation: 'worked_example'},
  {prompt: 'Show input requirements', operation: 'catalog_input_requirements'},
  {prompt: 'Show free trial options', operation: 'catalog_trial_options'}
]);

// Explicit read-only setup. Never reinterpret a case, context, capability,
// attachment or task continuation as a request for setup.
export function catalogOperation(body) {
  if (!body || body.jsonrpc !== '2.0' ||
      !['SendMessage', 'message/send', 'tasks/send'].includes(body.method) ||
      Object.keys(body).some(key => !['jsonrpc', 'id', 'method', 'params'].includes(key)) ||
      !['string', 'number'].includes(typeof body.id) ||
      (typeof body.id === 'number' && !Number.isFinite(body.id))) return null;
  const params = body.params;
  if (!params || Object.keys(params).some(key => key !== 'message')) return null;
  const message = params.message;
  if (!message || Object.keys(message).some(key => !['messageId', 'message_id', 'role', 'parts', 'kind'].includes(key)) ||
      !['ROLE_USER', 'user'].includes(message.role) || !Array.isArray(message.parts) || message.parts.length !== 1) return null;
  const part = message.parts[0];
  if (!part || Object.keys(part).some(key => !['kind', 'text'].includes(key)) ||
      (part.kind && part.kind !== 'text') || typeof part.text !== 'string') return null;
  return CATALOG_STARTERS.find(item => item.prompt.toLowerCase() === part.text.trim().toLowerCase())?.operation || null;
}

export function isCatalogDemo(body) {
  return catalogOperation(body) === 'worked_example';
}

export function addCatalogOnboarding(card, profile, origin) {
  if (!WORKED_EXAMPLES[profile] || !card.skills.length) return card;
  const isJsonExample = value => {
    try {JSON.parse(value); return true;}
    catch {return false;}
  };
  // Catalogue consoles send these strings as a single text part. Preserve
  // valid JSON-as-text evaluation examples, but keep ordinary paid intent
  // descriptions out of the clickable starter list.
  const intents = card.skills.flatMap(skill => (skill.examples || [])
    .filter(value => !isJsonExample(value) && !CATALOG_STARTERS.some(item => item.prompt === value))
    .map(text => ({skill_id: skill.id, text})));
  card.skills = card.skills.map(skill => ({...skill, examples: (skill.examples || []).filter(isJsonExample)}));
  card.skills[0] = {
    ...card.skills[0],
    description: card.skills[0].description +
      ` Send "${CATALOG_DEMO_PROMPT}", "Show input requirements" or "Show free trial options" alone for read-only setup without payment or a trial attempt. These commands do not evaluate your input. Other evaluation examples use the published input contract and admission.`,
    inputModes: [...new Set([...(card.skills[0].inputModes || card.defaultInputModes || []), 'text/plain'])],
    examples: [...CATALOG_STARTERS.map(item => item.prompt), ...card.skills[0].examples]
  };
  card.x_agenda_intelligence.catalog_demo = {
    operation: 'worked_example', prompt: CATALOG_DEMO_PROMPT,
    endpoint: `${origin}/message/send`, method: 'SendMessage',
    input: 'One text part containing only the exact prompt; no case data, metadata or continuation.',
    result: 'A saved synthetic input, findings and repair example where available, with a link to review your own input.',
    evaluation_performed: false, attempt_consumed: false, authorization_granted: false,
    authentication: 'The serving deployment authorization still applies.'
  };
  card.x_agenda_intelligence.catalog_onboarding = {
    schema_version: 1, endpoint: `${origin}/message/send`, method: 'SendMessage',
    commands: CATALOG_STARTERS,
    input: 'Send one exact command as a single text part, without case data, metadata or continuation.',
    evaluation_performed: false, attempt_consumed: false, authorization_granted: false,
    evaluation_intents: intents,
    evaluation_intents_note: 'Illustrative task descriptions, not text-only starters. Submit your own authorized input using the published contract and normal admission.'
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
