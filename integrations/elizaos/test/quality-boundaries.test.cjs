const test=require('node:test');
const assert=require('node:assert/strict');
const {AgendaGuardClient,PaymentAdmissionError,NetworkRequestError}=require('../dist/index.js');
const request={recipient:'0x'+'1'.repeat(40),amount_usd:25};
for(const body of ['upstream unavailable','null','[]']) test('HTTP refusal survives non-object body '+body,async()=>{
  const client=new AgendaGuardClient({fetch:async()=>new Response(body,{status:503})});
  await assert.rejects(client.checkTransactionSafety(request),error=>error instanceof PaymentAdmissionError&&error.status===503&&error.details!==null);
});
test('body stream failure keeps original paid request for recovery',async()=>{
  const seen=[];
  const client=new AgendaGuardClient({fetch:async(_url,options)=>{
    seen.push(options);
    return new Response(new ReadableStream({start(controller){controller.error(Error('body disconnected'));}}));
  }});
  const call=client.createTransactionCheck(request);
  await assert.rejects(call.retryWithPayment({transactionHash:'0x'+'a'.repeat(64)}),NetworkRequestError);
  await assert.rejects(call.retryWithPayment(),NetworkRequestError);
  assert.equal(seen[0].body,seen[1].body);
  assert.equal(seen[0].headers['x-payment-tx'],seen[1].headers['x-payment-tx']);
});
for(const payout of [{},{total_escrow_usd:100,seller_payout_usd:-1,buyer_refund_usd:100,arbiter_fee_usd:1},{total_escrow_usd:100,seller_payout_usd:199,buyer_refund_usd:0,arbiter_fee_usd:1}]) test('malformed escrow payout is held '+JSON.stringify(payout),async()=>{
  const client=new AgendaGuardClient({fetch:async()=>Response.json({arbitration_ruling:{ruling:'RELEASE_TO_SELLER',status:'decision_ready',score:95,payout_breakdown:payout}})});
  const result=await client.evaluateDispute({deal_terms:{amount_usd:100}});
  assert.equal(result.status,'not_decision_ready');assert.equal(result.ruling,'ESCALATE_HUMAN');
  assert.equal(result.payout.seller_payout_usd,0);
});
test('escrow fallback amount uses retained input snapshot',async()=>{
  const client=new AgendaGuardClient({fetch:async()=>Response.json({arbitration_ruling:{ruling:'ESCALATE_HUMAN'}})});
  const input={deal_terms:{amount_usd:100}};const call=client.createDispute(input);input.deal_terms.amount_usd=999;
  assert.equal((await call.evaluate()).payout.total_escrow_usd,100);
});
test('one extra cent cannot satisfy allocation conservation',async()=>{
  const client=new AgendaGuardClient({fetch:async()=>Response.json({arbitration_ruling:{ruling:'RELEASE_TO_SELLER',status:'decision_ready',score:95,payout_breakdown:{total_escrow_usd:100,seller_payout_usd:99.01,buyer_refund_usd:0,arbiter_fee_usd:1}}})});
  const result=await client.evaluateDispute({deal_terms:{amount_usd:100}});
  assert.equal(result.ruling,'ESCALATE_HUMAN');assert.equal(result.payout.seller_payout_usd,0);
});
test('zero escrow amount cannot acquire another requests allocation',async()=>{
  const client=new AgendaGuardClient({fetch:async()=>Response.json({arbitration_ruling:{ruling:'RELEASE_TO_SELLER',status:'decision_ready',score:95,payout_breakdown:{total_escrow_usd:100,seller_payout_usd:99,buyer_refund_usd:0,arbiter_fee_usd:1}}})});
  assert.equal((await client.evaluateDispute({deal_terms:{amount_usd:0}})).ruling,'ESCALATE_HUMAN');
});
test('financial response preserves its documented scalar and string types', async()=>{
  const client=new AgendaGuardClient({fetch:async()=>Response.json({decision:'reject',score:999,violations:[null,'risk'],evidence_gaps:[false,'missing'],execution_advisory:{unsafe:'shape'}})});
  const result=await client.checkTransactionSafety(request);
  assert.equal(result.score,0);
  assert.deepEqual(result.violations,['risk']);
  assert.deepEqual(result.evidence_gaps,['missing']);
  assert.equal(typeof result.execution_advisory,'string');
});
test('invalid escrow amount is rejected before transport',async()=>{
  let calls=0;
  const client=new AgendaGuardClient({fetch:async()=>{calls++;return Response.json({});}});
  for(const amount of [undefined,-1,NaN,Infinity,'100']) {
    assert.throws(()=>client.createDispute({deal_terms:{amount_usd:amount}}),/amount_usd/);
  }
  assert.equal(calls,0);
});
