import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentFinancialGuardClient,M2MEscrowClient,PaymentAdmissionError} from '../dist/index.js';
const makeCall=(fetch,input)=>new AgentFinancialGuardClient({fetch,enableLocalFallback:false}).createCheck(input||{recipient:'0x'+'1'.repeat(40),amount_usd:25,intent_prompt:'Synthetic'});
const makeEscrowCall=(fetch,input)=>new M2MEscrowClient({fetch}).createDispute(input);
const input = {recipient:'0x'+'1'.repeat(40), amount_usd:25, intent_prompt:'Synthetic offline evidence review', intent:'Synthetic offline evidence review'};
const endpoint='https://agent-financial-guard.agendamcp.dpdns.org/v1/agent-financial/pre-sign-check';
const escrowEndpoint='https://m2m-escrow-arbiter.agendamcp.dpdns.org/v1/m2m-escrow/evaluate-dispute';
const encode=value=>btoa(JSON.stringify(value));
const accepted={scheme:'exact',network:'eip155:8453',amount:'50000',asset:'0x'+'2'.repeat(40),payTo:'0x'+'3'.repeat(40),maxTimeoutSeconds:120};
const requirements={x402Version:2,resource:{url:endpoint,mimeType:'application/json'},accepts:[accepted]};
const signed=()=>({x402Version:2,accepted:{...accepted},resource:{url:endpoint},payload:{signature:'0x'+'a'.repeat(130),authorization:{from:'0x'+'1'.repeat(40),to:accepted.payTo,value:accepted.amount,validAfter:'0',validBefore:'9999999999',nonce:'0x'+'b'.repeat(64)}}});
const success={financial_guard_verdict:{decision:'step_up_human_required',score:20,human_review_required:true,evidence_gaps:[]}};
const required=()=>new Response('',{status:402,headers:{'PAYMENT-REQUIRED':encode(requirements)}});

