import {routingToolForProfile} from '../src/pricing-policy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
import { WORKED_EXAMPLES } from '../src/worked-examples.js';
import { PRODUCT_WORKFLOWS } from '../src/product-workflows.js';

// Wrangler defaults to keepNames=true. Run the emitted landing script, rather
// than only importing unbundled helpers: Function.toString() crosses runtimes.
const bundle = await build({
  entryPoints: [new URL('../src/index.js', import.meta.url).pathname],
  bundle: true, keepNames: true, platform: 'neutral', format: 'esm', write: false,
});
const { handleRequest } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

test('Interaction Trust routes enforcement requests to the real integration without claiming API execution control', async () => {
  const html = await (await handleRequest(new Request('https://example.test/',{headers:{accept:'text/html'}}),
    {AGENT_PROFILE:'agentic_interaction_trust',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'})).text();
  assert.match(html,/does not enforce execution restrictions/);
  assert.match(html,/Install a request-bound executor/);
  assert.match(html,/WORKER_DEPLOY_PILOT\.md/);
});

test('bundled landing scripts display successful review results across the fleet', async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    for (const profile of Object.keys(PRODUCT_WORKFLOWS)) {
      const html = await (await handleRequest(new Request('https://example.test/?owner_test=1', {
        headers: { accept: 'text/html' },
      }), { AGENT_PROFILE: profile, BILLING_MODE: 'pay_per_call', WORKER_FREE_TRIAL: '1' })).text();
      const example = WORKED_EXAMPLES[profile];
      assert.ok(example, profile);
      const elements = Object.fromEntries([
        'profile-run', 'profile-paid', 'profile-status', 'profile-result',
        'profile-summary', 'profile-progress', 'profile-response', 'profile-request', 'profile-feedback',
      ].map(id => [id, { value: JSON.stringify(example.request), innerHTML: '', textContent: '', hidden: true }]));
      let returned = structuredClone(example.response);
      const requests = [];
      const context = {
        URL, location: { search: '?owner_test=1', href: 'https://example.test/?owner_test=1' },
        window: { location: { search: '?owner_test=1', href: 'https://example.test/?owner_test=1', origin: 'https://example.test' }, crypto: globalThis.crypto }, crypto: globalThis.crypto,
        fetch: async (url, init) => {
          requests.push({ url, init });
          return new Response(JSON.stringify(returned), { status: 200 });
        },
        document: {
          getElementById: id => elements[id],
          createElement: () => ({ set textContent(value) {
            this.innerHTML = String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
          } }),
        },
      };
      for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInNewContext(script, context);
      await context.runProfileExample({ preventDefault() {} });
      assert.match(elements['profile-status'].textContent, /^Evaluation returned\./, profile);
      assert.match(elements['profile-summary'].innerHTML, /Returned route:/, profile);
      assert.equal(elements['profile-response'].hidden, false, profile);
      assert.deepEqual(JSON.parse(elements['profile-result'].textContent), returned, profile + ' unchanged response');
      assert.equal(elements['profile-run'].disabled, false, profile);
      assert.equal(requests.length, 1, profile);
      assert.equal(requests[0].init.headers['content-type'], 'application/json', profile);
      assert.equal(requests[0].init.headers['x-agenda-client-surface'], 'web-console-v1', profile);
      assert.equal(requests[0].init.headers['x-client-id'], 'agenda-owner-manual', profile);
      assert.equal(new URL(requests[0].url).pathname, routingToolForProfile(profile)?'/mcp/agent':new URL('https://example.test'+(profile==='agent_output_verification'?'/v1/agent-output/trial':'/v1/trial')).pathname, profile);
      const sent=JSON.parse(requests[0].init.body);
      if(routingToolForProfile(profile)){assert.equal(sent.params.name,routingToolForProfile(profile));assert.deepEqual(sent.params.arguments,example.request);}
      else assert.deepEqual(sent, example.request, profile + ' serialized JSON');
      returned = structuredClone(example.follow_up?.response || example.response);
      await context.runProfileExample({ preventDefault() {} });
      assert.equal(profile === 'critical_minerals_due_diligence' ? elements['profile-progress'].innerHTML === '' : /Changes since previous check/.test(elements['profile-progress'].innerHTML), true, profile);
      assert.equal(requests.length, 2, profile);
      const lastSummary=elements['profile-summary'].innerHTML;
      const lastResult=elements['profile-result'].textContent;
      elements['profile-request'].value = '{broken';
      await context.runProfileExample({ preventDefault() {} });
      assert.equal(requests.length, 2, profile + ' invalid local JSON sends nothing');
      assert.equal(elements['profile-summary'].innerHTML, lastSummary, profile + ' completed review preserved');
      assert.equal(profile === 'critical_minerals_due_diligence' ? elements['profile-progress'].innerHTML === '' : /Changes since previous check/.test(elements['profile-progress'].innerHTML), true, profile);
      assert.equal(elements['profile-result'].textContent,lastResult,profile);
      assert.equal(elements['profile-response'].hidden, false, profile);
    }
  } finally {
    console.log = originalLog;
  }
});

test('bundled mineral page prepares a bounded local revision without a request and safely displays evidence drafts', async()=>{
  const html=await(await handleRequest(new Request('https://example.test/',{headers:{accept:'text/html'}}),
    {AGENT_PROFILE:'critical_minerals_due_diligence',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'})).text();
  const elements=Object.fromEntries(['profile-request','profile-intake','mineral-workflow','mineral-revision-status'].map(id=>[id,{value:'',innerHTML:'',textContent:'',hidden:true}]));
  let calls=0,refreshes=0;
  elements['profile-intake'].updateFromJson=()=>refreshes++;
  const context={URL,window:{location:{href:'https://example.test/',origin:'https://example.test'},crypto:globalThis.crypto},
    fetch:()=>{calls++;throw Error('Preparing evidence must not make a request');},
    document:{getElementById:id=>elements[id],createElement:()=>({set textContent(value){this.innerHTML=String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}})}};
  for(const[,script]of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInNewContext(script,context);
  const example=structuredClone(WORKED_EXAMPLES.critical_minerals_due_diligence);
  const previous={...example.request,previous_submission:{old:'baseline must not be nested'}};
  example.response.dossier_review.evidence_workflow.decision.question='<img src=x onerror=alert(1)>';
  context.renderMineralWorkflow(example.response,previous);
  assert.equal(elements['mineral-workflow'].hidden,false);
  assert.match(elements['mineral-workflow'].innerHTML,/&lt;img/);
  assert.doesNotMatch(elements['mineral-workflow'].innerHTML,/<img/);
  assert.match(elements['mineral-workflow'].innerHTML,/Prepare updated dossier/);
  const edited={...example.request,assessment_date:'2026-10-19',blockers:['Keep adverse facts']};
  elements['profile-request'].value=JSON.stringify(edited);
  context.prepareMineralRevision();
  const updated=JSON.parse(elements['profile-request'].value);
  assert.equal(updated.assessment_date,'2026-10-19');
  assert.deepEqual(updated.blockers,['Keep adverse facts']);
  assert.equal(updated.previous_submission.assessment_date,previous.assessment_date);
  assert.equal(Object.hasOwn(updated.previous_submission,'previous_submission'),false);
  assert.equal(calls,0);
  assert.equal(refreshes,1);
  assert.match(elements['mineral-revision-status'].textContent,/explicitly run/);
  elements['profile-request'].value='{invalid';
  context.prepareMineralRevision();
  assert.match(elements['mineral-revision-status'].textContent,/Nothing was submitted/);
  assert.equal(calls,0);
});
