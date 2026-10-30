// Illustrative arithmetic, not the service's ruling or an interpretation of contract terms.
// All inputs are caller-supplied assumptions. This module never moves funds.
export function simulatePolicyWhatIf({escrow_minor,fee_minor,completion_bps,threshold_bps,penalty_bps}){
 const integer=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
 if(!integer(escrow_minor,100000000000)||!integer(fee_minor,escrow_minor)||!integer(completion_bps,10000)||!integer(threshold_bps,10000)||!integer(penalty_bps,10000))throw Error('Provide bounded integer minor units and basis points for every assumption.');
 const net=escrow_minor-fee_minor,passed=completion_bps>=threshold_bps;
 const prorata=Math.floor(net*completion_bps/10000);
 const penalty=passed?0:Math.floor(net*penalty_bps/10000);
 return {kind:'hypothetical_arithmetic_only',authorization_granted:false,settlement_authorized:false,human_review_required:true,
  assumptions:{escrow_minor,fee_minor,completion_bps,threshold_bps,penalty_bps},
  scenarios:[
   {policy:'all_or_nothing',buyer_minor:passed?0:net,seller_minor:passed?net:0},
   {policy:'pro_rata',buyer_minor:net-prorata,seller_minor:prorata},
   {policy:'slo_penalty',buyer_minor:penalty,seller_minor:net-penalty}
  ],notice:'Illustrative formulas and caller-supplied assumptions; not a contract interpretation, evidence verification, proposed payout or settlement authorization.'};
}
