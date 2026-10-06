import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createDeployRequest as unsignedDeployRequest,
  envFromArgv,
  readVizierCredential,
  requestHash,
  runGatedDeploy,
  workerTargetFor
} from "../scripts/vizier-gated-deploy.js";
import { deployedEnvironments, fleetEnvironments } from "../scripts/deploy-all.js";

const TEST_GRANT = "test-owner-grant";
function createDeployRequest(metadata, env) {
  return unsignedDeployRequest(metadata, env, TEST_GRANT);
}

function responseFor(request, decision, reasonCodes = []) {
  const policyResults = [
    {
      rule_id: "test.policy",
      result: decision === "ALLOW" ? "PASS" : decision === "BLOCK" ? "FAIL" : "REVIEW",
      reason_code: reasonCodes[0] ?? null,
      details: {}
    }
  ];
  return {
    decision,
    risk_score: decision === "ALLOW" ? 0 : 0.5,
    reason_codes: reasonCodes,
    explanation: "Test decision.",
    policy_results: policyResults,
    receipt: {
      id: `vrf_${decision.toLowerCase()}`,
      created_at: "2026-08-09T15:00:00.000Z",
      request_hash: requestHash(request),
      decision,
      risk_score: decision === "ALLOW" ? 0 : 0.5,
      policy_rule_ids: ["test.policy"],
      reason_codes: reasonCodes,
      authority_provenance: "principal_signed",
      grant: { jti: "test-grant", key_id: "test-key", issuer: request.principal.id,
        subject: request.agent.id, expires_at: new Date(Date.now()+600_000).toISOString() }
    }
  };
}

test("gated deploy stops before Wrangler when Vizier requires review", async () => {
  const metadata = { commit: "a".repeat(40), dirty: false };
  const request = createDeployRequest(metadata);
  let executed = false;
  const result = await runGatedDeploy({
    grant: TEST_GRANT,
    metadata,
    apiKey: "test-secret",
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers.Authorization, "Bearer test-secret");
      return Response.json(responseFor(request, "REVIEW", ["SENSITIVE_ACTION_REVIEW"]));
    },
    execute: async () => {
      executed = true;
      return 0;
    }
  });

  assert.equal(executed, false);
  assert.deepEqual(result, {
    status: "stopped",
    decision: "REVIEW",
    reasonCodes: ["SENSITIVE_ACTION_REVIEW"],
    receiptId: "vrf_review"
  });
});

test("CI Vizier credential takes precedence without reading the local Keychain", async () => {
  let keychainRead = false;
  const credential = await readVizierCredential({
    environment: { VIZIER_API_KEY: "ci-secret" },
    readKeychain: async () => {
      keychainRead = true;
      return "local-secret";
    }
  });

  assert.equal(credential, "ci-secret");
  assert.equal(keychainRead, false);
});

test("an explicitly empty CI Vizier credential fails closed", async () => {
  await assert.rejects(
    readVizierCredential({
      environment: { VIZIER_API_KEY: "  " },
      readKeychain: async () => "local-secret"
    }),
    /VIZIER_API_KEY is empty/u
  );
});

test("gated deploy invokes Wrangler only after a validated ALLOW receipt", async () => {
  const metadata = { commit: "b".repeat(40), dirty: false };
  const request = createDeployRequest(metadata);
  let receivedReceiptId = null;
  const result = await runGatedDeploy({
    grant: TEST_GRANT,
    metadata,
    apiKey: "test-secret",
    fetchImpl: async () => Response.json(responseFor(request, "ALLOW")),
    execute: async (receiptId) => {
      receivedReceiptId = receiptId;
      return 0;
    }
  });

  assert.equal(receivedReceiptId, "vrf_allow");
  assert.deepEqual(result, {
    status: "deployed",
    decision: "ALLOW",
    reasonCodes: [],
    receiptId: "vrf_allow",
    exitCode: 0
  });
});

test("gated deploy rejects an ALLOW receipt bound to another request", async () => {
  const metadata = { commit: "c".repeat(40), dirty: false };
  const request = createDeployRequest(metadata);
  const response = responseFor(request, "ALLOW");
  response.receipt.request_hash = "d".repeat(64);
  let executed = false;

  await assert.rejects(
    runGatedDeploy({
    grant: TEST_GRANT,
      metadata,
      apiKey: "test-secret",
      fetchImpl: async () => Response.json(response),
      execute: async () => {
        executed = true;
        return 0;
      }
    }),
    /invalid response contract/u
  );
  assert.equal(executed, false);
});

