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
      returned = structuredClone(example.follow_up?.response || example.response);
      await context.runProfileExample({ preventDefault() {} });
      assert.match(elements['profile-progress'].innerHTML, /Changes since previous check/, profile);
      assert.equal(requests.length, 2, profile);
      elements['profile-request'].value = '{broken';
      await context.runProfileExample({ preventDefault() {} });
      assert.equal(requests.length, 2, profile + ' invalid local JSON sends nothing');
      assert.equal(elements['profile-summary'].innerHTML, '', profile + ' stale success cleared');
      assert.equal(elements['profile-progress'].innerHTML, '', profile);
      assert.equal(elements['profile-response'].hidden, true, profile);
    }
  } finally {
    console.log = originalLog;
  }
});
