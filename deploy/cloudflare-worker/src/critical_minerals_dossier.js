// Availability and declared-scope review only: this module never authenticates documents.
import { MINERALS_TAXONOMY } from './critical_minerals_taxonomy.js';
const TIERS = {
  pre_offtake_agreement: 'required_before_offtake', pre_investment_decision: 'required_before_investment',
  pre_export_shipment: 'required_before_shipment', pre_exploration: 'required_before_exploration',
  pre_processing_contract: 'required_before_processing'
};
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}
const text = value => String(value || '').trim();
function reviewMineralSources(request) {
  const assessment = date(request.assessment_date);
  const reviews = [], eligible = [], seen = new Set();
  const rows = ["supplied_sources", "dated_sources"].flatMap(field => (request[field] || []).map((source,i) => [ `${field}[${i}]`, source ]));
  for (const [sourceRef, source] of rows) {
    const sourceType = source.source_type || '';
    const normalized = sourceType === 'csddd_human_rights_and_esg_audit' ? 'responsible_sourcing_due_diligence' : sourceType;
    const issues = [];
    if (/\b(?:illustrative\s+only|synthetic\s+(?:test|example|fixture|only)|placeholder)\b/iu.test([source.title,source.excerpt].join(' '))) issues.push('Illustrative or placeholder material is not documentary evidence.');
    for (const field of ['title', 'issuing_authority']) if (!text(source[field])) issues.push(`Missing ${field}`);
    const issued = date(source.date), expiry = date(source.valid_until);
    if (!issued) issues.push('Missing or invalid issue date (YYYY-MM-DD)');
    if (assessment && issued && issued > assessment) issues.push('Issue date is after assessment_date');
    if (source.valid_until && !expiry) issues.push('Invalid valid_until date');
    if (expiry && issued && expiry < issued) issues.push('Expiry precedes issue date');
    if (assessment && expiry && expiry < assessment) issues.push('Document expired before assessment_date');
    if (!text(source.excerpt)) issues.push('No source excerpt; summary or URL alone is not documentary evidence');
    for (const field of ['project_name', 'commodity', 'origin_jurisdiction']) {
      const value = text(source.scope?.[field]);
      if (!value) issues.push(`Missing scope.${field}`);
      else if (value.toLowerCase() !== text(request[field]).toLowerCase()) issues.push(`Scope mismatch: ${field}`);
    }
    const identities = [text(source.document_id) ? `document_id:${text(source.document_id)}` : "", text(source.url) ? `url:${text(source.url)}` : "",
      'metadata:' + ['title', 'issuing_authority', 'date'].map(k => text(source[k]).toLowerCase()).join('|')]
      .filter(id => id && id !== 'metadata:||');
    if (identities.some(id => seen.has(id))) issues.push('Duplicate document reference; cannot fill another requirement');
    identities.forEach(id => seen.add(id));
    if (!issues.length && !eligible.includes(normalized)) eligible.push(normalized);
    reviews.push({source_ref: sourceRef, source_type: sourceType, status: issues.length ? 'needs_evidence' : 'eligible_for_review', issues});
  }
  const required = MINERALS_TAXONOMY[TIERS[request.decision_stage]] || [];
  const missing = required.filter(item => !eligible.includes(item));
  const questions = [
    'Confirm commodity form/grade, end use, shipment date, customs code and transit jurisdictions before assessing restrictions.',
    'Ask counsel to establish applicable permits and sanctions rules; a commodity or country label does not establish a prohibition.'
  ];
  if (request.target_market === 'eu') questions.push('Determine CSDDD scope, dates and company thresholds; a responsible-sourcing audit is not CSDDD certification.');
  if (request.target_market === 'us') questions.push('Identify the precise US incentive and acquisition date; Section 30D credits ended for vehicles acquired after 2025-09-30. Do not infer FEOC clearance from geography.');
  if (request.commodity === 'uranium') questions.push('Establish natural/enriched material, enrichment origin and destination. US Russian-LEU restrictions and EU ESA contract procedures have distinct scopes; port transit alone establishes neither.');
  if (request.commodity === 'titanium') questions.push('Obtain buyer-specific material grade and qualification records if aerospace use is intended; ore assay is not finished-product qualification.');
  const ownerActions = missing.map(sourceType => ({source_type: sourceType,
    owner: ['regulatory', 'export', 'sanctions'].some(term => sourceType.includes(term)) ? 'compliance counsel' : 'supplier / dossier owner',
    priority: 'before_decision', action: `Supply ${sourceType.replace(/_/gu, ' ')} with issuer, issue date, excerpt and matching project/commodity/origin scope; confirm authenticity and applicability with a human reviewer.`}));
  for (const blocker of request.blockers || []) if (text(blocker)) ownerActions.push({source_type: "caller_blocker", owner: "dossier owner / human reviewer", priority: "before_decision", action: `Resolve caller-declared blocker: ${text(blocker)}`});
  const limitations = [
    'Eligible means dated, scoped excerpt supplied by caller; authenticity, factual support and legal sufficiency are not verified.',
    'Score measures documentary coverage, not investment quality or probability of compliance.',
    'No automatic transaction approval; a complete dossier still requires human sign-off.'
  ];
  if (!assessment) limitations.push('No valid assessment_date supplied: freshness and expiry relative to the decision date were not checked.');
  return {policy_version:'mineral-dossier.v2', assessment_date: assessment, eligible_source_types: eligible,
    source_reviews: reviews, owner_actions: ownerActions, applicability_questions: questions, limitations};
}
export function mineralReadiness(request, dossier) {
  const supplied = dossier.eligible_source_types;
  const required = MINERALS_TAXONOMY[TIERS[request.decision_stage]];
  const missing = required.filter(item => !supplied.includes(item));
  const blockers = (request.blockers || []).map(item => text(item)).filter(Boolean);
  const gaps = [...missing.map(s => `Missing reviewable source: ${s.replace(/_/gu, ' ')}`), ...blockers];
  const score = Math.floor(((required.length - missing.length) * 100) / required.length);
  const complete = !gaps.length;
  const triage = complete ? 'ready_for_human_review' : !supplied.length ? 'insufficient_information' :
    ({pre_offtake_agreement:'escalate_before_offtake',pre_export_shipment:'escalate_before_shipment',pre_investment_decision:'escalate_before_investment'}[request.decision_stage] || 'not_decision_ready');
  return {score, missing, gaps, triage, label: complete ? 'review_ready' : !supplied.length ? 'insufficient_information' : score < 40 ? 'not_decision_ready' : 'partial',
    decision: complete ? 'require_approval' : 'request_evidence',
    reason: complete ? 'dossier_ready_for_human_review' : 'critical_evidence_gaps',
    traceability: supplied.includes('mining_concession_or_license_extract') || supplied.includes('certificate_of_origin') ? 'partial' : 'unverified'};
}

