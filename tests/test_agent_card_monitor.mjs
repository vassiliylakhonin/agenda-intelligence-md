import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {verifyAgentCard} from '../scripts/verify_agent_card.mjs';
import {signCard, publicJwkFromPrivate} from '../deploy/cloudflare-worker/src/jws.js';
import {handleRequest} from '../deploy/cloudflare-worker/src/index.js';
import {TRIAL_PROFILES} from '../deploy/cloudflare-worker/src/trial-profiles.js';

const origin = 'https://fixture.agendamcp.dpdns.org';
function key(kid = 'fixture-key') {
  return {...generateKeyPairSync('ec', {namedCurve:'prime256v1'}).privateKey.export({format:'jwk'}), kid};
}
async function fixture() {
  const privateKey = key();
  const card = {name:'Synthetic card', version:'1', skills:[], supportedInterfaces:[{url:origin+'/message/send', protocolBinding:'JSONRPC'}]};
  card.signatures = [await signCard(card, privateKey)];
  return {origin, card, jwks:{keys:[publicJwkFromPrivate(privateKey)]}, privateKey};
}
const clone = structuredClone;

test('verifies an actual ES256 card and rejects a changed payload using Node crypto', async () => {
  const f = await fixture();
  assert.deepEqual(verifyAgentCard(f), {passed:true, algorithm:'ES256', verified_signatures:1,
    tampered_card_rejected:true, key_source:'configured_origin_jwks'});
  f.card.supportedInterfaces[0].url += '/changed';
  assert.deepEqual(verifyAgentCard(f), {passed:false, reason:'invalid_signature'});
});

test('verifies all twelve real Worker card serializers without making a network call', async () => {
  const privateKey = key(), jwks = {keys:[publicJwkFromPrivate(privateKey)]};
  const log = console.log;
  console.log = () => {};
  try {
    for (const profile of Object.keys(TRIAL_PROFILES)) {
      const response = await handleRequest(new Request(origin+'/.well-known/agent-card.json', {
        headers:{'X-Client-Id':'agenda-owner-card-monitor-test'}
      }), {AGENT_PROFILE:profile, AGENT_CARD_SIGNING_KEY:JSON.stringify(privateKey)});
      assert.equal(response.status, 200);
      assert.equal(verifyAgentCard({origin, card:await response.json(), jwks}).passed, true, profile);
    }
  } finally {console.log = log;}
});

test('missing, altered and malformed signatures fail closed', async () => {
  const f = await fixture();
  for (const signatures of [undefined, [], {}, Array(5).fill(f.card.signatures[0]), [{protected:'???', signature:'x'}]]) {
    const input = clone(f);input.card.signatures = signatures;
    assert.equal(verifyAgentCard(input).passed, false);
  }
  const input = clone(f), raw = Buffer.from(input.card.signatures[0].signature, 'base64url');
  raw[0] ^= 1;input.card.signatures[0].signature = raw.toString('base64url');
  assert.equal(verifyAgentCard(input).reason, 'invalid_signature');
});

test('does not accept another algorithm, critical extension or a card-directed key URL', async () => {
  const f = await fixture();
  const header = JSON.parse(Buffer.from(f.card.signatures[0].protected, 'base64url').toString());
  for (const [change, reason] of [
    [{alg:'none'}, 'unsupported_algorithm'], [{alg:'HS256'}, 'unsupported_algorithm'],
    [{crit:['custom']}, 'unsupported_critical_header'], [{b64:false}, 'unsupported_critical_header'],
    [{jku:'https://untrusted.test/keys'}, 'untrusted_key_url'],
    [{jku:origin+'/.well-known/jwks.json?token=x'}, 'untrusted_key_url'],
    [{jku:origin+'/.well-known/jwks.json#key'}, 'untrusted_key_url'],
    [{kid:'unknown'}, 'unknown_key_id']
  ]) {
    const input = clone(f);
    input.card.signatures[0].protected = Buffer.from(JSON.stringify({...header, ...change})).toString('base64url');
    assert.deepEqual(verifyAgentCard(input), {passed:false, reason});
  }
});

test('requires unique key IDs, public P-256 verification keys and bounded key sets', async () => {
  const f = await fixture();
  for (const keys of [[], [f.jwks.keys[0], f.jwks.keys[0]], [f.privateKey], Array(17).fill(f.jwks.keys[0]),
    [{...f.jwks.keys[0], crv:'P-384'}], [{...f.jwks.keys[0], key_ops:['sign']}],
    [{...f.jwks.keys[0], use:'enc'}], [{...f.jwks.keys[0], alg:'HS256'}], [{...f.jwks.keys[0], x:'AA'}]]) {
    assert.equal(verifyAgentCard({...f, jwks:{keys}}).passed, false);
  }
  const wrong = key(f.privateKey.kid);
  assert.equal(verifyAgentCard({...f, jwks:{keys:[publicJwkFromPrivate(wrong)]}}).passed, false);
});

test('supports overlapping rotation only when every published signature has a current valid key', async () => {
  const f = await fixture(), next = key('next-key');
  f.card.signatures.push(await signCard(f.card, next));f.jwks.keys.push(publicJwkFromPrivate(next));
  assert.equal(verifyAgentCard(f).verified_signatures, 2);
  f.jwks.keys.shift();
  assert.deepEqual(verifyAgentCard(f), {passed:false, reason:'unknown_key_id'});
});

test('CLI accepts only bounded JSON input and returns a finite failure without source contents', async () => {
  const f = await fixture();
  for (const [input, expected] of [[JSON.stringify(f), true], ['{"private":"source-material"', false], ['x'.repeat(2_100_001), false]]) {
    const result = spawnSync(process.execPath, ['scripts/verify_agent_card.mjs'], {input, encoding:'utf8', maxBuffer:10000});
    assert.equal(JSON.parse(result.stdout).passed, expected);
    assert.equal(result.status, expected ? 0 : 1);
    assert.ok(!result.stdout.includes('source-material'));
  }
});