test("gated deploy refuses a dirty Git worktree before calling Vizier", async () => {
  let fetched = false;
  await assert.rejects(
    runGatedDeploy({
    grant: TEST_GRANT,
      metadata: { commit: "e".repeat(40), dirty: true },
      apiKey: "test-secret",
      fetchImpl: async () => {
        fetched = true;
        return Response.json({});
      },
      execute: async () => 0
    }),
    /Commit or stash local changes/u
  );
  assert.equal(fetched, false);
});

test("gated deploy rejects an invalid commit before calling Vizier", async () => {
  let fetched = false;
  await assert.rejects(
    runGatedDeploy({
    grant: TEST_GRANT,
      metadata: { commit: "main", dirty: false },
      apiKey: "test-secret",
      fetchImpl: async () => {
        fetched = true;
        return Response.json({});
      },
      execute: async () => 0
    }),
    /full Git commit SHA/u
  );
  assert.equal(fetched, false);
});

test("gated deploy does not invoke Wrangler when Vizier blocks the target", async () => {
  const metadata = { commit: "f".repeat(40), dirty: false };
  const request = createDeployRequest(metadata);
  let executed = false;
  const result = await runGatedDeploy({
    grant: TEST_GRANT,
    metadata,
    apiKey: "test-secret",
    fetchImpl: async () => Response.json(responseFor(request, "BLOCK", ["TARGET_NOT_ALLOWED"])),
    execute: async () => {
      executed = true;
      return 0;
    }
  });

  assert.equal(executed, false);
  assert.deepEqual(result, {
    status: "stopped",
    decision: "BLOCK",
    reasonCodes: ["TARGET_NOT_ALLOWED"],
    receiptId: "vrf_block"
  });
});

test("production workflow tests without secrets before the protected deploy job", async () => {
  const workflowUrl = new URL(
    "../../../.github/workflows/deploy-agent-output-verification.yml",
    import.meta.url
  );
  const workflow = await readFile(workflowUrl, "utf8");
  const deployMarker = "\n  deploy:\n";
  const deployOffset = workflow.indexOf(deployMarker);

  assert.ok(deployOffset > 0, "workflow must define a separate deploy job");
  const testJob = workflow.slice(0, deployOffset);
  const deployJob = workflow.slice(deployOffset);

  assert.match(testJob, /\n  test:\n/u);
  assert.doesNotMatch(testJob, /secrets\.|environment:/u);
  assert.match(deployJob, /needs: test/u);
  assert.match(deployJob, /name: agent-output-verification-production/u);
  assert.match(deployJob, /VIZIER_API_KEY: \$\{\{ secrets\.VIZIER_API_KEY \}\}/u);
  assert.match(deployJob, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/u);
});

// Nine of ten environments used to ship with a plain `wrangler deploy`, so a
// receipt existed for one tenth of the fleet. Gating the rest means the target
// must follow the environment: a request that named one worker while wrangler
// shipped another would produce a valid receipt for the wrong thing.
test("the gated request names the worker the deploy will actually ship", () => {
  const metadata = { commit: "b".repeat(40), dirty: false };

  const cis = createDeployRequest(metadata, "cis-secondary-sanctions");
  assert.equal(cis.action.target, "worker:cis-secondary-sanctions-a2a");
  assert.deepEqual(cis.authority.constraints.allowed_targets, ["worker:cis-secondary-sanctions-a2a"]);

  const top = createDeployRequest(metadata, "");
  assert.equal(top.action.target, "worker:agenda-intelligence-a2a");
  assert.equal(top.agent.id, "top-level-deployer");

  // The historical default is unchanged, so the protected workflow and the
  // named npm script still mean exactly what they meant.
  assert.equal(createDeployRequest(metadata).action.target, "worker:agent-output-verification-a2a");
  assert.equal(createDeployRequest(metadata).agent.id, "agent-output-verification-deployer");

  // Every declared environment resolves; none inherits another's worker name.
  const targets = fleetEnvironments().map((item) => workerTargetFor(item.env));
  assert.equal(targets.length, 12);
  assert.equal(new Set(targets).size, 12, "two environments resolved to one worker");
});

