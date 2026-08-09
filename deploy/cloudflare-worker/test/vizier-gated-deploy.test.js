import assert from "node:assert/strict";
import test from "node:test";

import {
  createDeployRequest,
  requestHash,
  runGatedDeploy
} from "../scripts/vizier-gated-deploy.js";

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
      reason_codes: reasonCodes
    }
  };
}

test("gated deploy stops before Wrangler when Vizier requires review", async () => {
  const metadata = { commit: "a".repeat(40), dirty: false };
  const request = createDeployRequest(metadata);
  let executed = false;
  const result = await runGatedDeploy({
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

test("gated deploy invokes Wrangler only after a validated ALLOW receipt", async () => {
  const metadata = { commit: "b".repeat(40), dirty: false };
  const request = createDeployRequest(metadata);
  let receivedReceiptId = null;
  const result = await runGatedDeploy({
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
