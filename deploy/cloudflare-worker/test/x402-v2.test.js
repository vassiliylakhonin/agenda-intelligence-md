import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleRequest } from "../src/index.js";
import {
  executeX402,
  x402Requirements,
  encodeX402,
  decodeX402,
  x402AuthorizationSigner,
  X402_FACILITATOR,
} from "../src/x402-v2.js";
import {
  BASE_USDC_CONTRACT,
  BASE_USDC_WALLET,
  ERC20_TRANSFER_TOPIC,
} from "../src/profiles.js";
import { keccak256 } from "../src/ethsig.js";
import { memoryD1 } from "./helpers/d1.js";
const vector = JSON.parse(
  readFileSync(
    new URL("./fixtures/x402-authorization.json", import.meta.url),
    "utf8",
  ),
);
const entryVector = JSON.parse(readFileSync(new URL('./fixtures/x402-authorization-001.json',import.meta.url),'utf8'));
const url = "https://example.test/v1/agent-output/verification",
  tx = "0x" + "ab".repeat(32);
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
const request = () =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
const payload = (req, amount = 0.05) => ({
  x402Version: 2,
  accepted: x402Requirements(req, amount).accepts[0],
  payload: {
    signature: amount === 0.01 ? entryVector.signature : vector.signature,
    authorization: structuredClone(amount === 0.01 ? entryVector.authorization : vector.authorization),
  },
});
const topic = (a) => "0x" + a.slice(2).toLowerCase().padStart(64, "0");
const used =
  "0x" +
  Array.from(
    keccak256(new TextEncoder().encode("AuthorizationUsed(address,bytes32)")),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const environment = () => ({
  AGENT_PROFILE: "agent_output_verification",
  X402_STANDARD: "1",
  BILLING_MODE: "pay_per_call",
  VIZIER_DISABLED: "1",
  PAYMENT_LEDGER: memoryD1(),
});
function network(options = {}) {
  const counts = { verify: 0, settle: 0 },
    state = { confirmed: !options.pending };
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (String(url) === X402_FACILITATOR + "/verify") {
      counts.verify++;
      return Response.json({
        isValid: !options.invalid,
        payer: vector.authorization.from,
      });
    }
    if (String(url) === X402_FACILITATOR + "/settle") {
      counts.settle++;
      if (options.pending) throw new Error("uncertain broadcast");
      return Response.json({
        success: true,
        transaction: tx,
        network: "eip155:8453",
        payer: vector.authorization.from,
      });
    }
    let result;
    if (body.method === "eth_chainId") result = "0x2105";
    else if (body.method === "eth_blockNumber") result = "0x100";
    else if (body.method === "eth_getLogs")
      result = state.confirmed ? [{ transactionHash: tx }] : [];
    else if (body.method === "eth_getTransactionReceipt")
      result = state.confirmed
        ? {
            status: "0x1",
            transactionHash: tx,
            blockNumber: "0x100",
            logs: [
              {
                address: BASE_USDC_CONTRACT,
                topics: [
                  used,
                  topic(vector.authorization.from),
                  options.wrongNonce
                    ? "0x" + "00".repeat(32)
                    : vector.authorization.nonce,
                ],
                data: "0x",
              },
              {
                address: BASE_USDC_CONTRACT,
                topics: [
                  ERC20_TRANSFER_TOPIC,
                  topic(vector.authorization.from),
                  topic(BASE_USDC_WALLET),
                ],
                data: '0x'+BigInt(options.amount || '50000').toString(16),
              },
            ],
          }
        : null;
    else throw new Error("Unexpected RPC " + body.method);
    return Response.json({ jsonrpc: "2.0", id: 1, result });
  };
  return { fetch, counts, state };
}
test.beforeEach((t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2024-01-01T00:00:00Z"),
  });
});
test("public challenge and native MCP payment errors speak the standard v2 contract", async () => {
  const env = environment(),
    res = await handleRequest(request(), env);
  assert.equal(res.status, 402);
  assert.equal(decodeX402(res.headers.get("payment-required")).x402Version, 2);
  const mcp = await handleRequest(
    new Request("https://example.test/mcp/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "agent_output_verification", arguments: input },
      }),
    }),
    env,
  );
  const data = await mcp.json();
  assert.equal(data.result.isError, true);
  assert.equal(data.result.structuredContent.x402Version, 2);
  assert.deepEqual(
    JSON.parse(data.result.content[0].text),
    data.result.structuredContent,
  );
});
test("EIP-712 signer matches the independent viem vector", () => {
  assert.equal(
    x402AuthorizationSigner(payload(request())),
    vector.authorization.from.toLowerCase(),
  );
});