function normalized(value) {
  if (typeof value === 'string') return value.trim().toLowerCase().replace(/\s+/gu, ' ');
  if (Array.isArray(value)) return value.map(normalized).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalized(value[key])]));
  return value;
}
function mineralEvidenceWorkflow(request, dossier, previous) {
  const scopeFields = ['project_name','commodity','origin_jurisdiction'];
  const required = MINERALS_TAXONOMY[TIERS[request.decision_stage]];
  const missing = required.filter(item => !dossier.eligible_source_types.includes(item));
  const blockers = (request.blockers || []).map(item => item.trim()).filter(Boolean);
  const requests = dossier.owner_actions.filter(action => action.source_type !== 'caller_blocker').map(action => {
    const sourceType = action.source_type;
    const reviews = dossier.source_reviews.filter(row => (row.source_type === 'csddd_human_rights_and_esg_audit'
      ? 'responsible_sourcing_due_diligence' : row.source_type) === sourceType);
    const issues = reviews.length ? [...new Set(reviews.flatMap(row => row.issues))] : ['No supplied document for this requirement.'];
    return {
      source_type: sourceType, owner: action.owner, source_refs: reviews.map(row => row.source_ref), issues,
      request_text: `For ${request.project_name} before ${request.decision_stage}, please provide ${sourceType.replace(/_/gu,' ')}. Current gaps: ${issues.join('; ')} ` +
        'Supply the actual title, issuer, issue date and exact authorized excerpt with matching project/commodity/origin scope; include document ID and expiry where available. ' +
        'Do not invent or backdate evidence. A human must verify authenticity and applicability.',
      source_template: {source_type:sourceType,title:'',issuing_authority:'',date:'',excerpt:'',
        scope:Object.fromEntries(scopeFields.map(field => [field, request[field]]))}
    };
  });
  const revision = {
    status:'not_provided', basis:'caller_supplied_previous_submission_rechecked', changed_scope_fields:[], comparison_blockers:[],
    newly_reviewable_source_types:[], no_longer_reviewable_source_types:[], still_missing_source_types:[], removed_caller_blockers:[],
    limitations:[
      'Previous submission is caller-supplied and rechecked, not verified stored history.',
      'Coverage changes are not proof of authenticity, factual support, legal clearance or resolved risk.',
      'Removing a caller blocker is not proof of resolution; a human must review any removal.'
    ]
  };
  if (previous) {
    const [oldRequest, oldReview] = previous;
    for (const field of [...scopeFields,'processing_jurisdiction','target_market','decision_stage','decision_question','counterparties']) {
      const fallback = field === 'target_market' ? 'global' : field === 'counterparties' ? [] : '';
      if (JSON.stringify(normalized(request[field] ?? fallback)) !== JSON.stringify(normalized(oldRequest[field] ?? fallback))) revision.changed_scope_fields.push(field);
    }
    const oldDate = date(oldRequest.assessment_date), newDate = date(request.assessment_date);
    if (revision.changed_scope_fields.length) revision.comparison_blockers.push('decision_scope_changed');
    if (!oldDate || !newDate) revision.comparison_blockers.push('explicit_valid_assessment_dates_required');
    else if (newDate < oldDate) revision.comparison_blockers.push('assessment_date_moved_backwards');
    revision.removed_caller_blockers = (oldRequest.blockers || []).map(item => item.trim()).filter(item => item && !blockers.includes(item));
    revision.status = revision.comparison_blockers.length ? 'not_comparable' : 'compared';
    if (revision.status === 'compared') {
      const before = oldReview.eligible_source_types, now = dossier.eligible_source_types;
      revision.newly_reviewable_source_types = required.filter(item => now.includes(item) && !before.includes(item));
      revision.no_longer_reviewable_source_types = required.filter(item => before.includes(item) && !now.includes(item));
      revision.still_missing_source_types = missing.filter(item => !before.includes(item));
    }
  }
  return {
    workflow_version:'mineral-evidence-loop.v1',
    decision:{stage:request.decision_stage,question:request.decision_question,...Object.fromEntries(scopeFields.map(field => [field, request[field]]))},
    documentary_next_step:missing.length || blockers.length ? 'collect_evidence' : 'prepare_human_review',
    missing_source_types:missing, caller_blockers:blockers, evidence_requests:requests, revision,
    human_review_required:true, authorization_granted:false
  };
}
export function reviewMineralDossier(request) {
  const dossier = reviewMineralSources(request);
  const baseline = request.previous_submission;
  dossier.evidence_workflow = mineralEvidenceWorkflow(request, dossier, baseline ? [baseline, reviewMineralSources(baseline)] : null);
  return dossier;
}

// The optional baseline is a finite request schema, not a prior score or recursive history.
// Validate it before all admission/evaluation paths so malformed baselines consume no trial.
export function mineralBaselineErrors(value, schema, path = 'previous_submission') {
  const errors = [];
  const validType = schema.type === 'object' ? value && typeof value === 'object' && !Array.isArray(value)
    : schema.type === 'array' ? Array.isArray(value) : typeof value === schema.type;
  if (!validType) return [`${path} must be ${schema.type}`];
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} has an unsupported value`);
  if (schema.type === 'string') {
    if (schema.minLength && [...value].length < schema.minLength) errors.push(`${path} is required`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${path} has an invalid format`);
  }
  if (schema.type === 'array') value.forEach((item,i) => errors.push(...mineralBaselineErrors(item, schema.items, `${path}[${i}]`)));
  if (schema.type === 'object') {
    for (const key of schema.required || []) if (!Object.hasOwn(value,key)) errors.push(`${path}.${key} is required`);
    for (const key of Object.keys(value)) {
      if (schema.properties?.[key]) errors.push(...mineralBaselineErrors(value[key],schema.properties[key],`${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${key} is not allowed`);
    }
  }
  return errors;
}
