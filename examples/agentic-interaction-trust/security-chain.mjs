// Three explicit review stages; none grants authority or executes an operation.
// Connect callbacks to the chosen authenticated services. The application owns
// the intervening human review, state binding and independent authorization.
export function createSecurityChain({interactionGate,reviewOutput,preActionCheck}) {
  if (typeof interactionGate?.beforeInvoke!=='function' || typeof reviewOutput!=='function' || typeof preActionCheck!=='function') {
    throw Error('Configure all three review stages.');
  }
  return Object.freeze({
    async interaction(input, options) {
      try {
        const result=await interactionGate.beforeInvoke(input,options);
        if (!['block','step_up','human_review'].includes(result?.outcome) || result.authorization_granted!==false) throw Error('Invalid trust review');
        return result;
      } catch {return {outcome:'block',authorization_granted:false,error:'trust_review_unavailable'};}
    },
    async output(answer,sources) {
      try {
        const data=await reviewOutput(answer,sources);
        const result=data?.evaluation;
        if (data?.relay_allowed!==false || result?.schema_version!=='answer-citation-review.v1' ||
            !['revise','human_review'].includes(result.route) || !Array.isArray(result.findings) ||
            result.human_review_required!==true || result.authorization_granted!==false) throw Error('Invalid output review');
        return {outcome:result.route,relay_allowed:false,result};
      } catch {return {outcome:'block',relay_allowed:false,error:'output_review_unavailable'};}
    },
    async preAction(request) {
      try {
        if (!request || typeof request!=='object' || typeof request.run_id!=='string' || !request.run_id) throw Error('run_id required');
        const result=await preActionCheck(structuredClone(request));
        if (result?.policy_version!=='pre-action-check.v1' || result.run_id!==request.run_id ||
            !['continue','request_evidence','require_approval','stop'].includes(result.decision) ||
            !Array.isArray(result.blocking_gaps) || typeof result.not_authorization_notice!=='string') throw Error('Invalid action review');
        return {outcome:result.decision,authorization_granted:false,result};
      } catch {return {outcome:'block',authorization_granted:false,error:'pre_action_review_unavailable'};}
    }
  });
}
