// Explicit fail-closed integration adapter. It does not sign, send, retry, pay or verify policy receipts.
export async function beforeSign(request,evaluate){
 if(!request||typeof request!=='object'||Array.isArray(request)||typeof evaluate!=='function')throw Error('A transaction request and caller-supplied evaluator are required.');
 const response=await evaluate(request);
 const verdict=response?.financial_guard_verdict;
 if(response?.profile!=='agent_financial_guard'||response?.authorization_granted!==false||!verdict||verdict.human_review_required!==true||verdict.can_auto_sign!==false||!['REJECT','HUMAN_REVIEW'].includes(verdict.pre_sign_verdict)||!Array.isArray(verdict.blocking_reasons)||verdict.blocking_reasons.some(x=>typeof x!=='string')||typeof verdict.next_one_thing!=='string')throw Error('Unconfirmed review result: do not sign.');
 return {pre_sign_verdict:verdict.pre_sign_verdict,can_auto_sign:false,transaction_binding:'not_verified',blocking_reasons:[...verdict.blocking_reasons],next_one_thing:verdict.next_one_thing};
}

// Use as a before-sign hook: it never invokes a signer and always stops for an independent process.
export function requirePreSignReview(evaluate){
 if(typeof evaluate!=='function')throw Error('A caller-supplied evaluator is required.');
 return async request=>{
  const review=await beforeSign(request,evaluate);
  const error=new Error(review.pre_sign_verdict==='REJECT'?'Local review recommends rejection. Signing was not invoked.':'Independent human review is required. Signing was not invoked.');
  error.name='PreSignReviewRequired';error.review=review;throw error;
 };
}
