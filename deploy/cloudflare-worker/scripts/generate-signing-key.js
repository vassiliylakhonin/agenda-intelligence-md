#!/usr/bin/env node
// One-shot ES256 keypair generator for A2A agent card signing.
//
// Usage:
//   node scripts/generate-signing-key.js
//
// Prints three blocks to stdout:
//   1. The PRIVATE JWK (paste into `wrangler secret put AGENT_CARD_SIGNING_KEY`
//      for each env that should serve signed cards).
//   2. The PUBLIC JWK (informational — JWKS endpoint derives it at runtime
//      from the private key, so no separate config needed).
//   3. The KID (paste into `wrangler.toml` as `[env.<...>.vars] AGENT_CARD_SIGNING_KID = "..."`
//      if you want stable kid across deploys; otherwise the kid baked into the
//      private JWK is used).
//
// Run once per worker family. To rotate, re-run and re-set the secret; the new
// kid will appear in /.well-known/jwks.json automatically.

import { webcrypto, randomUUID } from "node:crypto";

const { publicKey, privateKey } = await webcrypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);

const privateJwk = await webcrypto.subtle.exportKey("jwk", privateKey);
const publicJwk = await webcrypto.subtle.exportKey("jwk", publicKey);

const kid = `agenda-intelligence-md-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
for (const jwk of [privateJwk, publicJwk]) {
  jwk.kid = kid;
  jwk.alg = "ES256";
  jwk.use = "sig";
}

console.log("=== PRIVATE JWK (run: wrangler secret put AGENT_CARD_SIGNING_KEY) ===");
console.log(JSON.stringify(privateJwk));
console.log("");
console.log("=== PUBLIC JWK (informational; /.well-known/jwks.json derives this at runtime) ===");
console.log(JSON.stringify(publicJwk));
console.log("");
console.log("=== KID ===");
console.log(kid);
console.log("");
console.log("Next steps:");
console.log("  1. cd deploy/cloudflare-worker");
console.log("  2. For each env you want signed cards on (default + middle-corridor-deal-risk-gate + cis-secondary-sanctions):");
console.log("     npx wrangler secret put AGENT_CARD_SIGNING_KEY");
console.log("     npx wrangler secret put AGENT_CARD_SIGNING_KEY --env middle-corridor-deal-risk-gate");
console.log("     npx wrangler secret put AGENT_CARD_SIGNING_KEY --env cis-secondary-sanctions");
console.log("     (Paste the PRIVATE JWK above when prompted.)");
console.log("  3. npx wrangler deploy && npx wrangler deploy --env middle-corridor-deal-risk-gate && ...");
console.log("  4. curl https://<worker>/.well-known/jwks.json — should show the PUBLIC JWK.");
console.log("  5. curl https://<worker>/.well-known/agent-card.json | jq .signature — should be a compact detached JWS.");
