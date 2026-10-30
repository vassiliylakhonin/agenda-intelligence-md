// The caller supplies the evaluator. This helper never pays, signs, verifies receipts or moves funds.
export async function reviewDelivery({escrowId,terms,spec,submission},evaluate){
 if(typeof escrowId!=='string'||!escrowId.trim()||!terms||!spec||!submission||typeof evaluate!=='function')throw Error('Supply escrowId, terms, spec, submission and an evaluator.');
 const request={escrow_id:escrowId,deal_terms:terms,specification:spec,delivery_submission:submission};
 const raw=await evaluate(request),response=raw?.metadata?.response||raw,ruling=response?.arbitration_ruling,review=ruling?.delivery_review;
 if(response?.profile!=='m2m_escrow_arbiter'||response?.authorization_granted!==false||ruling?.settlement_authorized!==false||ruling?.human_review_required!==true||!review||review.escrow_action!=='HOLD'||review.proposed_allocation!==null||review.deadline_check!=='unverified'||review.slo_check!=='unverified'||review.independent_attestations?.verification_status!=='not_verified'||!['pass','fail','missing'].includes(review.hash_check)||!['pass','fail','missing','unsupported','unverified'].includes(review.schema_check)||typeof review.next_one_thing!=='string')throw Error('Unconfirmed review result: keep escrow on hold.');
 return {escrow_action:'HOLD',proposed_allocation:null,checks:{hash:review.hash_check,schema:review.schema_check,deadline:review.deadline_check,slo:review.slo_check},attestations:'not_verified',human_review_required:true,authorization_granted:false,next_one_thing:review.next_one_thing};
}
