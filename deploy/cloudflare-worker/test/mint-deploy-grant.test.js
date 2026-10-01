import assert from "node:assert/strict";
import test from "node:test";
import { mintDeployGrant } from "../scripts/mint-deploy-grant.js";
import { createDeployRequest } from "../scripts/vizier-gated-deploy.js";

test("owner grant has a valid ES256 signature and exactly the deployment scope", async () => {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = { ...await crypto.subtle.exportKey("jwk", pair.privateKey), kid: "test-only" };
  const metadata = { commit: "a".repeat(40), dirty: false };
  const now = new Date("2026-09-30T00:00:00Z");
  const token = await mintDeployGrant({ metadata, signingKey: JSON.stringify(jwk), now });
  const [header, body, signature] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url")), { alg: "ES256", kid: "test-only", typ: "vizier-delegation+jws" });
  const payload = JSON.parse(Buffer.from(body, "base64url"));
  assert.equal(payload.iss, "vassiliy-lakhonin");
  assert.equal(payload.sub, "agent-output-verification-deployer");
  assert.equal(payload.aud, "https://vizier.vassiliy-lakhonin.workers.dev");
  assert.equal(payload.iat, now.getTime()/1000);
  assert.equal(payload.exp-payload.iat, 600);
  assert.deepEqual(payload.authority, createDeployRequest(metadata).authority);
  assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey,
    Buffer.from(signature, "base64url"), new TextEncoder().encode(`${header}.${body}`)), true);
  assert.notEqual(token, await mintDeployGrant({ metadata, signingKey: JSON.stringify(jwk), now }));
});

test("signer refuses dirty commits and public-only keys", async () => {
  await assert.rejects(mintDeployGrant({ metadata: { commit: "a".repeat(40), dirty: true }, signingKey: "{}" }), /clean full commit/);
  await assert.rejects(mintDeployGrant({ metadata: { commit: "a".repeat(40), dirty: false }, signingKey: '{"kty":"EC","crv":"P-256","kid":"test"}' }), /private key/);
});
