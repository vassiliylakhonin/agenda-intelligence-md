import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { handleRequest, GATE_REQUEST_GUIDES } from '../src/index.js';
import { PRODUCT_WORKFLOWS, reviewSummary, reviewSummaryHtml } from '../src/product-workflows.js';
import { WORKED_EXAMPLES } from '../src/worked-examples.js';
import { PAYMENT_CLIENT_SCRIPT } from '../src/payment-client.js';
import { createHostedMcpCall, HostedMcpError } from '../../../examples/hosted-mcp/client.mjs';
import { publicTargets } from '../scripts/public-conformance.js';

const origin = 'https://example.test';
const configured = profile => ({AGENT_PROFILE:profile, BILLING_MODE:'pay_per_call', VIZIER_DISABLED:'1'});
const quiet = async action => {
  const old = console.log; console.log = () => {};
  try { return await action(); } finally { console.log = old; }
};

test('all twelve product pages publish task intake, a valid console and inspectable saved results', async () => quiet(async () => {
  assert.equal(Object.keys(PRODUCT_WORKFLOWS).length, 12);
  for (const [profile, work] of Object.entries(PRODUCT_WORKFLOWS)) {
    const html = await (await handleRequest(new Request(origin, {headers:{accept:'text/html'}}), configured(profile))).text();
    assert.ok(html.includes('Your review workflow'), profile);
    assert.ok(html.includes(work.get.replaceAll('&', '&amp;')), profile);
    assert.ok(html.includes('Review summary'), profile);
    for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
    if (profile === 'agenda') {
      assert.ok(html.includes('What do you need to do?'));
      for (const target of publicTargets()) assert.ok(html.includes('href="'+target.origin+'/"'), target.workerName);
    }
    if (['agent_financial_guard','m2m_escrow_arbiter'].includes(profile)) continue;
    const encoded = html.match(/id="profile-request"[^>]*>([\s\S]*?)<\/textarea>/)[1];
    const body = encoded.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
    const endpoint = ['agenda','corridor_sanctions_assistant','kazakhstan'].includes(profile) ? '/mcp' : {
      agent_output_verification:'/v1/agent-output/verification', agentic_interaction_trust:'/v1/agentic-interaction/trust',
      cis_secondary_sanctions:'/v1/cis-secondary-sanctions/exposure', gulf_maritime_exposure:'/v1/gulf-maritime/exposure',
      market_entry_readiness:'/v1/market-entry/readiness', critical_minerals_due_diligence:'/v1/critical-minerals/due-diligence',
      dual_use_technology_export:'/v1/dual-use/technology-export'
    }[profile];
    const response = await handleRequest(new Request(origin+endpoint, {method:'POST', body,
      headers:{'content-type':'application/json','MCP-Protocol-Version':'2025-11-25'}}), configured(profile));
    assert.equal(response.status, 402, profile+' console admission');
    const elements = Object.fromEntries(['profile-run','profile-status','profile-result','profile-summary','profile-response','profile-request']
      .map(id => [id, {style:{},value:body,innerHTML:'',textContent:''}]));
    const context = {URL,window:{crypto:globalThis.crypto},crypto:globalThis.crypto,
      document:{getElementById:id => elements[id],createElement:() => ({set textContent(value) {
        this.innerHTML = String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
      }})}};
    vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1], context);
    context.agendaPaidFetch = (url, init) => handleRequest(new Request(url,init), {...configured(profile),BILLING_MODE:'freemium'});
    await context.runProfileExample({preventDefault(){}});
    assert.ok(elements['profile-summary'].innerHTML.includes('Returned route'), profile+' live summary');
    assert.equal(elements['profile-response'].hidden, false);
  }
}));

test('summary preserves service routes and all gaps without granting permission or interpreting failures', () => {
  const output = WORKED_EXAMPLES.agent_output_verification;
  assert.equal(output.response.verdict, 'block_unsafe_claims');
  assert.equal(output.follow_up.response.verdict, 'verify_before_relay');
  assert.equal(output.follow_up.response.human_review_required, true);
  for (const ex of Object.values(WORKED_EXAMPLES)) {
    const original = JSON.stringify(ex.response);
    assert.ok(reviewSummary(ex.response));
    assert.equal(JSON.stringify(ex.response), original);
  }
  for (const bad of [null, [], {}, {error:'failed'}, {code:'payment_required'}, {verdict:5}]) assert.equal(reviewSummary(bad), null);
  assert.deepEqual(reviewSummary({verdict:'review', signal_screen:{evidence_gaps:'wrong-type'}}).gaps, []);
  const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const html = reviewSummaryHtml({verdict:'hold', evidence_gaps:['<script>bad</script>','two','three','four'], owner_actions:[{owner:'Reviewer',action:'Inspect source'}]}, escape);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Remaining evidence gaps'));
  assert.ok(html.includes('four'));
  assert.ok(html.includes('Reviewer: Inspect source'));
});

