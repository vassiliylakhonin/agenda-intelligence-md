import {corridorOwnerActions} from '../../deploy/cloudflare-worker/src/corridor-owner-actions.js';
// Review handoff only. No signing, screening, payment or automatic network call.
// The caller supplies a trusted evaluator and remains responsible for authorization.
export async function beforeSignature(request, evaluate) {
  if (!request || typeof request!=='object' || Array.isArray(request) || request.decision_stage!=='pre_signature' ||
      typeof request.route!=='string' || !request.route.trim() || typeof request.cargo!=='string' || !request.cargo.trim() ||
      !Array.isArray(request.counterparties) || typeof evaluate!=='function') {
    return {outcome:'hold',authorization_granted:false,error:'invalid_input'};
  }
  const snapshot=structuredClone(request);
  try {
    const result=await evaluate(structuredClone(snapshot));
    if (!result || typeof result!=='object' || result.route!==snapshot.route || result.cargo!==snapshot.cargo ||
        JSON.stringify(result.counterparties)!==JSON.stringify(snapshot.counterparties) ||
        result.authorization_granted!==false || result.human_review_required!==true ||
        !Array.isArray(result.minimum_sources_before_go) || !Array.isArray(result.evidence_gaps) ||
        result.source_record_review?.source_content_verified!==false ||
        !['block','insufficient','review'].includes(result.next_action)) throw Error('Unusable or mismatched result');
    const owner_actions=corridorOwnerActions(snapshot,result);
    return {outcome:result.next_action==='block' ? 'hold' : 'human_review',authorization_granted:false,request:snapshot,result,owner_actions,
      next_one_thing:owner_actions[0]?.action || 'Have the responsible reviewer inspect the complete result and verify the evidence.'};
  } catch {return {outcome:'hold',authorization_granted:false,error:'evaluation_unavailable_or_invalid'};}
}
