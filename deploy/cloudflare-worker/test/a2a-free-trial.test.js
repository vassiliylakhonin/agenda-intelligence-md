import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../src/index.js";
import { memoryD1 } from "./helpers/d1.js";
import { TRIAL_PROFILES } from "../src/trial-profiles.js";
const key = "com.agenda/free-trial";
const envFor = (profile) => ({
  AGENT_PROFILE: profile,
  WORKER_FREE_TRIAL: "1",
  BILLING_MODE: "pay_per_call",
  VIZIER_DISABLED: "1",
  OPENSANCTIONS_DISABLED: "1",
  PAYMENT_LEDGER: memoryD1(),
});
const origin = "https://example.test";
const headers = {
  "content-type": "application/json",
  "a2a-version": "1.0",
  "cf-connecting-ip": "192.0.2.25",
  "x-client-id": "agenda-owner-a2a-tests",
};
function envelope(operation, input = {}) {
  return {
    jsonrpc: "2.0",
    id: "trial-test",
    method: "SendMessage",
    params: {
      message: {
        messageId: crypto.randomUUID(),
        role: "ROLE_USER",
        metadata: { [key]: { operation } },
        parts:
          operation === "status"
            ? [{ text: "Check free trial availability" }]
            : [{ data: input, mediaType: "application/json" }],
      },
    },
  };
}
async function call(env, body, extraHeaders = {}) {
  const res = await handleRequest(
    new Request(origin + "/message/send", {
      method: "POST",
      headers: { ...headers, ...extraHeaders },
      body: JSON.stringify(body),
    }),
    env,
  );
  return { res, body: await res.json() };
}
async function example(env) {
  const res = await handleRequest(new Request(origin + "/v1/trial"), env);
  return (await res.json()).example_request;
}
test("A2A status and evaluation share the existing allowance for every fleet profile", async () => {
  for (const profile of Object.keys(TRIAL_PROFILES)) {
    const env = envFor(profile);
    const status = await call(env, envelope("status"));
    assert.equal(status.res.status, 200, profile);
    assert.equal(
      status.body.result.task.status.state,
      "TASK_STATE_COMPLETED",
      profile,
    );
    assert.equal(
      status.body.result.task.metadata.trial_status.availability
        .attempt_consumed,
      false,
    );
    const result = await call(env, envelope("evaluate", await example(env)));
    assert.equal(result.res.status, 200, profile);
    const task = result.body.result.task;
    assert.equal(task.status.state, "TASK_STATE_COMPLETED", profile);
    assert.equal(task.metadata.trial.completion_recorded, true);
    assert.equal(task.artifacts[0].parts[0].data.authorization_granted, false);
    assert.equal(
      (
        await env.PAYMENT_LEDGER.prepare(
          "SELECT COUNT(*) AS n FROM output_verification_trials",
        ).first()
      ).n,
      1,
    );
  }
});
test("A2A cannot escape a product allowance already used through HTTP", async () => {
  const env = envFor("agentic_interaction_trust"),
    input = await example(env);
  const first = await handleRequest(
    new Request(origin + "/v1/trial", {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    }),
    env,
  );
  assert.equal(first.status, 200);
  assert.equal((await call(env, envelope("evaluate", input))).res.status, 200);
  const exhausted = await call(env, envelope("evaluate", input));
  assert.equal(exhausted.res.status, 429);
  assert.equal(exhausted.body.error.data.code, "trial_exhausted");
  assert.equal(exhausted.body.error.data.trial.attempt_consumed, false);
});
test("invalid selector, notification, input, disabled trial and credentials reserve nothing", async () => {
  for (const mutate of [
    (body) => {
      body.params.message.metadata[key] = { operation: "paid" };
    },
    (body) => {
      delete body.id;
    },
    (body) => {
      body.params.message.parts = [{ text: "Not structured evidence" }];
    },
    (body) => {
      body.params.message.taskId = crypto.randomUUID();
    },
  ]) {
    const env = envFor("agent_output_verification"),
      body = envelope("evaluate");
    mutate(body);
    const result = await call(env, body);
    assert.ok(result.body.error);
    assert.equal(
      (
        await env.PAYMENT_LEDGER.prepare(
          "SELECT COUNT(*) AS n FROM output_verification_trials",
        ).first()
      ).n,
      0,
    );
  }
  const env = envFor("agent_output_verification");
  for (const credential of [
    "x-payment-tx",
    "x-payment-signature",
    "payment-signature",
  ]) {
    const result = await call(env, envelope("evaluate", await example(env)), {
      [credential]: "not-a-proof",
    });
    assert.ok(result.body.error);
  }
  const disabled = await call(
    { ...env, WORKER_FREE_TRIAL: "0" },
    envelope("status"),
  );
  assert.ok(disabled.body.error);
  const auth = await call(
    {
      ...env,
      AGENT_PROFILE: "cis_secondary_sanctions",
      CIS_SECONDARY_SANCTIONS_API_KEY: "expected",
    },
    envelope("status"),
  );
  assert.equal(auth.res.status, 401);
  assert.equal(
    (
      await env.PAYMENT_LEDGER.prepare(
        "SELECT COUNT(*) AS n FROM output_verification_trials",
      ).first()
    ).n,
    0,
  );
});
test("legacy A2A dialect gets a task, and ordinary unpaid evaluation remains gated", async () => {
  const env = envFor("agent_output_verification"),
    input = await example(env),
    body = envelope("evaluate", input);
  body.method = "message/send";
  body.params.message.role = "user";
  body.params.message.parts[0].kind = "data";
  const result = await call(env, body, { "a2a-version": "0.3" });
  assert.equal(result.res.status, 200);
  assert.equal(result.body.result.status.state, "completed");
  const paid = envelope("evaluate", input);
  delete paid.params.message.metadata;
  const result2 = await call(env, paid);
  assert.equal(result2.res.status, 402);
});
