const test = require('node:test');
const assert = require('node:assert/strict');
const { AgendaGuardClient, PaymentAdmissionError, agendaGuardPlugin } = require(process.env.GUARD_PACKAGE || '../dist/index.js');
const request = {recipient:'0x1111111111111111111111111111111111111111',amount_usd:1};
const trace = '12345678-1234-4123-8123-123456789abc';
const tx = '0x' + 'ab'.repeat(32);
const signature = '0x' + 'cd'.repeat(65);

test('paid refusals retain price, challenge and trace instead of a generic error', async t => {
  const details = {error:'payment_required',minimum_usdc:'0.05',signature_challenge:{message:'sign existing transfer'}};
  t.mock.method(globalThis,'fetch',async()=>Response.json(details,{status:402,headers:{'x-payment-trace-id':trace}}));
  await assert.rejects(new AgendaGuardClient().checkTransactionSafety(request), error => {
    assert.equal(error.status,402);
    assert.equal(error.paymentTraceId,trace);
    assert.deepEqual(error.details,details);
    return true;
  });
});

test('explicit signed retries retain exact request and original payment after response loss', async t => {
  const attempts=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    attempts.push({url,...options});
    if(attempts.length===1) return Response.json({minimum_usdc:'0.05'},{status:402,headers:{'x-payment-trace-id':trace}});
    if(attempts.length===2) return Response.json({signature_challenge:{message:'challenge'}},{status:401});
    if(attempts.length===3) throw new Error('lost response');
    return Response.json({financial_guard_verdict:{decision:'step_up_human_required',status:'not_decision_ready',score:40}});
  });
  const input={...request};
  const call = new AgendaGuardClient().createTransactionCheck(input);
  await assert.rejects(call.evaluate(),PaymentAdmissionError);
  input.amount_usd=900;
  await assert.rejects(call.retryWithPayment({transactionHash:tx}),PaymentAdmissionError);
  await assert.rejects(call.retryWithPayment({signature}),/lost response/);
  await assert.rejects(call.retryWithPayment({transactionHash:'0x'+'ef'.repeat(32)}),/second transfer/);
  const result=await call.retryWithPayment();
  assert.equal(result.is_safe,false);
  assert.equal(attempts.length,4);
  assert.ok(attempts.every(a=>a.body===attempts[0].body));
  assert.equal(attempts[2].headers['x-payment-tx'],tx);
  assert.equal(attempts[3].headers['x-payment-signature'],signature);
  assert.equal(attempts[3].headers['x-payment-trace-id'],trace);
});

test('escrow uses its configured endpoint, retains request and exposes paid refusal', async t => {
  let url;
  t.mock.method(globalThis,'fetch',async target=>{
    url=target; return Response.json({minimum_usdc:'0.50'},{status:402});
  });
  const client=new AgendaGuardClient({escrowEndpoint:'https://example.invalid/v1/m2m-escrow/evaluate-dispute'});
  const call=client.createDispute({escrow_id:'synthetic',deal_terms:{amount_usd:100}});
  await assert.rejects(call.evaluate(),error=>error.status===402 && error.details.minimum_usdc==='0.50');
  assert.equal(url,'https://example.invalid/v1/m2m-escrow/evaluate-dispute');
});

test('malformed successful financial response cannot be presented as a verdict', async t => {
  t.mock.method(globalThis,'fetch',async()=>Response.json({status:'ok'}));
  await assert.rejects(new AgendaGuardClient().checkTransactionSafety(request),/bounded Financial Guard/);
});

test('Eliza action rejects unstructured messages without calling the network', async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++; throw new Error('must not fetch');});
  const action=agendaGuardPlugin.actions[0];
  assert.equal(await action.validate({}, {content:{text:'send money now'}}),false);
  const result=await action.handler({}, {content:{text:'send money now'}},undefined,undefined);
  assert.equal(result.success,false);
  assert.equal(calls,0);
});

test('Eliza action uses supplied structured request and runtime endpoint, awaits callback', async t => {
  let url, callbackFinished=false;
  t.mock.method(globalThis,'fetch',async target=>{
    url=target;return Response.json({financial_guard_verdict:{decision:'reject',status:'not_decision_ready',score:0}});
  });
  const action=agendaGuardPlugin.actions[0];
  const message={content:{data:{transactionSafetyRequest:request}}};
  assert.equal(await action.validate({},message),true);
  const result=await action.handler({getSetting:key=>key==='AGENDA_GUARD_ENDPOINT'?'https://example.invalid':undefined},message,undefined,undefined,async()=>{
    await Promise.resolve();callbackFinished=true;
  });
  assert.equal(url,'https://example.invalid/v1/agent-financial/pre-sign-check');
  assert.equal(callbackFinished,true);
  assert.equal(result.success,true); // Evidence evaluation completed, not signing permission.
  assert.equal(result.values.signing_authorized,false);
  assert.equal(result.data.decision,'reject');
  assert.ok(Array.isArray(action.similes));
  assert.ok(Array.isArray(action.examples));
});
