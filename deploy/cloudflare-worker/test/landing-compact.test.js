import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {handleRequest, landingHtml, agentCard} from '../src/index.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
import {outputTrialTerms} from '../src/output-trial.js';
import {routingToolForProfile, evaluationAmount} from '../src/pricing-policy.js';
const origin='https://example.test';
const req=path=>new Request(origin+path,{headers:{accept:'text/html','x-client-id':'agenda-owner-landing-tests'}});
for(const profile of Object.keys(WORKED_EXAMPLES)) {
  test('compact public landing and read-only resources: '+profile,async()=>{
    const env={AGENT_PROFILE:profile,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'};
    const stableCard=()=>{const card=agentCard(req('/'),env);delete card.x_agenda_intelligence.operational_health.checked_at;return JSON.stringify(card);};
    const before=stableCard();
    const html=await(await handleRequest(req('/'),env)).text();
    assert.ok(Buffer.byteLength(html)<60000,profile+' initial HTML should stay below 60 KB');
    assert.match(html,/<script src="\/landing-client.js" defer><\/script>/);
    assert.ok(!html.includes('<script>'));
    const firstScreen=html.slice(html.indexOf('<main>'),html.indexOf('id="worked-example"'));
    assert.match(firstScreen,/Human review required/);
    assert.doesNotMatch(firstScreen,/Live evaluation|Profile:/);
    assert.match(html,/<footer>[\s\S]*Live evaluation.*Profile:/);
    const line=html.match(/id="access-summary">([\s\S]*?)<\/p>/)[1];
    if(routingToolForProfile(profile)) {
      assert.match(line,/Question routing is free/);assert.doesNotMatch(line,/\d+ free checks/);
    } else {
      assert.ok(line.includes(outputTrialTerms(profile).attempts_per_network+' free checks'));
      assert.ok(line.includes(evaluationAmount(profile,WORKED_EXAMPLES[profile].tool)+' USDC'));
    }
    const ld=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(ld['@type'],['SoftwareApplication','WebAPI']);
    assert.equal(ld.termsOfService,origin+'/terms');
    assert.ok(!ld.aggregateRating && !ld.review);
    const script=await handleRequest(req('/landing-client.js'),env);
    assert.equal(script.status,200);assert.match(script.headers.get('content-type'),/javascript/);
    const source=await script.text();new vm.Script(source);assert.match(source,/function showWorkedExample/);
    const example=await(await handleRequest(req('/landing-examples.json'),env)).json();
    assert.equal(example.attempt_consumed,false);assert.equal(example.evaluation_performed,false);
    assert.deepEqual(example.example,JSON.parse(JSON.stringify(WORKED_EXAMPLES[profile])));
    const terms=await(await handleRequest(req('/terms'),env)).text();
    for(const phrase of ['id="access"','HTTP 402','24 hours','not transaction authorization','Campaign allowances do not reset daily'])assert.ok(terms.includes(phrase),phrase);
    assert.equal(stableCard(),before,'machine card unchanged by page reads');
  });
}
test('no trial enabled never advertises a free live allowance',()=>{
  for(const profile of Object.keys(WORKED_EXAMPLES)) {
    const html=landingHtml(req('/'),{AGENT_PROFILE:profile,BILLING_MODE:'pay_per_call'},true);
    const line=html.match(/id="access-summary">([\s\S]*?)<\/p>/)[1];
    assert.doesNotMatch(line,/\d+ free checks/);
    if(!routingToolForProfile(profile))assert.match(line,/No free live trial enabled/);
  }
});
test('interaction trust first screen explains the missing-evidence checklist without overclaiming',async()=>{
  const env={AGENT_PROFILE:'agentic_interaction_trust',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'};
  const html=await(await handleRequest(req('/'),env)).text();
  const firstScreen=html.slice(html.indexOf('<main>'),html.indexOf('id="worked-example"'));
  assert.match(firstScreen,/id="missing-evidence-check"/);
  assert.match(firstScreen,/allow_low_risk/);
  assert.match(firstScreen,/escalate_to_human_review/);
  assert.match(firstScreen,/block_until_verified/);
  assert.match(firstScreen,/authorization_granted: false/);
  assert.match(firstScreen,/remediation\.issues/);
  assert.match(firstScreen,/free_trial_status/);
  assert.match(firstScreen,/0\.01 USDC per paid check on Base/);
  assert.doesNotMatch(firstScreen,/0–1000|AgentTrust|trust score 0/);
  assert.doesNotMatch(firstScreen,/proceed \/ gather more evidence \/ do not proceed/);
});

test('Middle Corridor top describes evidence review without commercial authorization',()=>{
  const html=landingHtml(req('/'),{AGENT_PROFILE:'kazakhstan',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'},true);
  assert.match(html,/id="shipment-evidence-review"/);
  assert.match(html,/One shipment file, not a corridor forecast/);
  assert.match(html,/content, authenticity and freshness are not independently verified/);
  assert.match(html,/no dedicated HS-code or dual-use field is required/);
  assert.match(html,/including <code>proceed<\/code>, is triage routing only/);
  assert.match(html,/supply an empty source list/);
  assert.doesNotMatch(landingHtml(req('/'),{AGENT_PROFILE:'agenda'},true),/id="shipment-evidence-review"/);
});

test('Gulf top describes one voyage file review without live tracking or authorization',()=>{
  const html=landingHtml(req('/'),{AGENT_PROFILE:'gulf_maritime_exposure',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'},true);
  assert.match(html,/id="voyage-evidence-review"/);
  assert.match(html,/One voyage file, not a live picture of the sea/);
  assert.match(html,/Strait of Hormuz, Bab-el-Mandeb, the Red Sea, the Arabian Gulf or the Gulf of Oman/);
  assert.match(html,/<meta name="description" content="Identify missing vessel, voyage and insurance records for a Gulf shipping review through the Strait of Hormuz, Bab-el-Mandeb or the Red Sea\.">/);
  assert.match(html,/<p class="tagline">Identify missing vessel, voyage and insurance records for a Gulf shipping review through the Strait of Hormuz, Bab-el-Mandeb or the Red Sea\.<\/p>/);
  assert.match(html,/not live vessel tracking, AIS monitoring or an incident map/);
  assert.match(html,/no war-risk premium, P&amp;I cover or quote/);
  assert.match(html,/There is no "proceed": the strongest route is <code>ready_for_human_review<\/code>/);
  assert.match(html,/17 categories, from <code>vessel_registry_extract<\/code> to <code>human_review_note<\/code>/);
  assert.match(html,/2 free checks per network address per product for this campaign; shared networks share the allowance and it does not reset daily/);
  assert.doesNotMatch(html,/proceed \/ gather more evidence \/ do not sail yet/);
  assert.doesNotMatch(landingHtml(req('/'),{AGENT_PROFILE:'agenda'},true),/id="voyage-evidence-review"/);
});

test('market entry first screen frames file readiness, not market research',async()=>{
  const env={AGENT_PROFILE:'market_entry_readiness',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'};
  const html=await(await handleRequest(req('/'),env)).text();
  const firstScreen=html.slice(html.indexOf('<main>'),html.indexOf('id="worked-example"'));
  assert.match(firstScreen,/id="entry-file-readiness"/);
  assert.match(firstScreen,/Your entry file, not a market study/);
  assert.match(firstScreen,/does not size the market, find partners or rate the country/);
  assert.match(firstScreen,/pause_for_evidence/);
  assert.match(firstScreen,/route_to_committee/);
  assert.match(firstScreen,/launch_commitment_ready/);
  assert.match(firstScreen,/authorization_granted: false/);
  assert.match(firstScreen,/62 categories/);
  assert.match(firstScreen,/free_trial_status/);
  assert.match(firstScreen,/0\.01 USDC per paid check on Base/);
  assert.doesNotMatch(firstScreen,/do not sign \/ launch yet/);
  assert.doesNotMatch(firstScreen,/B-READY|Tridge/);
  const other=await(await handleRequest(req('/'),{AGENT_PROFILE:'agenda',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'})).text();
  assert.doesNotMatch(other,/id="entry-file-readiness"/);
});

test('Corridor Assistant top describes free routing, not a cargo gate',()=>{
  const html=landingHtml(req('/'),{AGENT_PROFILE:'corridor_sanctions_assistant',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'},true);
  const top=html.slice(html.indexOf('id="corridor-orientation"'),html.indexOf('aria-label="Example result"'));
  for(const phrase of ['Choose a specialist, not a shipment verdict','keywords','incomplete request draft','Nothing is sent','corridor_sanctions_assistant','screen_dual_use_hs_code','no match is not clearance','Routing needs no trial attempt','not a comprehensive sanctions name-screening service']) assert.ok(top.includes(phrase),phrase);
  assert.doesNotMatch(top,/proceed \/ gather more evidence|do not ship yet|2 free live attempts|Halyk|THINK|AI drafts/);
  assert.ok(html.indexOf('id="corridor-orientation"')<html.indexOf('aria-label="Example result"'));
  for(const profile of ['kazakhstan','cis_secondary_sanctions','gulf_maritime_exposure']) assert.ok(!landingHtml(req('/'),{AGENT_PROFILE:profile},true).includes('id="corridor-orientation"'));
});
