import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';

test('saved Minerals and Market Entry behavior matches the actual evaluator and landing', async () => {
  const log = console.log;
  console.log = () => {};
  try {
    for (const profile of ['critical_minerals_due_diligence', 'market_entry_readiness']) {
      const fixture = WORKED_EXAMPLES[profile];
      const env = {AGENT_PROFILE:profile, VIZIER_DISABLED:'1', LIVE_RETRIEVAL_ENABLED:'0'};
      const response = await handleRequest(new Request('https://example.test/mcp', {
        method:'POST', headers:{'Content-Type':'application/json', 'X-Client-Id':'agenda-owner-fixture-contract'},
        body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:fixture.tool,arguments:fixture.request}}),
      }),env);
      const body = await response.json();
      assert.equal(response.status,200);
      assert.ok(!body.error && !body.result?.isError);
      const current = body.result.structuredContent?.metadata?.response || body.result.structuredContent;
      const fields = profile === 'critical_minerals_due_diligence'
        ? ['dossier_review', 'next_action', 'authorization_granted']
        : ['confirmed_facts', 'next_action', 'authorization_granted'];
      for (const field of fields) assert.deepEqual(fixture.response[field],current[field],profile + ': ' + field);
      if (profile === 'critical_minerals_due_diligence') {
        assert.ok(fixture.response.dossier_review.source_reviews.every(row => row.status === 'needs_evidence'));
        assert.deepEqual(fixture.response.dossier_review.eligible_source_types,[]);
      }
      const html = await (await handleRequest(new Request('https://example.test', {headers:{Accept:'text/html'}}),env)).text();
      assert.ok(html.includes('Saved example result'));
      assert.ok(html.includes('insufficient'));
    }
  } finally {console.log = log;}
});
