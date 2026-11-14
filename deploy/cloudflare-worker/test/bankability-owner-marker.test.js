import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { handleRequest } from '../src/index.js';

const origin = 'https://bankability.example';
const env = { AGENT_PROFILE: 'agenda', BILLING_MODE: 'pay_per_call', VIZIER_DISABLED: '1' };

// The bankability page auto-runs a live free screen on load. An unlabelled
// browser visit therefore consumed an "external" preview and inflated demand
// counters (observed 2026-11-14). The page must propagate the maintainer
// marker from ?owner_test=1 to that automatic request, the same way the
// landing console and REST test console already do.
function makeElement(values) {
  return {
    value: values?.value ?? '',
    checked: values?.checked ?? false,
    disabled: false,
    hidden: false,
    innerText: '',
    innerHTML: '',
    textContent: '',
    style: {},
    children: [],
    appendChild(child) { this.children.push(child); },
    click() { if (this.onclick) return this.onclick(); },
  };
}

async function autoRunRequests(pageUrl) {
  const response = await handleRequest(new Request(pageUrl, { headers: { accept: 'text/html' } }), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('agendaTelemetryHeaders("/v1/corridor-bankability/screen"'), 'screen fetch routes through agendaTelemetryHeaders');

  const formValues = {
    projectName: 'Synthetic Owner Check',
    corridorLeg: 'Aktau-Baku',
    capexUsdM: '10',
    ifiDebtUsdM: '5',
    dscrMin: '1.4',
  };
  const elements = new Map();
  const requests = [];
  const context = {
    URL,
    console,
    navigator: { userAgent: 'HeadlessChrome/126.0.0.0' },
    location: new URL(pageUrl),
    window: { location: new URL(pageUrl), crypto: globalThis.crypto },
    crypto: globalThis.crypto,
    alert: () => {},
    fetch: async (url, init = {}) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        bankability_status: 'UNKNOWN',
        financial_metrics: { dscr_minimum: 1.5, debt_share_pct: 50 },
        corridor_bottleneck_analysis: { bottleneck_description: 'synthetic' },
        covenant_checks: [],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
    document: {
      getElementById: id => {
        if (!elements.has(id)) elements.set(id, makeElement({ value: formValues[id] ?? '' }));
        return elements.get(id);
      },
      createElement: () => makeElement(),
    },
  };
  for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInNewContext(script, context);
  // The last statement of the page script auto-runs the free screen on load.
  await new Promise(resolve => setTimeout(resolve, 0));
  return requests.filter(r => String(r.url).includes('/v1/corridor-bankability/screen'));
}

test('bankability page auto-run carries the owner marker when the page URL has ?owner_test=1', async () => {
  const calls = await autoRunRequests(origin + '/corridor-bankability?owner_test=1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers['x-client-id'], 'agenda-owner-manual');
  assert.equal(calls[0].init.headers['x-agenda-client-surface'], 'web-console-v1');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
});

test('bankability page auto-run stays unlabelled for ordinary visitors', async () => {
  const calls = await autoRunRequests(origin + '/corridor-bankability');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers['x-client-id'], undefined);
});
