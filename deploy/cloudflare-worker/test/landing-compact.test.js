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
