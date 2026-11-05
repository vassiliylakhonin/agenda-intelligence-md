import { PUBLIC_SCHEMAS } from './public-schemas.js';

export const MEMO_QUALITY_TOOL = 'strategic_risk_memo_quality_gate';
const { $id: _id, $schema: _draft, ...memoSchema } = PUBLIC_SCHEMAS['schemas/v1/agenda-memo.schema.json'];

export const MEMO_QUALITY_EXAMPLE = {
  memo_json: {
    meta: { evidence_mode: 'user_provided', depth: 'standard', timestamp: '2026-01-01T00:00:00Z',
      modules_used: [{ module: 'synthetic-example', role: 'reasoning_method' }] },
    risk_summary: { short: 'A synthetic supplier risk memo.', detailed: 'A reviewer needs traceable support before circulating the memo.' },
    analysis: { facts: ['The supplier provided a continuity plan.'], assessments: [], assumptions: [], unknowns: [] },
    watch_next: [{ indicator: 'Monitor developments.' }],
    audit: { validation_score: 0, provenance: [{ basis: 'fact', claim: 'The supplier provided a continuity plan.' }] }
  }
};

export const CORRIDOR_MEMO_EXAMPLE = {
  memo_json: {
    ...MEMO_QUALITY_EXAMPLE.memo_json,
    risk_summary: {short: 'A synthetic Aktau to Baku shipment memo.', detailed: 'A reviewer needs a dated booking record before forwarding the memo.'},
    analysis: {facts:['The freight forwarder confirmed the booking.'], assessments:[], assumptions:[], unknowns:[]},
    audit: {validation_score:0, provenance:[{basis:'fact', claim:'The freight forwarder confirmed the booking.'}]}
  }
};

export const MEMO_QUALITY_SPEC = {
  name: MEMO_QUALITY_TOOL,
  argKey: 'request',
  legacyWrapper: false,
  summary: 'Check a strategic-risk memo against the Agenda Memo schema and flag missing source references, weak follow-up actions and vague monitoring before human review.',
  inputSchema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['memo_json'], additionalProperties: false, properties: { memo_json: memoSchema }, examples: [MEMO_QUALITY_EXAMPLE] },
  outputSchema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['schema_valid', 'route', 'findings', 'findings_truncated', 'human_review_required',
      'evidence_verified', 'authorization_granted', 'payment_required'],
    properties: {
      schema_valid: { type: 'boolean' }, route: { enum: ['revise', 'human_review'] },
      findings: { type: 'array', items: { type: 'object', required: ['code', 'path', 'message'],
        properties: { code: { type: 'string' }, path: { type: 'string' }, message: { type: 'string' } } } },
      findings_truncated: { type: 'boolean' }, human_review_required: { const: true },
      evidence_verified: { const: false }, authorization_granted: { const: false }, payment_required: { const: false }
    }
  }
};

export const CORRIDOR_MEMO_SPEC = {...MEMO_QUALITY_SPEC,
  inputSchema: {...MEMO_QUALITY_SPEC.inputSchema, examples: [CORRIDOR_MEMO_EXAMPLE]}};

function memoPart(params) {
  const part = params?.message?.parts?.[0];
  if (part?.data) return part.data;
  if (typeof part?.text === 'string' && part.text.trimStart().startsWith('{')) {
    try { return JSON.parse(part.text); } catch { return null; }
  }
  return null;
}

export function isMemoQualityCall(profile, params) {
  return (profile === 'agenda' || profile === 'kazakhstan') &&
    (params?.capability === MEMO_QUALITY_TOOL || memoPart(params)?.tool === MEMO_QUALITY_TOOL);
}

export function memoQualityInput(params) {
  if (!params.message) return params.request;
  const { parts, taskId } = params.message;
  const data = memoPart(params);
  if (parts?.length !== 1 || taskId != null || data?.tool !== MEMO_QUALITY_TOOL) return null;
  const { tool: _tool, ...input } = data;
  return input;
}

const GENERIC_MONITORING = /\b(monitor developments|stay informed|keep watching|continue to monitor)\b/i;
const VERIFY_MARKER = /\[verify\][\s.,;:!?\)\]\}"']*$/;

export function memoQualityResult(input, validation) {
  const schemaValid = validation.body.valid === true;
  const findings = schemaValid ? [] : validation.body.findings?.map(item => ({
    code: `schema_${item.code}`, path: item.instance_path, message: item.message
  })) || [{code: validation.body.code, path: '', message: 'Supply one structured memo in memo_json within the published input limits.'}];
  const add = (code, path, message) => findings.push({ code, path, message });
  if (schemaValid) {
    const memo = input.memo_json;
    const sourceBacked = memo.meta.evidence_mode !== 'reasoning_only';
    const provenance = memo.audit.provenance || [];
    if (sourceBacked && !provenance.length) {
      add('missing_provenance', '/memo_json/audit/provenance', 'Add claim-level provenance for the declared evidence mode.');
    }
    for (const [i, entry] of provenance.entries()) {
      const path = `/memo_json/audit/provenance/${i}`;
      if (sourceBacked && entry.basis === 'fact' && !entry.source?.trim()) {
        add(VERIFY_MARKER.test(entry.claim) ? 'fact_requires_verification' : 'missing_fact_source', path,
          'Supply a source reference for the factual claim or resolve it with the reviewer.');
      } else if (!sourceBacked && entry.source?.trim()) {
        add('source_in_reasoning_only', path, 'Align the declared evidence mode with the supplied provenance.');
      }
    }
    const actions = memo.recommended_actions || [];
    if (!actions.length) add('missing_actions', '/memo_json/recommended_actions', 'Add a concrete follow-up action with a trigger or time horizon.');
    for (const [i, action] of actions.entries()) {
      if (GENERIC_MONITORING.test(action.action) || !(action.trigger?.trim() || action.time_horizon?.trim())) {
        add('weak_action', `/memo_json/recommended_actions/${i}`, 'Specify a concrete action and when to take it.');
      }
    }
    for (const [i, item] of memo.watch_next.entries()) {
      if (GENERIC_MONITORING.test(item.indicator) || !(item.trigger?.trim() || item.source_type?.trim())) {
        add('vague_indicator', `/memo_json/watch_next/${i}`, 'Name an observable indicator and its trigger or source type.');
      }
    }
  }
  return {
    schema_valid: schemaValid, route: findings.length ? 'revise' : 'human_review', findings: findings.slice(0, 64),
    findings_truncated: findings.length > 64 || validation.body.findings_truncated === true,
    human_review_required: true, evidence_verified: false, authorization_granted: false, payment_required: false
  };
}