test("an environment this repository does not declare is refused, not defaulted", () => {
  assert.equal(envFromArgv([]), "agent-output-verification");
  assert.equal(envFromArgv(["--top-level"]), "");
  assert.equal(envFromArgv(["--env", "gulf-maritime-exposure"]), "gulf-maritime-exposure");
  // A typo that fell through to the default would ship the wrong worker under
  // a receipt that validates.
  assert.throws(() => envFromArgv(["--env", "gulf-maritime"]), /declares no environment/);
  assert.throws(() => envFromArgv(["gulf-maritime-exposure"]), /--env <name> or --top-level/);
  assert.throws(() => workerTargetFor("gulf-maritime"), /declares no Worker/);
});

test("the environment list comes from wrangler.toml, not a second hand-kept list", () => {
  const toml = [
    'name = "agenda-intelligence-a2a"',
    "",
    "[[kv_namespaces]]",
    'binding = "AGENDA_USAGE"',
    "",
    "[env.one]",
    'name = "one-a2a"',
    "",
    "[env.one.vars]",
    'AGENT_PROFILE = "one"',
    "",
    "[[env.one.kv_namespaces]]",
    'binding = "AGENDA_USAGE"',
    "",
    "[env.two]",
    'name = "two-a2a"'
  ].join("\n");

  assert.deepEqual(deployedEnvironments(toml), [
    { env: "", workerName: "agenda-intelligence-a2a" },
    { env: "one", workerName: "one-a2a" },
    { env: "two", workerName: "two-a2a" }
  ]);

  // The real file: twelve environments, twelve names, no gaps.
  const live = fleetEnvironments();
  assert.equal(live.length, 12);
  assert.ok(live.every((item) => item.workerName));
});


test("missing delegation stops before network and execution", async () => {
  await assert.rejects(runGatedDeploy({ metadata: { commit: "a".repeat(40), dirty: false }, apiKey: "test",
    fetchImpl: () => assert.fail("must not fetch"), execute: () => assert.fail("must not deploy") }), /owner-signed/);
});

for (const scenario of ["unsigned", "expired", "wrong-subject"]) {
  test(`ALLOW with ${scenario} authority stops deployment`, async () => {
    const metadata = { commit: "a".repeat(40), dirty: false };
    const response = responseFor(createDeployRequest(metadata), "ALLOW");
    if (scenario === "unsigned") response.receipt.authority_provenance = "caller_asserted";
    if (scenario === "expired") response.receipt.grant.expires_at = "2020-01-01T00:00:00Z";
    if (scenario === "wrong-subject") response.receipt.grant.subject = "other-agent";
    await assert.rejects(runGatedDeploy({ metadata, apiKey: "test", grant: TEST_GRANT,
      fetchImpl: async () => Response.json(response), execute: () => assert.fail("must not deploy") }), /owner-signed delegation proof/);
  });
}

test('signing initialization is bound to the validated request and stops on REVIEW', async () => {
  const metadata = { commit: 'a'.repeat(40), dirty: false };
  const env = 'agent-financial-guard';
  const request = unsignedDeployRequest(metadata, env, TEST_GRANT, true);
  assert.equal(request.action.parameters.initialize_agent_card_signing, true);
  assert.notEqual(requestHash(request), requestHash(unsignedDeployRequest(metadata, env, TEST_GRANT)));
  const result = await runGatedDeploy({
    metadata, env, initializeSigning: true, grant: TEST_GRANT, apiKey: 'test-secret',
    fetchImpl: async (_url, init) => {
      assert.deepEqual(JSON.parse(init.body), request);
      return Response.json(responseFor(request, 'REVIEW', ['SENSITIVE_ACTION_REVIEW']));
    },
    execute: () => assert.fail('must not initialize a secret or deploy')
  });
  assert.equal(result.status, 'stopped');
});

test('signing bootstrap refuses unsupported targets before contacting Vizier', async () => {
  await assert.rejects(runGatedDeploy({
    metadata: { commit: 'a'.repeat(40), dirty: false }, env: 'agent-output-verification',
    initializeSigning: true, grant: TEST_GRANT, apiKey: 'test-secret',
    fetchImpl: () => assert.fail('must not fetch'), execute: () => assert.fail('must not execute')
  }), /target is not allowed/);
});
