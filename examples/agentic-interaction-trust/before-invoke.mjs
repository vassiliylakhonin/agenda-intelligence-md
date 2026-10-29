// Explicit trust-triage boundary for Node 20+. No network call until evaluate is invoked.
// A caller-controlled card or evidence reference is never an authentication or grant.
const SURFACES = new Set(['checkout','account','api','mcp_tool','a2a_endpoint','content_or_catalog','auth_flow','support_or_messaging','other']);
const SOURCE_TYPES = new Set(['agent_identity_claim','operator_or_principal_authorization','agent_card_or_manifest','mcp_or_a2a_endpoint_metadata','tool_scope_or_permission_evidence','session_authentication_evidence','action_intent_evidence','transaction_or_target_action_evidence','rate_limit_or_abuse_signal','fraud_or_account_takeover_signal','device_or_infrastructure_evidence','provider_policy_or_allowlist','prior_interaction_history','incident_report_or_threat_intel','human_review_note','user_provided_note','other']);
export const EVIDENCE_TEMPLATES = Object.freeze({
  payment:Object.freeze(['operator_or_principal_authorization','session_authentication_evidence','tool_scope_or_permission_evidence','action_intent_evidence','transaction_or_target_action_evidence']),
  external_mcp:Object.freeze(['agent_identity_claim','agent_card_or_manifest','mcp_or_a2a_endpoint_metadata','session_authentication_evidence','tool_scope_or_permission_evidence']),
  delegated_checkout:Object.freeze(['operator_or_principal_authorization','session_authentication_evidence','action_intent_evidence','transaction_or_target_action_evidence','provider_policy_or_allowlist'])
});
function nonempty(value) {return typeof value==='string' && value.trim().length>0;}
function object(value) {return value && typeof value==='object' && !Array.isArray(value) && Object.getPrototypeOf(value)===Object.prototype;}
function keys(value, allowed) {return Object.keys(value).every(k=>allowed.includes(k));}
function dateValid(value) {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date=new Date(value+'T00:00:00Z');return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===value;
}
function checkEvidence(items) {
  if (!Array.isArray(items) || items.length>100) throw new Error('evidence must be an array of at most 100 source records');
  const seen=new Set();
  for (const item of items) {
    if (!object(item) || !keys(item,['id','source_type','title','date','url','notes']) ||
        !nonempty(item.id) || !SOURCE_TYPES.has(item.source_type) || !nonempty(item.title) || !dateValid(item.date) ||
        (item.url!==undefined && (!nonempty(item.url) || !/^https?:\/\//i.test(item.url))) ||
        (item.notes!==undefined && !nonempty(item.notes)) || seen.has(item.id)) throw new Error('Evidence needs a unique ID, known source type, title and valid date.');
    seen.add(item.id);
  }
}
// Only omission is defaulted. No card, principal, identity, scope or evidence is invented.
export function liteRequest(input) {
  if (!object(input) || !keys(input,['actor_name','action','surface','resource','evidence']) ||
      !nonempty(input.actor_name) || !nonempty(input.action) || !SURFACES.has(input.surface) ||
      (input.resource!==undefined && !nonempty(input.resource))) throw new Error('Provide actor_name, action and a supported surface.');
  const evidence=input.evidence===undefined ? [] : input.evidence;
  checkEvidence(evidence);
  return {actor:{declared_type:'unknown',declared_name:input.actor_name},target_surface:input.surface,
    requested_action:input.action,...(input.resource===undefined?{}:{asset_or_resource:input.resource}),
    decision_stage:'pre_execution',dated_sources:structuredClone(evidence),
    risk_question:'What evidence is needed before a human reviews this interaction?'};
}
// The supplied evaluator must use the trusted serving endpoint and return its actual evaluation.
export function createInteractionGate({evaluate}) {
  if (typeof evaluate!=='function') throw new Error('An explicit evaluator is required.');
  async function beforeInvoke(input, {mode='lite'}={}) {
    let request;
    try {
      if (mode==='lite') request=liteRequest(input);
      else if (mode==='strict' && object(input)) request=structuredClone(input);
      else throw Error('Choose lite or strict mode.');
    } catch {
      return {outcome:'block',authorization_granted:false,error:'invalid_input',
        next_one_thing:'Supply the required actor name, action, supported surface and valid dated evidence records.'};
    }
    try {
      const result=await evaluate(structuredClone(request));
      if (!object(result) || !['insufficient_information','not_decision_ready','require_step_up','escalate_to_human_review','block_until_verified'].includes(result.triage_recommendation) ||
          result.human_review_required!==true || result.authorization_granted!==false ||
          !Array.isArray(result.minimum_sources_before_action) || !Array.isArray(result.evidence_gaps) ||
          result.actor?.declared_name!==request.actor?.declared_name || result.target_surface!==request.target_surface ||
          result.requested_action!==request.requested_action || !object(result.source_record_review) ||
          !Array.isArray(result.source_record_review.issues) || result.source_record_review.source_content_verified!==false ||
          !['block','insufficient','review'].includes(result.next_action)) throw Error('Unusable or mismatched trust result.');
      const outcome=result.triage_recommendation==='block_until_verified' || result.next_action==='block' ? 'block'
        : result.triage_recommendation==='require_step_up' ? 'step_up' : 'human_review';
      return {outcome,authorization_granted:false,request,result};
    } catch(error) {
      return {outcome:'block',authorization_granted:false,error:'trust_evaluation_unavailable',
        next_one_thing:'Stop and inspect input, admission and evaluator availability; do not retry automatically.'};
    }
  }
  // This wrapper deliberately never invokes an operation: the Gate does not issue authority.
  // The host must use its own verified, action-bound authorization and execution boundary.
  async function invoke(input, options={}) {
    const assessment=await beforeInvoke(input,options);
    return {...assessment,executed:false,next_one_thing:assessment.next_one_thing ||
      'Stop here. Have the responsible owner review the evidence and independently authorize the exact action.'};
  }
  return Object.freeze({beforeInvoke,invoke});
}

// Trial helper: explicit single call only. Never retries or pays. Unknown/incomplete admission throws.
export async function evaluateTrustTrial(request, {fetchImpl=fetch,endpoint='https://interaction-trust.agendamcp.dpdns.org/mcp/agent',headers={}}={}) {
  const url=new URL(endpoint);
  if (url.protocol!=='https:' || url.username || url.password || url.hash) throw Error('Use an HTTPS endpoint without URL credentials.');
  const id=globalThis.crypto.randomUUID();
  const response=await fetchImpl(url.href,{method:'POST',redirect:'error',
    headers:{...headers,'content-type':'application/json','MCP-Protocol-Version':'2025-11-25'},
    body:JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{name:'free_trial',arguments:request}})});
  let body;try{body=await response.json();}catch{throw Error('Unreadable response; attempt may have been consumed.');}
  const result=body?.result;
  if (!response.ok || body?.jsonrpc!=='2.0' || body.id!==id || body.error || !result || result.isError ||
      result.structuredContent?.trial?.attempt_consumed!==true || result.structuredContent?.trial?.completion_recorded!==true ||
      result.structuredContent?.trial?.agent_profile!=='agentic_interaction_trust') throw Error('Trust evaluation unavailable or refused.');
  return result.structuredContent.evaluation;
}
