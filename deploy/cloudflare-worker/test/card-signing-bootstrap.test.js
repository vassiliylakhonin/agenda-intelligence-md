import assert from 'node:assert/strict';
import test from 'node:test';
import { signCard, buildJwks } from '../src/jws.js';
import { assertSignedCard, initializeCardSigning, signingBootstrapEnvironments } from '../scripts/card-signing-bootstrap.js';

const env = 'agent-financial-guard';
const origin = 'https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev';
const unsigned = { name: 'fixture', supportedInterfaces: [{ url: origin + '/a2a' }] };
async function signedFixture() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  Object.assign(jwk, { kid: 'fixture-key', alg: 'ES256', use: 'sig' });
  return { card: { ...unsigned, signatures: [await signCard(unsigned, jwk)] }, jwks: buildJwks(jwk) };
}

test('live repro: missing card signature fails instead of accepting unsigned discovery', async () => {
  await assert.rejects(assertSignedCard(unsigned, { keys: [] }, origin), /signature/i);
});

test('signature verification detects tampered cards, wrong host and private JWKS', async () => {
  const { card, jwks } = await signedFixture();
  await assertSignedCard(card, jwks, origin);
  await assert.rejects(assertSignedCard({ ...card, name: 'tampered' }, jwks, origin), /signature/i);
  await assert.rejects(assertSignedCard(card, jwks, 'https://other.example'), /header/i);
  await assert.rejects(assertSignedCard(card, { keys: [{ ...jwks.keys[0], d: 'private' }] }, origin), /private/i);
});

test('bootstrap is restricted to the two currently unsigned workers', async () => {
  assert.deepEqual(signingBootstrapEnvironments, ['agent-financial-guard', 'm2m-escrow-arbiter']);
  await assert.rejects(initializeCardSigning('agent-output-verification', {
    runWrangler: () => assert.fail('must not run'), fetchImpl: () => assert.fail('must not fetch')
  }), /target/i);
});

test('bootstrap keeps an existing valid public key and never writes a secret', async () => {
  const fixture = await signedFixture();
  const result = await initializeCardSigning(env, {
    fetchImpl: async url => Response.json(url.includes('agent-card') ? fixture.card : fixture.jwks),
    runWrangler: () => assert.fail('must not overwrite')
  });
  assert.equal(result.status, 'already_signed');
});

for (const name of ['AGENT_CARD_SIGNING_KEY', 'AGENT_CARD_PRIVATE_JWK']) {
  test(`bootstrap refuses to replace existing ${name} even if live JWKS is empty`, async () => {
    await assert.rejects(initializeCardSigning(env, {
      fetchImpl: async url => Response.json(url.includes('agent-card') ? unsigned : { keys: [] }),
      runWrangler: async (args, input) => {
        assert.deepEqual(args, ['secret', 'list', '--env', env]);
        assert.equal(input, undefined);
        return JSON.stringify([{ name }]);
      }
    }), /existing signing credential/i);
  });
}

test('bootstrap writes only one generated key to the intended Worker through stdin', async () => {
  const calls = [];
  const result = await initializeCardSigning(env, {
    fetchImpl: async url => Response.json(url.includes('agent-card') ? unsigned : { keys: [] }),
    runWrangler: async (args, input) => {
      calls.push(args);
      if (args[1] === 'list') return JSON.stringify([{ name: 'UNRELATED_SECRET' }]);
      assert.deepEqual(args, ['secret', 'put', 'AGENT_CARD_SIGNING_KEY', '--env', env]);
      const jwk = JSON.parse(input);
      assert.equal(jwk.crv, 'P-256');
      assert.ok(jwk.d);
      const card = { ...unsigned, signatures: [await signCard(unsigned, jwk)] };
      await assertSignedCard(card, buildJwks(jwk), origin);
      return '';
    }
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(Object.keys(result).sort(), ['status', 'target']);
  assert.equal(result.status, 'initialized');
});

test('bad secret-list response or failed public fetch stops before secret put', async () => {
  await assert.rejects(initializeCardSigning(env, {
    fetchImpl: async url => Response.json(url.includes('agent-card') ? unsigned : { keys: [] }),
    runWrangler: async args => { assert.equal(args[1], 'list'); return '{}'; }
  }), /secret inventory/i);
  await assert.rejects(initializeCardSigning(env, {
    fetchImpl: async () => new Response('', { status: 503 }),
    runWrangler: () => assert.fail('must not mutate')
  }), /HTTP 503/i);
});