test('published Worker diagnostics survive financial and escrow decoding on canonical domains',async()=>{
  const {WORKED_EXAMPLES}=await import('../../../deploy/cloudflare-worker/src/worked-examples.js');
  const financial=WORKED_EXAMPLES.agent_financial_guard.response;
  const seen=[];
  const result=await makeCall(async(url)=>{seen.push(url);return Response.json(financial)}).evaluate();
  assert.equal(seen[0],endpoint);
  const verdict=financial.financial_guard_verdict;
  for(const key of ['check_status','check_scope','next_action','authorization_granted','vizier_status','decision_kind','score_kind'])assert.deepEqual(result[key],verdict[key],key);
  assert.equal(result.check_status.sanctions_aml,'not_assessed');
  assert.equal(result.human_review_required,true);
  const escrow=WORKED_EXAMPLES.m2m_escrow_arbiter.response;
  const ruling=await makeEscrowCall(async(url)=>{seen.push(url);return Response.json(escrow)},(WORKED_EXAMPLES.m2m_escrow_arbiter.request.request || WORKED_EXAMPLES.m2m_escrow_arbiter.request)).evaluate();
  assert.equal(seen[1],escrowEndpoint);
  assert.equal(ruling.authorization_granted,false);
  assert.equal(ruling.next_action,escrow.arbitration_ruling.next_action);
  assert.equal(ruling.human_review_required,true);
  assert.deepEqual(ruling.delivery_review,escrow.arbitration_ruling.delivery_review);
  assert.equal(ruling.delivery_review.escrow_action,'HOLD');
});
test('escrow rejects an unsafe or malformed delivery review projection',async()=>{
  const {WORKED_EXAMPLES}=await import('../../../deploy/cloudflare-worker/src/worked-examples.js');
  const escrow=structuredClone(WORKED_EXAMPLES.m2m_escrow_arbiter.response);
  escrow.arbitration_ruling.delivery_review.escrow_action='RELEASE';
  const input=WORKED_EXAMPLES.m2m_escrow_arbiter.request.request || WORKED_EXAMPLES.m2m_escrow_arbiter.request;
  const ruling=await makeEscrowCall(async()=>Response.json(escrow),input).evaluate();
  assert.equal(ruling.delivery_review,undefined);
  assert.equal(ruling.settlement_authorized,false);
});
test('remote authorization claims and conflicting routing cannot authorize or weaken rejection',async()=>{
  const result=await makeCall(async()=>Response.json({financial_guard_verdict:{decision:'reject',score:100,next_action:'review',authorization_granted:true,vizier_status:'vizier_verified'}})).evaluate();
  assert.equal(result.next_action,'block');assert.equal(result.authorization_granted,false);
  assert.equal(result.vizier_status,'attestation_unavailable');assert.equal(result.human_review_required,true);
});
test('header-only x402 v2 requirement is inspectable and does not trigger payment or retry',async()=>{
  let calls=0;const call=makeCall(async()=>{calls++;return required()});
  await assert.rejects(call.evaluate(),e=>e instanceof PaymentAdmissionError&&e.status===402&&e.paymentRequired.accepts[0].amount==='50000');
  assert.equal(calls,1);assert.equal(call.hasPayment(),false);
});
test('externally signed x402 proof and exact request survive loss; receipt remains unverified metadata',async()=>{
  let n=0;const seen=[];const source={...input};
  const call=makeCall(async(url,options)=>{
    seen.push({url,body:options.body,headers:{...options.headers},redirect:options.redirect});
    if(++n===1)return required();
    if(n===2)throw Error('synthetic lost response');
    return Response.json(success,{headers:{'PAYMENT-RESPONSE':encode({success:true,transaction:'0x'+'c'.repeat(64)})}});
  },source);
  source.amount_usd=999;
  await assert.rejects(call.evaluate(),e=>e.status===402);
  const proof=signed();
  await assert.rejects(call.retryWithPayment({paymentSignature:proof}),/lost response/);
  proof.payload.authorization.nonce='0x'+'d'.repeat(64);
  await call.retryWithPayment();
  assert.deepEqual(seen[1],seen[2]);assert.equal(seen[1].redirect,'error');
  assert.equal(JSON.parse(seen[1].body).transaction.amount_usd,25);
  assert.equal(seen[1].headers['x-payment-tx'],undefined);
  assert.equal(JSON.parse(atob(seen[1].headers['PAYMENT-SIGNATURE'])).payload.authorization.nonce,'0x'+'b'.repeat(64));
  assert.equal(call.getPaymentResponse().success,true);
  const receipt=call.getPaymentResponse();receipt.success=false;assert.equal(call.getPaymentResponse().success,true);
});
for(const mutation of ['price','resource','scheme'])test(`x402 ${mutation} mismatch is rejected before proof transport`,async()=>{
  let n=0;const call=makeCall(async()=>{n++;return required()});await assert.rejects(call.evaluate());
  const proof=signed();
  if(mutation==='price')proof.accepted.amount='1';
  if(mutation==='resource')proof.resource.url='https://unrelated.invalid/pay';
  if(mutation==='scheme')proof.accepted.scheme='other';
  await assert.rejects(call.retryWithPayment({paymentSignature:proof}),/requirements and resource/);assert.equal(n,1);assert.equal(call.hasPayment(),false);
});
test('same proof can be supplied as base64; changed nonce and legacy proof mixing are refused',async()=>{
  let n=0;const call=makeCall(async()=>++n===1?required():Response.json(success));
  await assert.rejects(call.evaluate());const proof=signed();
  await call.retryWithPayment({paymentSignature:encode(proof)});
  proof.payload.authorization.nonce='0x'+'d'.repeat(64);
  await assert.rejects(call.retryWithPayment({paymentSignature:proof}),/original x402/);
  await assert.rejects(call.retryWithPayment({transactionHash:'0x'+'a'.repeat(64)}),/mix/);
  assert.equal(n,2);
});
test('cannot attach x402 proof before inspecting this resource requirements',async()=>{
  let n=0;const call=makeCall(async()=>{n++;return required()});
  await assert.rejects(call.retryWithPayment({paymentSignature:signed()}),/requirements and resource/);assert.equal(n,0);
});
for(const header of ['bad header','W10=',encode({x402Version:1}),encode({...requirements,resource:{url:'https://unrelated.invalid'}})])test('malformed or foreign payment requirement stays a refusal '+header.slice(0,15),async()=>{
  const call=makeCall(async()=>new Response('',{status:402,headers:{'PAYMENT-REQUIRED':header}}));
  await assert.rejects(call.evaluate(),e=>e instanceof PaymentAdmissionError&&e.status===402&&e.details.error==='invalid_x402_header');
  assert.equal(call.hasPayment(),false);
});
test('oversized payment proof fails without retaining or transporting it',async()=>{
  let n=0;const call=makeCall(async()=>{n++;return required()});await assert.rejects(call.evaluate());
  const proof=signed();proof.payload.authorization.extra='x'.repeat(20000);
  await assert.rejects(call.retryWithPayment({paymentSignature:proof}),/too large/);assert.equal(n,1);assert.equal(call.hasPayment(),false);
});
test('x402 and legacy proofs cannot be mixed in one atomic update',async()=>{
  let n=0;const call=makeCall(async()=>{n++;return required()});await assert.rejects(call.evaluate());
  await assert.rejects(call.retryWithPayment({paymentSignature:signed(),transactionHash:'0x'+'a'.repeat(64)}),/mix/);
  assert.equal(n,1);assert.equal(call.hasPayment(),false);
});

