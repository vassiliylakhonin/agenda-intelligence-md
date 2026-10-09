import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.js';
import { reviewSummary, reviewSummaryHtml, reviewDeltaHtml, PRODUCT_WORKFLOWS } from '../src/product-workflows.js';

const call = async text => {
  const original = console.log;
  console.log = () => {};
  try {
    const response = await handleRequest(new Request('https://example.test/mcp', {
      method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'strategic_risk_triage',arguments:{text}}})
    }), {AGENT_PROFILE:'agenda',BILLING_MODE:'freemium',VIZIER_DISABLED:'1'});
    assert.equal(response.status, 200);
    return (await response.json()).result.structuredContent;
  } finally { console.log = original; }
};

test('Russian Kazakhstan inflections retain geography and the market-entry next step', async () => {
  for (const text of [
    'A warehouse robotics supplier plans to enter Kazakhstan. What evidence is needed before signing with a local distributor?',
    'Поставщик складских роботов планирует выход на рынок Казахстана. Какие документы нужны до подписания договора с дистрибьютором?',
    'Выход на рынок: Казахстан. Проверка до договора с дистрибьютором.',
    'Выход на рынок в Казахстане через местного дистрибьютора.'
  ]) {
    const result = await call(text);
    assert.ok(result.modules.some(m => m.module === 'central-asia-caspian'), text);
    assert.ok(result.signal_screen.subject.jurisdictions.includes('Kazakhstan'), text);
    assert.ok(JSON.stringify(result.next_actions).includes('kazakhstan-market-entry-readiness-a2a'), text);
  }
});

test('subject vocabulary respects Unicode word boundaries and does not reroute another market', async () => {
  const embedded = await call('Before onboarding: nonkazakhstanica. Безказахстана.');
  assert.deepEqual(embedded.signal_screen.subject.jurisdictions, []);
  assert.deepEqual(embedded.signal_screen.subject.commodities, []);
  const other = await call('Market entry in the United Arab Emirates before signing with a distributor.');
  assert.ok(!JSON.stringify(other.next_actions).includes('kazakhstan-market-entry-readiness'));
});

test('dual-use summary exposes missing classification inputs before generic caveats', () => {
  const response = {export_risk_triage:{status:'not_decision_ready',
    evidence_gaps:['Source content, classification, licensing requirements and end-use have not been independently verified.'],
    primary_risk_vectors:['CHPL Status: Tier 1 matched.', 'No caller-supplied ECCN classification; obtain a classification note before human review.',
      'No dated supporting sources were supplied.'],human_review_required:true}};
  const original = JSON.stringify(response);
  const html = reviewSummaryHtml(response, value => String(value));
  assert.ok(html.includes('ECCN classification'));
  assert.ok(html.includes('No dated supporting sources'));
  assert.equal(JSON.stringify(response), original);
  assert.equal(reviewSummary(response).route, 'not_decision_ready');
});

test('document request suggestions and changed gaps never mutate the service outcome', () => {
  const before = {triage_recommendation:'escalate_before_signature',evidence_gaps:['Registry extract missing.','Ownership unknown.']};
  const after = {...before,evidence_gaps:['Ownership unknown.']};
  const original = JSON.stringify([before,after]);
  const html = reviewSummaryHtml(after, String, PRODUCT_WORKFLOWS.kazakhstan);
  assert.match(html, /Suggested document requests/);
  assert.match(html, /Trade dossier owner/);
  const delta = reviewDeltaHtml(before, after, String);
  assert.match(delta, /2 → 1/);
  assert.match(delta, /No longer reported/);
  assert.match(delta, /Registry extract missing/);
  assert.match(delta, /does not establish factual verification/);
  assert.equal(JSON.stringify([before,after]), original);
  assert.equal(reviewDeltaHtml(before, {error:'failed'}, String), '');
});
