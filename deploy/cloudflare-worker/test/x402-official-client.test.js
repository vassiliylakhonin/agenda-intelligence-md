import {routingToolForProfile, evaluationAmount} from '../src/pricing-policy.js';
import test from "node:test";
import assert from "node:assert/strict";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { x402MCPClient } from "@x402/mcp";
import { privateKeyToAccount } from "viem/accounts";
import { handleRequest } from "../src/index.js";
import { memoryD1 } from "./helpers/d1.js";
import { decodeX402, X402_FACILITATOR } from "../src/x402-v2.js";
import {
  BASE_USDC_CONTRACT,
  BASE_USDC_WALLET,
  ERC20_TRANSFER_TOPIC,
} from "../src/profiles.js";
import { keccak256 } from "../src/ethsig.js";
import {
  reviewSignedOutput,
  outputPaymentPolicy,
} from "../../../examples/output-verification/agent-loop.mjs";
const receiptKeys = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const receiptKey = JSON.stringify(
  await crypto.subtle.exportKey("jwk", receiptKeys.privateKey),
);
const tx = "0x" + "cd".repeat(32),
  topic = (a) => "0x" + a.slice(2).toLowerCase().padStart(64, "0");
const used =
  "0x" +
  Array.from(
    keccak256(new TextEncoder().encode("AuthorizationUsed(address,bytes32)")),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const input = {
  claims: [
    {
      claim_id: "c1",
      claim: "Record active",
      support_level: "direct",
      evidence_ids: ["e1"],
    },
  ],
  evidence: [{ evidence_id: "e1", content: "Record active" }],
};
const environment = () => ({
  AGENT_PROFILE: "agent_output_verification",
  X402_STANDARD: "1",
  BILLING_MODE: "pay_per_call",
  VIZIER_DISABLED: "1",
  PAYMENT_LEDGER: memoryD1(),
  OUTPUT_EVALUATION_RECEIPTS: "1",
  AGENT_CARD_SIGNING_KEY: receiptKey,
});
// Public synthetic key. Everything below is offline; unknown egress fails.
const paymentClient = () =>
  new x402Client().register(
    "eip155:8453",
    new ExactEvmScheme(privateKeyToAccount("0x" + "11".repeat(32))),
  );
function mockNetwork() {
  let authorization,
    settles = 0;
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (String(url) === X402_FACILITATOR + "/verify") {
      assert.equal(
        body.paymentPayload.resource,
        undefined,
        "Do not disclose URLs, queries or source metadata to the facilitator",
      );
      authorization = body.paymentPayload.payload.authorization;
      return Response.json({ isValid: true, payer: authorization.from });
    }
    if (String(url) === X402_FACILITATOR + "/settle") {
      settles++;
      return Response.json({
        success: true,
        transaction: tx,
        network: "eip155:8453",
        payer: authorization.from,
      });
    }
    let result;
    if (body.method === "eth_chainId") result = "0x2105";
    else if (body.method === "eth_blockNumber") result = "0x100";
    else if (body.method === "eth_getTransactionReceipt")
      result = {
        status: "0x1",
        transactionHash: tx,
        blockNumber: "0x100",
        logs: [
          {
            address: BASE_USDC_CONTRACT,
            topics: [used, topic(authorization.from), authorization.nonce],
            data: "0x",
          },
          {
            address: BASE_USDC_CONTRACT,
            topics: [
              ERC20_TRANSFER_TOPIC,
              topic(authorization.from),
              topic(BASE_USDC_WALLET),
            ],
            data: "0x" + BigInt(authorization.value).toString(16),
          },
        ],
      };
    else throw new Error("Unmocked egress " + url);
    return Response.json({ jsonrpc: "2.0", id: 1, result });
  };
  return { fetch, settles: () => settles };
}
test("official @x402/fetch signs, retries the real handler and recovers one result", async () => {
  const env = environment(),
    network = mockNetwork(),
    previous = globalThis.fetch;
  globalThis.fetch = network.fetch;
  try {
    let calls = 0,
      retained;
    const localFetch = async (input, init) => {
      calls++;
      const req = new Request(input, init);
      if (req.headers.has("payment-signature")) retained = req.clone();
      return handleRequest(req, env);
    };
    const fetchWithPayment = wrapFetchWithPayment(localFetch, paymentClient());
    const response = await fetchWithPayment(
      "https://example.test/v1/agent-output/verification",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    assert.equal(response.status, 200);
    assert.equal(
      decodeX402(response.headers.get("payment-response")).success,
      true,
    );
    assert.equal((await response.json()).authorization_granted, false);
    assert.equal(calls, 2);
    assert.equal(network.settles(), 1);
    assert.equal(
      (await handleRequest(retained, env)).headers.get("x-payment-replayed"),
      "1",
    );
    assert.equal(network.settles(), 1);
  } finally {
    globalThis.fetch = previous;
  }
});
test("official @x402/mcp recognizes PaymentRequired and retries using native payment metadata", async () => {
  const env = environment(),
    network = mockNetwork(),
    previous = globalThis.fetch;
  globalThis.fetch = network.fetch;
  try {
    let calls = 0,
      approved = 0;
    const wireClient = {
      async callTool(params) {
        calls++;
        const response = await handleRequest(
          new Request("https://example.test/mcp/agent", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: calls,
              method: "tools/call",
              params,
            }),
          }),
          env,
        );
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.ok(body.result);
        return body.result;
      },
    };
    const budget = outputPaymentPolicy({
      payTo: BASE_USDC_WALLET,
      expectedIssuer: "https://example.test",
    });
    const client = new x402MCPClient(wireClient, paymentClient(), {
      autoPayment: true,
      onPaymentRequested: ({ paymentRequired }) => {
        approved++;
        return budget({ paymentRequired });
      },
    });
    const result = await client.callTool("agent_output_verification", input);
    assert.equal(result.isError, false);
    assert.equal(result.paymentMade, true);
    assert.equal(result.paymentResponse.success, true);
    assert.equal(calls, 2);
    assert.equal(approved, 1);
    assert.equal(network.settles(), 1);
    const verification = await reviewSignedOutput(input, {
      mode: "paid",
      expectedIssuer: "https://example.test",
      paidClient: { callTool: async () => result },
      fetchImpl: async (url, init) =>
        handleRequest(new Request(url, init), env),
    });
    assert.equal(verification.valid, true);
    assert.equal(verification.evaluation.human_review_required, true);
    assert.equal(verification.authorization_granted, false);
  } finally {
    globalThis.fetch = previous;
  }
});
test("signing failure never settles an otherwise valid x402 authorization", async () => {
  const env=environment();delete env.AGENT_CARD_SIGNING_KEY;
  const network=mockNetwork(),previous=globalThis.fetch;globalThis.fetch=network.fetch;
  try {
    const wrapped=wrapFetchWithPayment((url,init)=>handleRequest(new Request(url,init),env),paymentClient());
    const response=await wrapped('https://example.test/v1/agent-output/verification',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
    assert.equal(response.status,503);assert.equal(network.settles(),0);
    assert.equal((await response.json()).verdict,undefined);
  } finally {globalThis.fetch=previous;}
});

test("a denied MCP wallet policy makes no payment attempt", async () => {
  const env = environment();
  let calls = 0;
  const wireClient = {
    async callTool(params) {
      calls++;
      const response = await handleRequest(
        new Request("https://example.test/mcp/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: calls,
            method: "tools/call",
            params,
          }),
        }),
        env,
      );
      return (await response.json()).result;
    },
  };
  const client = new x402MCPClient(wireClient, paymentClient(), {
    autoPayment: true,
    onPaymentRequested: () => false,
  });
  await assert.rejects(
    client.callTool("agent_output_verification", input),
    /denied/,
  );
  assert.equal(calls, 1);
});
test("official native MCP payment completes the published operation for all twelve profiles", async () => {
  const profiles = [
    "agenda",
    "kazakhstan",
    "cis_secondary_sanctions",
    "agentic_interaction_trust",
    "agent_output_verification",
    "gulf_maritime_exposure",
    "market_entry_readiness",
    "critical_minerals_due_diligence",
    "dual_use_technology_export",
    "agent_financial_guard",
    "m2m_escrow_arbiter",
    "corridor_sanctions_assistant",
  ];
  for (const profile of profiles) {
    const env = {
        ...environment(),
        AGENT_PROFILE: profile,
        WORKER_FREE_TRIAL: "1",
        OPENSANCTIONS_DISABLED: "1",
      },
      network = mockNetwork(),
      previous = globalThis.fetch;
    globalThis.fetch = network.fetch;
    try {
      const terms = await (
        await handleRequest(new Request("https://example.test/v1/trial"), env)
      ).json();
      let calls = 0;
      const wireClient = {
        async callTool(params) {
          calls++;
          const response = await handleRequest(
            new Request("https://example.test/mcp/agent", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: calls,
                method: "tools/call",
                params,
              }),
            }),
            env,
          );
          assert.equal(response.status, 200, profile);
          return (await response.json()).result;
        },
      };
      const client = new x402MCPClient(wireClient, paymentClient(), {
        autoPayment: true,
        onPaymentRequested: ({ paymentRequired }) =>
          paymentRequired.accepts[0].amount ===
          String(evaluationAmount(profile,terms.tool)*1e6),
      });
      const result = await client.callTool(terms.tool, terms.example_request);
      assert.equal(
        result.isError,
        false,
        profile + ": " + JSON.stringify(result),
      );
      assert.equal(Boolean(result.paymentMade), !routingToolForProfile(profile), profile);
      assert.equal(network.settles(), routingToolForProfile(profile)?0:1, profile);
    } finally {
      globalThis.fetch = previous;
    }
  }
});