test('server block routing stops protect even if an approval callback returns true',async()=>{
  let executed=0;
  const guard=new AgentFinancialGuardClient({fetch:async()=>Response.json({financial_guard_verdict:{decision:'step_up_human_required',next_action:'block',score:90}})});
  await assert.rejects(guard.protect(input,()=>++executed,{onStepUp:()=>true}),e=>e.name==='TransactionBlockedError');
  assert.equal(executed,0);
});
test('local fallback exposes unknown sanctions and non-authorizing routing',async()=>{
  const guard=new AgentFinancialGuardClient({fetch:async()=>{throw Error('Offline')}});
  const result=await guard.check(input);
  assert.equal(result.check_status.sanctions_aml,'not_assessed');
  assert.equal(result.authorization_granted,false);
  assert.equal(result.next_action,'insufficient');
});

test('escrow x402 v2 transport preserves review and non-settlement boundaries',async()=>{
  const {WORKED_EXAMPLES}=await import('../../../deploy/cloudflare-worker/src/worked-examples.js');
  const req={...requirements,resource:{url:escrowEndpoint},accepts:[{...accepted,amount:'500000'}]};
  let n=0;const seen=[];
  const call=makeEscrowCall(async(url,options)=>{
    seen.push({url,body:options.body,headers:options.headers});
    return ++n===1?new Response('',{status:402,headers:{'PAYMENT-REQUIRED':encode(req)}}):Response.json(WORKED_EXAMPLES.m2m_escrow_arbiter.response);
  },(WORKED_EXAMPLES.m2m_escrow_arbiter.request.request || WORKED_EXAMPLES.m2m_escrow_arbiter.request));
  await assert.rejects(call.evaluate(),e=>e.status===402);
  const proof=signed();proof.resource.url=escrowEndpoint;proof.accepted=req.accepts[0];proof.payload.authorization.value='500000';
  const result=await call.retryWithPayment({paymentSignature:proof});
  assert.equal(result.authorization_granted,false);assert.equal(result.settlement_authorized,false);assert.equal(result.human_review_required,true);
  assert.equal(seen[1].url,escrowEndpoint);assert.equal(seen[1].body,seen[0].body);
  assert.deepEqual(JSON.parse(seen[1].body).dispute_claim,(WORKED_EXAMPLES.m2m_escrow_arbiter.request.request || WORKED_EXAMPLES.m2m_escrow_arbiter.request).dispute_claim);
});

test('a failed signature-only update cannot poison later x402 recovery',async()=>{
  let n=0;const call=makeCall(async()=>++n===1?required():Response.json(success));
  await assert.rejects(call.evaluate());
  await assert.rejects(call.retryWithPayment({signature:'0x'+'a'.repeat(130)}),/transaction hash/);
  assert.equal(call.hasPayment(),false);
  await call.retryWithPayment({paymentSignature:signed()});assert.equal(n,2);
});
test('malformed successful PAYMENT-RESPONSE stays an error and retains the same proof',async()=>{
  let n=0;const seen=[];const call=makeCall(async(_url,options)=>{
    seen.push(options.headers['PAYMENT-SIGNATURE']);
    if(++n===1)return required();
    if(n===2)return Response.json(success,{headers:{'PAYMENT-RESPONSE':'malformed header'}});
    return Response.json(success);
  });
  await assert.rejects(call.evaluate());
  await assert.rejects(call.retryWithPayment({paymentSignature:signed()}),/Invalid x402 response header/);
  assert.equal(call.hasPayment(),true);
  await call.retryWithPayment();assert.equal(seen[1],seen[2]);
});
