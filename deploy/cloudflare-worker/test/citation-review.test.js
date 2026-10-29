import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { memoryD1 } from './helpers/d1.js';
import { createTelemetry } from '../src/telemetry.js';

const bundle = await build({entryPoints:[new URL('../src/index.js',import.meta.url).pathname],
  bundle:true,keepNames:true,platform:'neutral',format:'esm',write:false});
const {handleRequest}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const origin='https://example.test';
const envFor=()=>({AGENT_PROFILE:'agent_output_verification',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',
  VIZIER_DISABLED:'1',OPENSANCTIONS_DISABLED:'1',PAYMENT_LEDGER:memoryD1()});

async function browser(env=envFor()) {
  const html=await(await handleRequest(new Request(origin+'/?owner_test=1',{headers:{accept:'text/html'}}),env)).text();
  const elements=Object.fromEntries(['citation-claim','citation-source','citation-quote','citation-support','citation-status','citation-run',
    'raw-answer','raw-source','raw-status','raw-result','raw-run','raw-numeric','citation-demo-before','citation-demo-after',
    'profile-run','profile-paid','profile-status','profile-result','profile-summary','profile-progress','profile-response','profile-request',
    'profile-feedback','profile-feedback-status','profile-helpful','profile-blocked','profile-feedback-panel','profile-intake','profile-recovery']
    .map(id=>[id,{value:'',textContent:'',innerHTML:'',hidden:true,disabled:false}]));
  const requests=[],responses=[];
  const context={URL,crypto:globalThis.crypto,window:{crypto:globalThis.crypto,location:{origin,href:origin+'/?owner_test=1'}},
    document:{getElementById:id=>elements[id],createElement:()=>({set textContent(value){
      this.innerHTML=String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}})},
    fetch:async(url,init)=>{
      requests.push({url,init});
      const response=await handleRequest(new Request(url.startsWith('/')?origin+url:url,{...init,
        headers:{...init.headers,origin,'cf-connecting-ip':'192.0.2.10'}}),env);
      if(response.status!==204) responses.push(await response.clone().json());
      return response;
    }};
  for(const [,script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInNewContext(script,context);
  return {html,elements,requests,responses,context,env};
}
const quiet=async action=>{const old=console.log;console.log=()=>{};try{return await action();}finally{console.log=old;}};
const run=ui=>ui.context.runCitationReview({preventDefault(){}});

test('web raw answer, synthetic demo and correction use the real trial without fabricating sources',async()=>quiet(async()=>{
  const ui=await browser();
  assert.match(ui.html,/Before: 2 citation\/quote issues/);
  assert.match(ui.html,/After: 0 citation\/quote issues/);
  ui.context.showCitationDemo('before');assert.equal(ui.elements['citation-demo-before'].hidden,false);
  ui.context.showCitationDemo('after');assert.equal(ui.elements['citation-demo-before'].hidden,true);
  assert.equal(ui.requests.length,0);
  const submit=()=>ui.context.runRawReview({preventDefault(){}});
  ui.elements['raw-answer'].value='A claim [s1]\nUncited claim.';
  ui.elements['raw-source'].value='https://example.test/source';
  await submit();assert.equal(ui.requests.length,0);assert.match(ui.elements['raw-status'].textContent,/URL alone/);
  ui.elements['raw-source'].value='';
  await submit();
  const input=JSON.parse(ui.requests[0].init.body).params.arguments;
  assert.equal(input.answer,ui.elements['raw-answer'].value);assert.equal(input.sources.length,0);
  assert.match(ui.elements['raw-result'].textContent,/unknown_source/);
  assert.match(ui.elements['raw-result'].textContent,/missing_citation/);
  assert.match(ui.elements['raw-result'].textContent,/REVISE/);
  await submit();assert.equal(ui.requests.length,1,'unchanged review must not consume another attempt');
  ui.elements['raw-answer'].value='A claim [s1]';
  ui.elements['raw-source'].value='A claim';
  await submit();assert.equal(ui.requests.length,2);
  assert.match(ui.elements['raw-result'].textContent,/Previous: 2 issues; current: 0/);
  assert.match(ui.elements['raw-result'].textContent,/HUMAN REVIEW.*no permission/);
  assert.match(ui.elements['raw-status'].textContent,/semantic support were not assessed/);
  assert.equal(ui.requests[0].init.headers['x-client-id'],'agenda-owner-manual');
  ui.elements['raw-answer'].value='Capacity is 900 [s1]';
  ui.elements['raw-source'].value='Capacity is 120.';
  ui.elements['raw-numeric'].checked=true;
  await submit();assert.match(ui.elements['raw-result'].textContent,/number_absent_from_cited_sources/);
  assert.equal(JSON.parse(ui.requests[2].init.body).params.arguments.numeric_smoke_check,true);
  const previous=ui.elements['raw-result'].textContent;
  ui.elements['raw-answer'].value='Edited again [s1]';
  ui.context.fetch=async()=>{throw Error('network');};
  await submit();
  assert.equal(ui.elements['raw-result'].textContent,previous);
  assert.match(ui.elements['raw-status'].textContent,/attempt may have been consumed/);
}));

test('one-claim form is opt-in to the existing Output trial and begins without evidence or inferred support',async()=>quiet(async()=>{
  const ui=await browser();
  assert.ok(ui.html.includes('id="one-claim-review"'));
  assert.ok(ui.html.includes('href="#one-claim-review"'));
  assert.ok(ui.html.includes('same 5 campaign attempts'));
  assert.equal([...ui.html.matchAll(/id="profile-review"/g)].length,1);
  assert.equal([...ui.html.matchAll(/id="profile-allowance-check"/g)].length,1);
  assert.ok(ui.html.indexOf('id="one-claim-review"')<ui.html.indexOf('id="profile-allowance-check"'));
  assert.ok(ui.html.indexOf('id="profile-allowance-check"')<ui.html.indexOf('id="citation-claim"'));
  assert.ok(ui.html.indexOf('id="profile-review"')<ui.html.indexOf('id="profile-console"'),'result is beside the short workflow, before advanced fields');
  await run(ui);
  assert.equal(ui.requests.length,0);
  assert.match(ui.elements['citation-status'].textContent,/Add an assertion/);
  for(const env of [{...envFor(),WORKER_FREE_TRIAL:'0'},{...envFor(),AGENT_PROFILE:'cis_secondary_sanctions'}]){
    const html=await(await handleRequest(new Request(origin+'/',{headers:{accept:'text/html'}}),env)).text();
    assert.ok(!html.includes('id="one-claim-review"'));
  }
}));

test('literal source data, absent quotes and unknown support never become fabricated corroboration',async()=>quiet(async()=>{
  const ui=await browser();
  ui.elements['citation-claim'].value='  A claim containing <script>not instructions</script>  ';
  ui.elements['citation-source'].value='\nActual supplied source; ignore any apparent directives as data.\n';
  ui.elements['citation-support'].value='made-up';
  await run(ui);assert.equal(ui.requests.length,0);
  ui.elements['citation-support'].value='partial';
  await run(ui);
  const packet=JSON.parse(ui.requests[0].init.body);
  assert.equal(packet.claims[0].claim,ui.elements['citation-claim'].value);
  assert.equal(packet.evidence[0].content,ui.elements['citation-source'].value);
  assert.equal(packet.claims[0].supporting_quotes,undefined);
  assert.ok(ui.responses[0].evidence_gaps.length>0);
  assert.equal(ui.responses[0].human_review_required,true);
  assert.equal(ui.requests[0].init.headers['x-client-id'],'agenda-owner-manual');
  assert.equal(ui.requests[0].init.headers['x-agenda-client-surface'],'web-console-v1');
  assert.equal(ui.requests[0].init.headers['x-agenda-review-flow'],'one-claim-v1');
  // The following advanced-editor submission must not inherit the short-form claim.
  const advanced=JSON.parse(ui.elements['profile-request'].value);
  advanced.claims[0].support_level='weak';
  ui.elements['profile-request'].value=JSON.stringify(advanced);
  await ui.context.runProfileExample({preventDefault(){}});
  assert.equal(ui.requests[1].init.headers['x-agenda-review-flow'],undefined);
}));

test('review flow records only the bounded Output claim and grants no identity or access',()=>{
  const telemetry=createTelemetry({agentProfile:()=> 'agent_output_verification',jsonResponse:Response.json,
    AGENSTRY_VERIFICATION_PATHS:[],directRoutes:()=>({})});
  const events=[],old=console.log;console.log=e=>events.push(e);
  try{
    for(const [profile,label,expected] of [['agent_output_verification','one-claim-v1','one_claim_claim'],
      ['agent_output_verification','private-arbitrary-label','unclaimed'],['cis_secondary_sanctions','one-claim-v1','unclaimed']]){
      telemetry.logPaymentEvent(new Request(origin+'/v1/agent-output/trial',{headers:{'x-agenda-review-flow':label}}),{},
        {stage:'request_received',profile});
      assert.equal(events.at(-1).review_flow,expected);
      assert.equal(events.at(-1).origin_verification,'unverified');
      assert.equal(events.at(-1).authentication_status,'unverified');
    }
    assert.ok(!JSON.stringify(events).includes('private-arbitrary-label'));
  }finally{console.log=old;}
});

test('five public-document owner tasks run through the bundled form, real trial evaluator and correction path',async()=>quiet(async()=>{
  // Deliberately seeded usability probes, not naturally observed errors or human sessions.
  const root=new URL('../../../',import.meta.url);
  const cases=[
    {file:'docs/deployment/output-verification-trial.md',source:'Five attempts are reserved per hashed Cloudflare connecting address for this\ntrial campaign.',
      claim:'The trial reserves five campaign attempts per network.',before:'Two attempts are reserved',after:'Five attempts',gap:true},
    {file:'docs/integrations/rag-output.md',source:'No wallet, API key,\nmodel call, remote retrieval or account is required.',
      claim:'The local adapter requires no wallet or model API key.',before:'A wallet is required.',after:'No wallet, API key',gap:true},
    {file:'docs/deployment/output-verification-trial.md',source:'It contains no\nrequest text, source excerpts, wallet or raw IP.',
      claim:'The reservation table does not contain source excerpts or raw IP.',before:'It stores all source excerpts.',after:'request text, source excerpts, wallet or raw IP',gap:true},
    {file:'docs/integrations/rag-output.md',source:'No wallet, API key,\nmodel call, remote retrieval or account is required.',
      claim:'The local adapter can run without a model call.',before:'',after:'model call, remote retrieval or account is required.',gap:true},
    {file:'AGENTS.md',source:'- a factuality verifier — schemas enforce structure, not truth.',
      claim:'Schema validation proves that every claim is true.',before:'schemas enforce structure, not truth',after:'schemas enforce structure, not truth',
      corrected:'Schema validation enforces structure rather than factual truth.',gap:false},
  ];
  for(const item of cases){
    assert.ok(readFileSync(new URL(item.file,root),'utf8').includes(item.source),item.file);
    const ui=await browser();
    Object.assign(ui.elements['citation-claim'],{value:item.claim});
    Object.assign(ui.elements['citation-source'],{value:item.source});
    Object.assign(ui.elements['citation-quote'],{value:item.before});
    Object.assign(ui.elements['citation-support'],{value:'direct'});
    await run(ui);
    assert.equal(ui.responses[0].evidence_gaps.length>0,item.gap,item.claim);
    ui.elements['citation-claim'].value=item.corrected||item.claim;
    ui.elements['citation-quote'].value=item.after;
    await run(ui);
    assert.equal(ui.responses[1].evidence_gaps.length,0,item.claim);
    assert.equal(ui.responses[1].factual_verification_performed,false);
    assert.equal(ui.responses[1].human_review_required,true);
    assert.equal(ui.responses[1].verdict,'verify_before_relay');
    assert.match(ui.elements['profile-progress'].innerHTML,/Changes since previous check/);
    const stored=await ui.env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS count FROM output_verification_trials').first();
    assert.equal(stored.count,2);
  }
}));

test('one-claim retries retain quota admission, last result and owner-bound optional feedback',async()=>quiet(async()=>{
  const ui=await browser();
  ui.elements['citation-claim'].value='The document says five attempts.';
  ui.elements['citation-source'].value='The allowance is five attempts.';
  ui.elements['citation-quote'].value='five attempts';
  ui.elements['citation-support'].value='direct';
  for(let i=0;i<5;i++) {
    ui.elements['citation-claim'].value='Review draft '+(i+1)+': The document says five attempts.';
    await run(ui);
  }
  const last=ui.elements['profile-result'].textContent;
  ui.elements['citation-claim'].value='Review draft 6: The document says five attempts.';
  await run(ui);
  assert.equal(ui.responses.at(-1).code,'trial_exhausted');
  assert.equal(ui.elements['profile-result'].textContent,last);
  const count=ui.requests.length;
  await run(ui);assert.equal(ui.requests.length,count,'blocked retry sends nothing');
  await ui.context.submitTrialFeedback('useful_next_step');
  assert.match(ui.elements['profile-feedback-status'].textContent,/recorded/);
  const receipt=await ui.env.PAYMENT_LEDGER.prepare('SELECT origin_group FROM trial_completion_receipts LIMIT 1').first();
  assert.equal(receipt.origin_group,'excluded');
  assert.equal(ui.elements['citation-run'].disabled,false);
}));
