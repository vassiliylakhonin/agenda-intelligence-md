import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

const origin = 'https://sanctions-index.agendamcp.dpdns.org';
const path = '/sanctions-name-index-compact.json';
const body = '{"fixture":"exact bytes"}\n';
function environment() {
  const requests = [];
  return { requests, env: {
    AGENT_PROFILE: 'cis_secondary_sanctions',
    SNAPSHOT_ASSETS: { fetch: async request => {
      requests.push(request);
      return new Response(request.method === 'HEAD' ? null : body, {
        headers: { 'content-type': 'application/json', etag: '"asset-hash"' }
      });
    }}
  }};
}

test('the actual Worker serves exact snapshot bytes to an ordinary Python client without an upstream request', async () => {
  const { env, requests } = environment();
  const response = await worker.fetch(new Request(origin + path, {
    headers: { 'User-Agent': 'Python-urllib/3.12', 'X-Client-Id': 'agenda-owner-snapshot-regression' }
  }), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), body);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.equal(response.headers.get('etag'), '"asset-hash"');
  assert.equal(response.headers.get('x-agenda-snapshot-origin'), 'worker-static-assets');
  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0].url).pathname, path);
});

test('HEAD is supported, writes are refused before accessing assets', async () => {
  const { env, requests } = environment();
  const head = await worker.fetch(new Request(origin + path, { method: 'HEAD' }), env);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await worker.fetch(new Request(origin + path, { method }), env);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
  }
  assert.equal(requests.length, 1);
});

test('snapshot host exposes no other Worker or asset paths', async () => {
  const { env, requests } = environment();
  for (const suffix of ['/mcp', '/health', '/sanctions-name-index.json', path + '/extra', '/.env']) {
    const response = await worker.fetch(new Request(origin + suffix), env);
    assert.equal(response.status, 404);
  }
  assert.equal(requests.length, 0);
});

test('other fleet hosts do not expose the binding, and a missing binding fails closed', async () => {
  const { env, requests } = environment();
  const other = await worker.fetch(new Request('https://cis-secondary-sanctions.agendamcp.dpdns.org' + path), env);
  assert.equal(other.status, 404);
  assert.equal(requests.length, 0);
  const missing = await worker.fetch(new Request(origin + path), { AGENT_PROFILE: 'cis_secondary_sanctions' });
  assert.equal(missing.status, 503);
});
