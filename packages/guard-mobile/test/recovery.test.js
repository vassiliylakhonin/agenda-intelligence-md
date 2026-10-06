import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentFinancialGuardClient, M2MEscrowClient } from '../dist/index.js';
const input = {recipient:'0x'+'1'.repeat(40),amount_usd:25,intent_prompt:'Synthetic review'};
const trace = 'aabbccdd-1234-4567-89ab-123456789abc';
const verdict = { financial_guard_verdict: {decision:'allow',status:'decision_ready',human_review_required:true,score:20} };

test('402 preserves payment price and trace instead of becoming local success', async () => {
  const guard = new AgentFinancialGuardClient({fetch:async()=>Response.json({required_usdc:.05,x402:{amount_usdc:.05}}, {status:402,headers:{'x-payment-trace-id':trace}})});
  await assert.rejects(guard.check(input), e=>e.name==='PaymentAdmissionError' && e.status===402 && e.paymentTraceId===trace && e.details.required_usdc===.05);
});
test('human review is mandatory even when a legacy remote says allow', async () => {
  const guard = new AgentFinancialGuardClient({fetch:async()=>Response.json(verdict)}); let n=0;
  assert.equal((await guard.check(input)).isSafe,false);
  await assert.rejects(guard.protect(input,()=>++n,{strictMode:false}), e=>e.name==='TransactionStepUpRequiredError');
  assert.equal(n,0);
  await assert.rejects(guard.protect(input,()=>++n,{onStepUp:()=>"yes"}),e=>e.name==='TransactionStepUpRequiredError');
  assert.equal(n,0);
  await guard.protect(input,()=>++n,{onStepUp:()=>true}); assert.equal(n,1);
});
test('retained SDK request recovers original payment after lost response', async () => {
  const seen=[]; let n=0;
  const guard=new AgentFinancialGuardClient({fetch:async(url,options)=>{
    seen.push({url,body:options.body,headers:{...options.headers}});
    if(++n===1)return Response.json({required_usdc:.05},{status:402,headers:{'x-payment-trace-id':trace}});
    if(n===2)return Response.json({challenge_message:'exact original request'},{status:401});
    if(n===3)throw Error('lost response');
    return Response.json(verdict);
  }});
  const source={...input}; const call=guard.createCheck(source); source.amount_usd=900;
  await assert.rejects(call.evaluate(),e=>e.status===402);
  await assert.rejects(call.retryWithPayment({transactionHash:'0x'+'a'.repeat(64)}),e=>e.status===401&&typeof e.details.challenge_message==='string');
  await assert.rejects(call.retryWithPayment({signature:'0x'+'b'.repeat(130)}),/lost response/);
  await assert.rejects(call.retryWithPayment({transactionHash:'0x'+'c'.repeat(64)}),/original payment/);
  await call.retryWithPayment();
  assert.ok(seen.every(r=>r.body===seen[0].body)); assert.deepEqual(seen[2],seen[3]);
  assert.equal(seen[3].headers['x-payment-trace-id'],trace);
});
test('escrow retains payment refusal details; no inferred payout',async()=>{
  const escrow=new M2MEscrowClient({fetch:async()=>Response.json({required_usdc:.5},{status:402,headers:{'x-payment-trace-id':trace}})});
  await assert.rejects(escrow.evaluateDispute({escrow_id:'synthetic',deal_terms:{amount_usd:10},specification:{},delivery_submission:{}}),e=>e.name==='PaymentAdmissionError'&&e.paymentTraceId===trace&&e.details.required_usdc===.5);
});
test('HTTP refusal and malformed successful payload cannot become local approval',async()=>{
  for(const response of [Response.json({error:'refused'},{status:403}),Response.json({})]){
    const guard=new AgentFinancialGuardClient({fetch:async()=>response});
    await assert.rejects(guard.check(input));
  }
});


test('proof-bearing timeout never enters local fallback and offline default requires review',async()=>{
  const guard=new AgentFinancialGuardClient({fetch:async()=>{throw Error('Synthetic network failure');}});
  const result=await guard.check(input);assert.equal(result.isSafe,false);assert.equal(result.human_review_required,true);
  await assert.rejects(guard.check({...input,x402_payment_tx:'0x'+'a'.repeat(64)}),/Synthetic network failure/);
});
