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

test('Dual-use top explains reference-file readiness without classification or permission',()=>{
  const html=landingHtml(req('/'),{AGENT_PROFILE:'dual_use_technology_export',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'},true);
  assert.match(html,/id="export-file-review"/);
  assert.match(html,/One export file, not an export permission/);
  assert.match(html,/not the content, authenticity, applicability or freshness/);
  assert.match(html,/READY_FOR_EXPORT_CONTROL_REVIEW/);
  assert.match(html,/never permission to export/);
  assert.match(html,/internal review prompts, not legal requirements/);
  assert.match(html,/end-user sector and named counterparties are optional inputs/);
  assert.match(html,/Placeholder records do not close gaps/);
  assert.doesNotMatch(html,/ready for review \/ gather more evidence \/ do not export/);
  assert.doesNotMatch(landingHtml(req('/'),{AGENT_PROFILE:'agenda'},true),/id="export-file-review"/);
});

test('Critical minerals top describes one project file review without geology, ESG audit or authorization',()=>{
  const html=landingHtml(req('/'),{AGENT_PROFILE:'critical_minerals_due_diligence',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'},true);
  assert.match(html,/id="dossier-evidence-review"/);
  const title='Critical Minerals Supplier and Offtake Evidence Review';
  const tagline='Prepare a mineral supplier or offtake file: identify missing origin, ownership and traceability records and request them before human review.';
  for(const expected of [`<title>${title}</title>`,`<h1>${title}</h1>`,`<meta property="og:title" content="${title}">`,`<p class="tagline">${tagline}</p>`,`<meta name="description" content="${tagline}">`,`<meta property="og:description" content="${tagline}">`]) assert.ok(html.includes(expected),expected);
  for(const profile of ['agenda','cis_secondary_sanctions','gulf_maritime_exposure']) assert.ok(!landingHtml(req('/'),{AGENT_PROFILE:profile},true).includes(title));
  assert.match(html,/One project file, not a geology or ESG audit/);
  assert.match(html,/not a resource, reserve, grade or NPV estimate/);
  assert.match(html,/no conflict-free or responsible-sourcing certification/);
  assert.match(html,/the strongest route is <code>ready_for_human_review<\/code>/);
  assert.match(html,/<code>escalate_before_offtake<\/code>/);
  assert.match(html,/<code>request_evidence<\/code>, <code>require_approval<\/code> or <code>stop<\/code>\) is triage routing only, not clearance or permission/);
  assert.match(html,/The score measures documentary coverage only, never investment quality/);
  assert.match(html,/2 free checks per network address per product for this campaign; shared networks share the allowance and it does not reset daily/);
  assert.doesNotMatch(html,/ready for decision \/ gather more evidence \/ do not invest/);
  assert.doesNotMatch(landingHtml(req('/'),{AGENT_PROFILE:'agenda'},true),/id="dossier-evidence-review"/);
});

test('Escrow top frames delivery evidence review, not an escrow contract',()=>{
  const html=landingHtml(req('/'),{AGENT_PROFILE:'m2m_escrow_arbiter',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'},true);
  assert.match(html,/id="escrow-delivery-evidence"/);
  assert.match(html,/One delivered artifact, not an escrow contract/);
  assert.match(html,/never holds, locks or releases funds/);
  assert.match(html,/RELEASE_TO_SELLER/);
  assert.match(html,/REFUND_TO_BUYER/);
  assert.match(html,/PARTIAL_SETTLEMENT/);
  assert.match(html,/ESCALATE_HUMAN/);
  assert.match(html,/escrow_action: HOLD/);
  assert.match(html,/settlement_authorized: false/);
  assert.match(html,/human_review_required: true/);
  assert.match(html,/all_or_nothing/);
  assert.match(html,/pro_rata/);
  assert.match(html,/slo_penalty/);
  assert.match(html,/supplied_artifact_only/);
  assert.match(html,/0\.05 USDC per paid check on Base/);
  assert.doesNotMatch(html,/do not place escrow yet|Claim audit|Watch-next|Brief for the team|Halyk|THINK|AI drafts/);
  assert.doesNotMatch(landingHtml(req('/'),{AGENT_PROFILE:'agenda'},true),/id="escrow-delivery-evidence"/);
});

test('Financial Guard top describes one pre-sign review without payment enforcement',()=>{
  const html=landingHtml(req('/'),{AGENT_PROFILE:'agent_financial_guard',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'},true);
  assert.match(html,/id="pre-sign-evidence-review"/);
  assert.match(html,/One proposed transaction, not a payment guard/);
  assert.match(html,/never holds money and never sees wallet keys/);
  assert.match(html,/The verdict is only ever <code>REJECT<\/code> or <code>HUMAN_REVIEW<\/code>/);
  assert.match(html,/static local denylist, not current screening/);
  assert.match(html,/There is no "allow": even a clean request routes to a human/);
  assert.match(html,/2 free checks per network address per product for this campaign; shared networks share the allowance and it does not reset daily/);
  assert.doesNotMatch(html,/do not grant yet/);
  assert.doesNotMatch(html,/ready for decision \/ gather more evidence/);
  assert.doesNotMatch(landingHtml(req('/'),{AGENT_PROFILE:'agenda'},true),/id="pre-sign-evidence-review"/);
});
test('cis top block: verified claims only, cis profile only',async()=>{
  const cis=await(await handleRequest(req('/'),{AGENT_PROFILE:'cis_secondary_sanctions',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'})).text();
  assert.match(cis,/What this does not do/);
  assert.match(cis,/ready_for_human_review/);
  assert.match(cis,/escalate_before_onboarding/);
  assert.match(cis,/insufficient_information/);
  assert.match(cis,/authorization_granted: false/);
  assert.match(cis,/not a sanctions screen and not clearance/);
  assert.match(cis,/A name match is not identity verification/);
  assert.match(cis,/does not reset daily/);
  assert.match(cis,/user-supplied evidence only, with no live retrieval/);
  assert.match(cis,/Show a counterparty ownership example/);
  assert.doesNotMatch(cis,/do not onboard yet|file ready for review|AI drafts\. Humans decide/);
  assert.doesNotMatch(cis,/GLEIF/);
  const other=await(await handleRequest(req('/'),{AGENT_PROFILE:'gulf_maritime_exposure',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call'})).text();
  assert.doesNotMatch(other,/What this does not do/);
});
test('cis top block: GLEIF ownership line only when GLEIF_ENABLED',async()=>{
  const on=await(await handleRequest(req('/'),{AGENT_PROFILE:'cis_secondary_sanctions',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',GLEIF_ENABLED:'1'})).text();
  assert.match(on,/disclosed LEI record from GLEIF/);
  assert.match(on,/disclosed direct or ultimate parent relationships published there/);
  assert.match(on,/disclosed relationships only, not hidden or multi-layer beneficial ownership/);
});
