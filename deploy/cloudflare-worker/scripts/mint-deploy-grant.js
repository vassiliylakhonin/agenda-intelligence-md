// Operator-side signer; never run with Cloudflare deployment credentials.
import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { canonicalize, createDeployRequest, envFromArgv } from "./vizier-gated-deploy.js";

export async function mintDeployGrant({ metadata, signingKey, env = "agent-output-verification", now = new Date() }) {
  if (metadata.dirty || !/^[a-f0-9]{40}$/.test(metadata.commit)) throw new Error("Signer requires a clean full commit.");
  const jwk = JSON.parse(signingKey);
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d || !jwk.kid) throw new Error("Signer requires an owner ES256 private key.");
  const request = createDeployRequest(metadata, env);
  const issued = Math.floor(now.getTime()/1000);
  const payload = { iss: request.principal.id, sub: request.agent.id, aud: "https://vizier.vassiliy-lakhonin.workers.dev",
    jti: crypto.randomUUID(), iat: issued, exp: issued+600, authority: request.authority };
  const header = Buffer.from(canonicalize({ alg: "ES256", kid: jwk.kid, typ: "vizier-delegation+jws" })).toString("base64url");
  const body = Buffer.from(canonicalize(payload)).toString("base64url");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${Buffer.from(signature).toString("base64url")}`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "--out" || !args[1]) throw new Error("Use --out <operator-owned grant file> [--env <name>].");
  const env = envFromArgv(args.slice(2));
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
  const signingKey = process.env.VIZIER_DELEGATION_SIGNING_KEY;
  if (!signingKey) throw new Error("Owner signing key is required in the signer step.");
  const grant = await mintDeployGrant({ metadata: { commit, dirty }, signingKey, env });
  await writeFile(args[1], grant+'\n', { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ event: "vizier.deploy_grant.minted", target: createDeployRequest({ commit, dirty }, env).action.target,
    git_commit: commit, ttl_seconds: 600 }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Deployment grant could not be minted; stop before deployment."); process.exitCode = 1; });
}