test('malformed JSON hints recover REST/A2A or discover MCP without guessing a paid tool', async () => quiet(async () => {
  for (const profile of Object.keys(PRODUCT_WORKFLOWS)) {
    for (const path of ['/mcp','/message/send']) {
      const response = await handleRequest(new Request(origin+path, {method:'POST',body:'{"private":"never-log"'}), configured(profile));
      assert.equal(response.status, 400);
      const data = await response.json();
      assert.equal(data.error.code, -32700);
      assert.equal(data.request_hint.max_body_bytes, 1048576);
      assert.deepEqual(data.error.data.request_hint, data.request_hint);
      const hint = data.request_hint;
      const corrected = await handleRequest(new Request(origin+path, {method:'POST',headers:hint.headers,body:JSON.stringify(hint.example_request)}), configured(profile));
      assert.equal(corrected.status, path === '/mcp' ? 200 : 402, profile+path);
    }
  }
  const bad = await handleRequest(new Request(origin+'/v1/agent-output/verification', {method:'POST',body:'{'}), configured('agent_output_verification'));
  const hint = (await bad.json()).request_hint;
  assert.deepEqual(hint.example_request, GATE_REQUEST_GUIDES.agent_output_verification.example);
}));

test('retained client preserves repair hints and correlation, while bad local input sends nothing', async () => quiet(async () => {
  let sends = 0;
  const options = {endpoint:origin+'/mcp',requestId:'repair',fetchImpl:async (url, init) => {
    sends++;
    return handleRequest(new Request(url,init), configured('agent_output_verification'));
  }};
  for (const input of [null, [], 'bad', undefined, new Date()]) {
    assert.throws(() => createHostedMcpCall('agent_output_verification', input, options), /JSON object/);
  }
  assert.equal(sends, 0);
  const call = createHostedMcpCall('agent_output_verification', {}, options);
  await assert.rejects(call.evaluate(), error => {
    assert.ok(error instanceof HostedMcpError);
    assert.equal(error.status, 400);
    assert.ok(error.paymentAttemptId);
    assert.ok(error.paymentTraceId);
    assert.ok(error.requestHint.example_request);
    return true;
  });
  const nonJson = createHostedMcpCall('tool', {}, {endpoint:origin+'/mcp',fetchImpl:async () => new Response('unavailable', {status:503})});
  await assert.rejects(nonJson.evaluate(), error => error instanceof HostedMcpError && error.status === 503);
}));

test('browser correction trace is page-local, endpoint-scoped and cleared after valid admission', async () => {
  const seen = [], trace = 'aaaaaaaa-1234-4567-89ab-123456789abc';
  const context = {URL,window:{location:{href:origin,origin},ethereum:{},confirm:() => false},fetch:async (url, init) => {
    seen.push({url,headers:{...init.headers}});
    return seen.length === 1 ? Response.json({code:'invalid_paid_request'}, {status:400,headers:{'x-payment-trace-id':trace}})
      : Response.json({required_usdc:0.05}, {status:402,headers:{'x-payment-trace-id':trace}});
  }};
  vm.runInNewContext(PAYMENT_CLIENT_SCRIPT, context);
  const init = {method:'POST',headers:{'content-type':'application/json'},body:'{}'};
  await context.agendaPaidFetch(origin+'/mcp', init, 0.05);
  await context.agendaPaidFetch(origin+'/different', init, 0.05);
  await context.agendaPaidFetch(origin+'/mcp', init, 0.05);
  await context.agendaPaidFetch(origin+'/mcp', init, 0.05);
  assert.equal(seen[1].headers['x-payment-trace-id'], undefined);
  assert.equal(seen[2].headers['x-payment-trace-id'], trace);
  assert.equal(seen[3].headers['x-payment-trace-id'], undefined);
});

test('corridor routing distinguishes shipping from Gulf vessels and exposes the export gate', async () => quiet(async () => {
  for (const [text, expected] of [
    ['What evidence is needed before shipping industrial equipment from Aktau to Baku?', 'middle_corridor_deal_risk'],
    ['Vessel shipment Aktau to Baku', 'middle_corridor_deal_risk'],
    ['Vessel shipment through Hormuz to Baku', 'gulf_maritime_exposure'],
    ['Review vessel IMO 1234567', 'gulf_maritime_exposure'],
    ['Review HS 854231 microelectronics export control', 'dual_use_technology_export']
  ]) {
    const call = createHostedMcpCall('corridor_sanctions_assistant', {text}, {endpoint:origin+'/mcp',fetchImpl:(url, init) =>
      handleRequest(new Request(url,init), {...configured('corridor_sanctions_assistant'),BILLING_MODE:'freemium'})});
    const result = await call.evaluate();
    assert.equal(result.result.selected_route.profile, expected, text);
  }
}));
