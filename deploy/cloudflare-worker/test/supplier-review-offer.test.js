import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {SUPPLIER_REVIEW_SAMPLE,supplierScopeMailto} from '../src/supplier-review-offer.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
const origin='https://example.test';
const headers={'x-client-id':'agenda-owner-supplier-review-offer'};
test('all existing profiles serve a bounded offer and consistent synthetic sample without upload or checkout',async()=>{
  for(const profile of Object.keys(WORKED_EXAMPLES)) {
    const env={AGENT_PROFILE:profile};
    const response=await handleRequest(new Request(origin+'/supplier-review',{headers}),env);
    assert.equal(response.status,200,profile);
    const html=await response.text();
    for(const term of ['99 USD','five files','20 pages','ten stated claims','written quote','Synthetic example','R1','R2','1m/2m','authorization granted: false']) {
      assert.ok(html.includes(term),term);
    }
    assert.match(html,/One revision/);assert.match(html,/before paying/);
    assert.doesNotMatch(html,/<script|<form|<iframe|<img|<input/i);
    assert.match(response.headers.get('content-security-policy'),/default-src 'none'/);
    const md=await handleRequest(new Request(origin+'/supplier-review/sample.md',{headers}),env);
    assert.match(md.headers.get('content-type'),/^text\/markdown/);
    assert.equal(await md.text(),SUPPLIER_REVIEW_SAMPLE);
    for(const id of ['S1','S2','S3','C1','C2','C3','C4','R1','R2']) assert.ok(SUPPLIER_REVIEW_SAMPLE.includes(id));
    assert.match(SUPPLIER_REVIEW_SAMPLE,/gap remains open/);
    assert.match(SUPPLIER_REVIEW_SAMPLE,/not been accepted by a customer reviewer/);
  }
});
test('offer routes implement GET/HEAD only and a scope draft never preattaches dossier contents',async()=>{
  for(const path of ['/supplier-review','/supplier-review/sample.md']) {
    const head=await handleRequest(new Request(origin+path,{method:'HEAD',headers}),{});
    assert.equal(head.status,200);assert.equal(await head.text(),'');
    const post=await handleRequest(new Request(origin+path,{method:'POST',headers}),{});
    assert.equal(post.status,405);assert.equal(post.headers.get('allow'),'GET, HEAD');
  }
  const draft=new URL(supplierScopeMailto());
  assert.equal(draft.protocol,'mailto:');
  assert.match(draft.searchParams.get('body'),/no confidential documents yet/);
  assert.doesNotMatch(draft.searchParams.get('body'),/Example Components|S1|attachment=/);
});