test('a claimed old quote replays after a price cut, while a fresh old quote cannot settle',async()=>{
  const env=environment(),mock=network(),previous=globalThis.fetch;
  globalThis.fetch=mock.fetch;
  try {
    const proof=payload(request());
    assert.equal((await executeX402(request(),input,env,0.05,proof,()=>Response.json({old_result:true}))).status,200);
    const counts={...mock.counts};
    globalThis.fetch=()=>{throw Error('Price-change replay must not access network');};
    const replay=await executeX402(request(),input,env,0.01,proof,()=>{throw Error('Must not reexecute');});
    assert.equal(replay.status,200);
    assert.equal(replay.headers.get('x-payment-replayed'),'1');
    assert.deepEqual(mock.counts,counts);
    const stale=await executeX402(request(),input,environment(),0.01,proof,()=>{throw Error('Must not execute');});
    assert.equal(stale.status,400);
    assert.equal((await stale.json()).code,'payment_terms_changed');
  } finally {globalThis.fetch=previous;}
});

test('an admitted old-price claim settles with its original terms after a price cut',async()=>{
  const env=environment(),mock=network(),previous=globalThis.fetch,proof=payload(request());
  let interrupted=false,seenAmount;
  globalThis.fetch=async(url,init)=>{
    if(String(url)===X402_FACILITATOR+'/settle') seenAmount=JSON.parse(init.body).paymentRequirements.amount;
    return mock.fetch(url,init);
  };
  try {
    const first=await executeX402(request(),input,env,0.05,proof,()=>Response.json({old_result:true}),stage=>{
      if(stage==='execution_started'&&!interrupted){interrupted=true;throw Error('synthetic interruption');}
    });
    assert.equal(first.status,503);
    const row=await env.PAYMENT_LEDGER.prepare('SELECT * FROM paid_executions').first();
    await env.PAYMENT_LEDGER.prepare('UPDATE paid_executions SET lease_until_ms = 0 WHERE tx_hash = ?1').bind(row.tx_hash).run();
    const result=await executeX402(request(),input,env,0.01,proof,()=>Response.json({old_result:true}));
    assert.equal(result.status,200);
    assert.equal(seenAmount,'50000');
    assert.equal(mock.counts.verify,1);
    assert.equal(mock.counts.settle,1);
    const claim=await env.PAYMENT_LEDGER.prepare('SELECT details FROM payment_claims WHERE tx_hash = ?1').bind(tx).first();
    assert.equal(JSON.parse(claim.details).amount_usdc,0.05);
  } finally {globalThis.fetch=previous;}
});

