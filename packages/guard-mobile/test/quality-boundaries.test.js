import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentFinancialGuardClient, M2MEscrowClient, PaymentAdmissionError, NetworkRequestError} from '../dist/index.js';
const input={recipient:'0x'+'1'.repeat(40),amount_usd:25,intent_prompt:'Synthetic review'};
const dispute={escrow_id:'synthetic',deal_terms:{amount_usd:100},specification:{},delivery_submission:{}};
const trace='12345678-1234-4123-8123-123456789abc';
for(const value of [NaN,Infinity,-1,'25',undefined]) {
  test(`invalid amount ${String(value)} is rejected before network or fallback`,async()=>{
    let calls=0;
    const client=new AgentFinancialGuardClient({fetch:async()=>{calls++;throw Error('network');}});
    await assert.rejects(client.check({...input,amount_usd:value}),/amount_usd/);
    assert.equal(calls,0);
  });
}
for(const Client of [AgentFinancialGuardClient,M2MEscrowClient]) {
  for(const timeoutMs of [0,-1,Infinity,NaN]) test(`${Client.name} rejects invalid timeout ${timeoutMs}`,()=>{
    assert.throws(()=>new Client({timeoutMs}),/timeoutMs/);
  });
  for(const body of ['upstream unavailable','null','[]']) test(`${Client.name} retains non-object HTTP refusal`,async()=>{
    const client=new Client({fetch:async()=>new Response(body,{status:503,headers:{'x-payment-trace-id':trace}})});
    const call=Client===AgentFinancialGuardClient?client.createCheck(input):client.createDispute(dispute);
    await assert.rejects(call.evaluate(),error=>error instanceof PaymentAdmissionError&&error.status===503&&error.paymentTraceId===trace&&typeof error.details==='object'&&error.details!==null);
  });
  test(`${Client.name} preserves payment and retry state after body stream failure`,async()=>{
    let n=0;const attempts=[];
    const client=new Client({fetch:async(_url,options)=>{
      attempts.push(options);n++;
      if(n===1)return new Response(new ReadableStream({start(controller){controller.error(Error('body disconnected'));}}));
      return Response.json({error:'signature_required'},{status:401});
    }});
    const call=Client===AgentFinancialGuardClient?client.createCheck(input):client.createDispute(dispute);
    await assert.rejects(call.retryWithPayment({transactionHash:'0x'+'a'.repeat(64)}),NetworkRequestError);
    await assert.rejects(call.retryWithPayment(),error=>error.status===401);
    assert.equal(attempts[0].body,attempts[1].body);
    assert.equal(attempts[0].headers['x-payment-tx'],attempts[1].headers['x-payment-tx']);
  });
}
test('unverified legacy allow cannot bypass human approval',async()=>{
  let executed=0;
  const client=new AgentFinancialGuardClient({fetch:async()=>Response.json({financial_guard_verdict:{decision:'allow',status:'decision_ready',human_review_required:false,score:0}})});
  await assert.rejects(client.protect(input,()=>++executed),error=>error.name==='TransactionStepUpRequiredError');
  assert.equal(executed,0);
});
for(const ruling of [
  {ruling:'RELEASE_TO_SELLER',status:'not_decision_ready',score:90,payout_breakdown:{total_escrow_usd:100,seller_payout_usd:99,buyer_refund_usd:0,arbiter_fee_usd:1}},
  {ruling:'RELEASE_TO_SELLER',status:'decision_ready',score:90},
  {ruling:'RELEASE_TO_SELLER',status:'decision_ready',score:90,payout_breakdown:{total_escrow_usd:100,seller_payout_usd:199,buyer_refund_usd:0,arbiter_fee_usd:1}},
]) test('incomplete or inconsistent escrow result cannot expose ready payout '+JSON.stringify(ruling),async()=>{
  const client=new M2MEscrowClient({fetch:async()=>Response.json({arbitration_ruling:ruling})});
  const result=await client.evaluateDispute(dispute);
  assert.equal(result.ruling,'ESCALATE_HUMAN');assert.equal(result.status,'not_decision_ready');
  assert.equal(result.payout_breakdown.seller_payout_usd,0);
  assert.equal(result.human_review_required,true);
});
test('ready allocation remains a proposal requiring human review',async()=>{
  const client=new M2MEscrowClient({fetch:async()=>Response.json({arbitration_ruling:{ruling:'RELEASE_TO_SELLER',status:'decision_ready',score:95,payout_breakdown:{total_escrow_usd:100,seller_payout_usd:99,buyer_refund_usd:0,arbiter_fee_usd:1}}})});
  const result=await client.evaluateDispute(dispute);
  assert.equal(result.status,'decision_ready');assert.equal(result.human_review_required,true);assert.equal(result.settlement_authorized,false);
});
test('one extra cent cannot satisfy allocation conservation',async()=>{
  const client=new M2MEscrowClient({fetch:async()=>Response.json({arbitration_ruling:{ruling:'RELEASE_TO_SELLER',status:'decision_ready',score:95,payout_breakdown:{total_escrow_usd:100,seller_payout_usd:99.01,buyer_refund_usd:0,arbiter_fee_usd:1}}})});
  assert.equal((await client.evaluateDispute(dispute)).ruling,'ESCALATE_HUMAN');
});