test('previously paid x402 routing replays after becoming free, without settling or reevaluating',async()=>{
  const env={...environment(),AGENT_PROFILE:'agenda'},mock=network(),previous=globalThis.fetch;
  const body={jsonrpc:'2.0',id:'prior-route',method:'tools/call',params:{name:'strategic_risk_triage',arguments:{text:'Synthetic routing request'}}};
  const req=()=>new Request('https://example.test/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const proof=payload(req());
  globalThis.fetch=mock.fetch;
  try {
    assert.equal((await executeX402(req(),body,env,0.05,proof,()=>Response.json({old_route:true}))).status,200);
    globalThis.fetch=()=>{throw Error('Free routing recovery must not access network');};
    const signed=req();signed.headers.set('payment-signature',encodeX402(proof));
    const replay=await handleRequest(signed,env);
    assert.equal(replay.status,200);
    assert.equal(replay.headers.get('x-payment-replayed'),'1');
    assert.deepEqual(await replay.json(),{old_route:true});
    const fresh=req();fresh.headers.set('payment-signature',encodeX402(proof));
    const refused=await handleRequest(fresh,{...environment(),AGENT_PROFILE:'agenda'});
    assert.equal(refused.status,400);
    assert.equal((await refused.json()).code,'payment_not_applicable');
  } finally {globalThis.fetch=previous;}
});
test("successful standard payment returns a recoverable result exactly once", async () => {
  const env = environment(),
    mock = network(),
    original = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    const req = request(),
      proof = payload(req);
    let evaluated = 0;
    const run = (r = req, b = input) =>
      executeX402(r, b, env, 0.05, proof, async () => {
        evaluated++;
        return Response.json({ answer: "confidential synthetic response" });
      });
    const first = await run();
    assert.equal(first.status, 200);
    assert.equal(
      decodeX402(first.headers.get("payment-response")).transaction,
      tx,
    );
    const replay = await run();
    assert.equal(replay.headers.get("x-payment-replayed"), "1");
    assert.equal(evaluated, 1);
    assert.equal(mock.counts.settle, 1);
    const rows = await env.PAYMENT_LEDGER.prepare(
      "SELECT response_ciphertext FROM paid_executions",
    ).all();
    assert.ok(!rows.results[0].response_ciphertext.includes("confidential"));
    const changed = { ...input, note: "other task" },
      r = new Request(url, { method: "POST", body: JSON.stringify(changed) });
    assert.equal((await run(r, changed)).status, 409);
    assert.equal(mock.counts.settle, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("pending settlement hides the evaluated output and reconciles without a second settle", async () => {
  const env = environment(),
    mock = network({ pending: true }),
    original = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    let evaluated = 0;
    const run = () =>
      executeX402(request(), input, env, 0.05, payload(request()), async () => {
        evaluated++;
        return Response.json({ answer: "private" });
      });
    const first = await run();
    assert.equal(first.status, 503);
    assert.ok(!(await first.text()).includes("private"));
    assert.equal((await run()).status, 503);
    assert.equal(mock.counts.settle, 1);
    assert.equal(evaluated, 1);
    mock.state.confirmed = true;
    assert.equal((await run()).status, 200);
    assert.equal(mock.counts.settle, 1);
    assert.equal(evaluated, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("a facilitator success without the correct onchain nonce never releases the result", async () => {
  const env = environment(),
    mock = network({ wrongNonce: true }),
    original = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    const result = await executeX402(
      request(),
      input,
      env,
      0.05,
      payload(request()),
      async () => Response.json({ answer: "private" }),
    );
    assert.equal(result.status, 503);
    assert.ok(!(await result.text()).includes("private"));
  } finally {
    globalThis.fetch = original;
  }
});
test("a refused authorization does not execute or settle", async () => {
  const env = environment(),
    mock = network({ invalid: true }),
    original = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    const result = await executeX402(
      request(),
      input,
      env,
      0.05,
      payload(request()),
      async () => {
        throw new Error("Must not execute");
      },
    );
    assert.equal(result.status, 402);
    assert.equal(mock.counts.settle, 0);
    assert.equal(
      (
        await env.PAYMENT_LEDGER.prepare(
          "SELECT COUNT(*) AS n FROM payment_claims",
        ).first()
      ).n,
      0,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("actual HTTP handler accepts PAYMENT-SIGNATURE", async () => {
  const env = environment(),
    mock = network({amount:'10000'}),
    original = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    const req = request();
    req.headers.set("PAYMENT-SIGNATURE", encodeX402(payload(req,0.01)));
    const res = await handleRequest(req, env);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).authorization_granted, false);
    assert.equal(mock.counts.settle, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("native MCP payment metadata is separated from input and returns settlement metadata", async () => {
  const env = environment(),
    mock = network({amount:'10000'}),
    original = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    const target = "https://example.test/mcp/agent",
      req = new Request(target, { method: "POST" }),
      proof = payload(req,0.01);
    const body = {
      jsonrpc: "2.0",
      id: "native-pay",
      method: "tools/call",
      params: {
        name: "agent_output_verification",
        arguments: input,
        _meta: { "x402/payment": proof },
      },
    };
    const call = () =>
      handleRequest(
        new Request(target, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        env,
      );
    const res = await call();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.notEqual(data.result.isError, true);
    assert.equal(data.result._meta["x402/payment-response"].transaction, tx);
    assert.equal((await call()).headers.get("x-payment-replayed"), "1");
    assert.equal(mock.counts.settle, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("parallel requests cannot evaluate or settle the same authorization twice", async () => {
  const env = environment(),
    mock = network(),
    original = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    let start,
      release,
      count = 0;
    const started = new Promise((r) => {
        start = r;
      }),
      barrier = new Promise((r) => {
        release = r;
      });
    const execute = async () => {
      count++;
      start();
      await barrier;
      return Response.json({ ok: true });
    };
    const first = executeX402(
      request(),
      input,
      env,
      0.05,
      payload(request()),
      execute,
    );
    await started;
    const second = await executeX402(
      request(),
      input,
      env,
      0.05,
      payload(request()),
      execute,
    );
    assert.equal(second.status, 409);
    release();
    assert.equal((await first).status, 200);
    assert.equal(count, 1);
    assert.equal(mock.counts.settle, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("invalid signatures, recipient, amount and networks cannot reach a facilitator", async () => {
  const env = environment(),
    original = globalThis.fetch;
  let external = 0;
  globalThis.fetch = async () => {
    external++;
    throw new Error("No network expected");
  };
  try {
    for (const mutate of [
      (p) => (p.payload.signature = "0x" + "00".repeat(65)),
      (p) => (p.payload.authorization.to = "0x" + "11".repeat(20)),
      (p) => (p.accepted.amount = "1"),
      (p) => (p.accepted.network = "eip155:1"),
    ]) {
      const proof = payload(request());
      mutate(proof);
      assert.equal(
        (
          await executeX402(request(), input, env, 0.05, proof, async () =>
            Response.json({}),
          )
        ).status,
        400,
      );
    }
    assert.equal(external, 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("evaluation failures do not settle, and a recovered identical request uses the same authorization", async () => {
  const env = environment(),
    mock = network(),
    original = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    assert.equal(
      (
        await executeX402(
          request(),
          input,
          env,
          0.05,
          payload(request()),
          async () => Response.json({ error: "unavailable" }, { status: 503 }),
        )
      ).status,
      503,
    );
    assert.equal(mock.counts.settle, 0);
    assert.equal(
      (
        await executeX402(
          request(),
          input,
          env,
          0.05,
          payload(request()),
          async () => Response.json({ ok: true }),
        )
      ).status,
      200,
    );
    assert.equal(mock.counts.settle, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("pending MCP settlement returns a tool error without a fresh payment challenge", async () => {
  const env = environment(),
    mock = network({ pending: true, amount:'10000' }),
    original = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    const url = "https://example.test/mcp/agent",
      proof = payload(new Request(url),0.01),
      body = {
        jsonrpc: "2.0",
        id: "pending-mcp",
        method: "tools/call",
        params: {
          name: "agent_output_verification",
          arguments: input,
          _meta: { "x402/payment": proof },
        },
      };
    const res = await handleRequest(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      env,
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.result.isError, true);
    assert.equal(data.result.structuredContent, undefined);
    assert.equal(data.result._meta["x402/payment-response"].success, false);
    assert.equal(
      JSON.parse(data.result.content[0].text).result_available,
      false,
    );
    assert.equal(mock.counts.settle, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("expired cached results are erased without reopening the authorization", async (t) => {
  const env = environment(),
    mock = network(),
    original = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    const run = () =>
      executeX402(request(), input, env, 0.05, payload(request()), async () =>
        Response.json({ private: "data" }),
      );
    assert.equal((await run()).status, 200);
    t.mock.timers.setTime(new Date("2024-01-03T00:00:00Z").getTime());
    assert.equal((await run()).status, 410);
    assert.equal(mock.counts.settle, 1);
    assert.equal(
      (
        await env.PAYMENT_LEDGER.prepare(
          "SELECT response_ciphertext FROM paid_executions",
        ).first()
      ).response_ciphertext,
      null,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test('legacy MCP endpoint preserves HTTP payment admission while advertising standard HTTP headers',async()=>{
 const response=await handleRequest(new Request('https://example.test/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'legacy',method:'tools/call',params:{name:'agent_output_verification',arguments:input}})}),environment());
 assert.equal(response.status,402);assert.equal(decodeX402(response.headers.get('payment-required')).x402Version,2);
});
