import { readBoundedJson } from "./request-body.js";
import {isMcpClientPath} from './mcp-client-path.js';
// x402 v2 exact / EIP-3009, Base native USDC, HTTP and MCP transports.
// Payment authorizes only a transfer, not an action or evidence clearance.
import {
  BASE_USDC_CONTRACT,
  BASE_USDC_WALLET,
  BASE_RPC_URL,
  ERC20_TRANSFER_TOPIC,
} from "./profiles.js";
import { keccak256, hexToBytes, recoverDigestAddress } from "./ethsig.js";
import { jcs } from "./jws.js";
import {
  tokenHash,
  paymentLedger,
  claimPayment,
  readPayment,
} from "./payment-ledger.js";
import {
  paidRequestHash,
  withPaidContext,
  seal,
  unseal,
  boundedResponse,
  restored,
} from "./paid-execution.js";
const NETWORK = "eip155:8453",
  TTL = 86400000,
  LEASE = 120000;
export const X402_FACILITATOR = "https://facilitator.payai.network";
export const x402Enabled = (env) => env?.X402_STANDARD === "1";
const hex = (bytes) =>
  "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const hash = (text) => keccak256(new TextEncoder().encode(text));
const word = (value) =>
  hexToBytes("0x" + BigInt(value).toString(16).padStart(64, "0"));
const address = (value) =>
  hexToBytes("0x" + value.slice(2).toLowerCase().padStart(64, "0"));
const concat = (...parts) => {
  const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    bytes.set(p, offset);
    offset += p.length;
  }
  return bytes;
};
const addressOK = (value) =>
  typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
const txOK = (value) =>
  typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
const topicAddress = (value) =>
  "0x" + value.slice(2).toLowerCase().padStart(64, "0");
const USED_TOPIC = hex(hash("AuthorizationUsed(address,bytes32)"));
export function encodeX402(value) {
  return btoa(
    String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))),
  );
}
export function decodeX402(value) {
  if (
    typeof value !== "string" ||
    value.length > 16384 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    throw new Error("invalid_payment_payload");
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(atob(value), (c) => c.charCodeAt(0)),
    ),
  );
}
export function x402Requirements(request, minimum) {
  return {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url: request.url,
      mimeType: "application/json",
      description: "Supplied-evidence review; human review required",
    },
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        amount: String(Math.round(minimum * 1e6)),
        asset: BASE_USDC_CONTRACT,
        payTo: BASE_USDC_WALLET,
        maxTimeoutSeconds: 120,
        extra: { name: "USD Coin", version: "2" },
      },
    ],
  };
}
export function x402RequiredResponse(request, body, minimum, legacyResponse) {
  const required = x402Requirements(request, minimum),
    headers = new Headers(legacyResponse.headers);
  headers.set("PAYMENT-REQUIRED", encodeX402(required));
  headers.set(
    "access-control-expose-headers",
    "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Payment-Trace-Id, X-Payment-Attempt-Id",
  );
  headers.set("cache-control", "no-store");
  if (
    isMcpClientPath(new URL(request.url).pathname) &&
    body?.method === "tools/call"
  ) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: body.id,
        result: {
          isError: true,
          structuredContent: required,
          content: [{ type: "text", text: JSON.stringify(required) }],
          _meta: {
            "com.agenda/admission": {
              evaluated: false,
              admission_status: 402,
              next_step:
                "For a free first check, discover free_trial_status and free_trial. Inspect any separate paid price with the wallet owner; payment must not be automatic without an authorized budget.",
            },
          },
        },
      },
      { status: 200, headers },
    );
  }
  return new Response(legacyResponse.body, {
    status: legacyResponse.status,
    headers,
  });
}
export function x402AuthorizationSigner(payload) {
  const a = payload.payload.authorization;
  const domain = keccak256(
    concat(
      hash(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
      ),
      hash("USD Coin"),
      hash("2"),
      word(8453),
      address(BASE_USDC_CONTRACT),
    ),
  );
  const message = keccak256(
    concat(
      hash(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)",
      ),
      address(a.from),
      address(a.to),
      word(a.value),
      word(a.validAfter),
      word(a.validBefore),
      hexToBytes(a.nonce),
    ),
  );
  return recoverDigestAddress(
    keccak256(concat(new Uint8Array([25, 1]), domain, message)),
    payload.payload.signature,
  );
}
export function validateX402Payload(payload, required) {
  const a = payload?.payload?.authorization,
    r = required.accepts[0],
    accepted = payload?.accepted;
  if (
    payload?.x402Version !== 2 ||
    !accepted ||
    jcs(accepted) !== jcs(r) ||
    (payload.resource && payload.resource.url !== required.resource.url) ||
    !a ||
    !addressOK(a.from) ||
    !addressOK(a.to) ||
    a.to.toLowerCase() !== r.payTo.toLowerCase() ||
    a.value !== r.amount ||
    !txOK(a.nonce) ||
    !["value", "validAfter", "validBefore"].every(
      (k) =>
        typeof a[k] === "string" &&
        /^(0|[1-9][0-9]{0,77})$/.test(a[k]) &&
        BigInt(a[k]) < 2n ** 256n,
    ) ||
    !/^0x[0-9a-fA-F]{130}$/.test(payload.payload.signature || "")
  )
    throw new Error("invalid_payment_payload");
  if (x402AuthorizationSigner(payload) !== a.from.toLowerCase())
    throw new Error("invalid_payment_signature");
  return a;
}
async function rpc(env, method, params) {
  const res = await fetch(env.BASE_RPC_URL || BASE_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  const value = await readBoundedJson(res);
  if (!res.ok || value.error || !Object.hasOwn(value, "result"))
    throw new Error("chain_unavailable");
  return value.result;
}
async function facilitator(path, payload, required) {
  const res = await fetch(X402_FACILITATOR + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      x402Version: 2,
      paymentPayload: {
        x402Version: 2,
        accepted: required.accepts[0],
        payload: {
          signature: payload.payload.signature,
          authorization: Object.fromEntries(
            ["from", "to", "value", "validAfter", "validBefore", "nonce"].map(
              (key) => [key, payload.payload.authorization[key]],
            ),
          ),
        },
      },
      paymentRequirements: required.accepts[0],
    }),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  const value = await readBoundedJson(res);
  return { ok: res.ok, value };
}
async function confirmed(env, tx, a, fromBlock) {
  const receipt = await rpc(env, "eth_getTransactionReceipt", [tx]);
  if (
    !receipt ||
    receipt.status !== "0x1" ||
    !txOK(receipt.transactionHash) ||
    receipt.transactionHash.toLowerCase() !== tx.toLowerCase() ||
    BigInt(receipt.blockNumber) < BigInt(fromBlock)
  )
    return false;
  const logs = (receipt.logs || []).filter(
    (log) =>
      !log.removed &&
      log.address?.toLowerCase() === BASE_USDC_CONTRACT.toLowerCase(),
  );
  return (
    logs.some(
      (log) =>
        log.topics?.[0]?.toLowerCase() === USED_TOPIC &&
        log.topics?.[1]?.toLowerCase() === topicAddress(a.from) &&
        log.topics?.[2]?.toLowerCase() === a.nonce.toLowerCase(),
    ) &&
    logs.some(
      (log) =>
        log.topics?.[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC &&
        log.topics?.[1]?.toLowerCase() === topicAddress(a.from) &&
        log.topics?.[2]?.toLowerCase() === topicAddress(BASE_USDC_WALLET) &&
        BigInt(log.data || "0x0") === BigInt(a.value),
    )
  );
}
async function findSettlement(env, a, fromBlock) {
  const latest = BigInt(await rpc(env, "eth_blockNumber", [])),
    start = BigInt(fromBlock),
    end = latest < start + 5000n ? latest : start + 5000n;
  const logs = await rpc(env, "eth_getLogs", [
    {
      address: BASE_USDC_CONTRACT,
      fromBlock: "0x" + start.toString(16),
      toBlock: "0x" + end.toString(16),
      topics: [USED_TOPIC, topicAddress(a.from), a.nonce],
    },
  ]);
  if (
    !Array.isArray(logs) ||
    logs.length !== 1 ||
    logs[0].removed ||
    !txOK(logs[0].transactionHash)
  )
    return null;
  return logs[0].transactionHash.toLowerCase();
}
async function deliver(request, row, signature, details, replay) {
  const settlement = {
    success: true,
    transaction: details.transaction,
    network: NETWORK,
    payer: details.payer,
  };
  const stored = await unseal(row.response_ciphertext, signature);
  if (new URL(request.url).pathname.startsWith("/mcp")) {
    const body = JSON.parse(stored.body);
    if (body.result) {
      body.result._meta = {
        ...body.result._meta,
        "x402/payment-response": settlement,
      };
      stored.body = JSON.stringify(body);
    }
  }
  const response = restored(stored, replay),
    headers = new Headers(response.headers);
  headers.set("PAYMENT-RESPONSE", encodeX402(settlement));
  headers.set(
    "access-control-expose-headers",
    "PAYMENT-RESPONSE, X-Payment-Replayed, X-Payment-Trace-Id, X-Payment-Attempt-Id",
  );
  return new Response(response.body, { status: response.status, headers });
}
export async function executeX402(
  request,
  body,
  env,
  minimum,
  payload,
  execute,
  emit = () => {},
  {replayOnly = false} = {},
) {
  const fail = (status, code, extra = {}) => {
    emit("payment_rejected", code, status);
    return Response.json(
      { code, error: code, ...extra },
      { status, headers: { "cache-control": "no-store" } },
    );
  };
  let db, key, lease, details, row;
  const required = x402Requirements(request, minimum);
  // Validate signed terms independently of today's price, then bind them to
  // an existing claim. Only a new authorization must match the current quote.
  // This preserves exact-request recovery after a price change without
  // settling an unclaimed, stale quote.
  const offered = {...required,accepts:[{...required.accepts[0],
    amount:payload?.accepted?.amount ?? required.accepts[0].amount}]};
  let a;
  try {
    a = validateX402Payload(payload, offered);
  } catch (error) {
    return fail(400, error.message);
  }
  const signature = payload.payload.signature.toLowerCase(),
    requestHash = await paidRequestHash(request, body);
  try {
    db = paymentLedger(env);
    key =
      "x402:" +
      (await tokenHash(
        NETWORK +
          ":" +
          BASE_USDC_CONTRACT.toLowerCase() +
          ":" +
          a.from.toLowerCase() +
          ":" +
          a.nonce.toLowerCase(),
      ));
    const proofHash = await tokenHash(jcs({ authorization: a, signature }));
    details = await readPayment(env, key);
    if (!details) {
      if (replayOnly) return fail(400,'payment_not_applicable');
      if (a.value !== required.accepts[0].amount) return fail(400,'payment_terms_changed',{
        instruction:'Obtain the current challenge for this exact request before authorizing a payment.'});
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (
        BigInt(a.validAfter) >= now ||
        BigInt(a.validBefore) <= now ||
        BigInt(a.validBefore) > now + 150n
      )
        return fail(400, "payment_window_invalid");
      const verify = await facilitator("/verify", payload, required);
      if (
        !verify.ok ||
        verify.value.isValid !== true ||
        (verify.value.payer &&
          verify.value.payer.toLowerCase() !== a.from.toLowerCase())
      )
        return fail(402, "payment_not_verified");
      if (BigInt(await rpc(env, "eth_chainId", [])) !== 8453n)
        return fail(503, "chain_unavailable");
      const fromBlock = await rpc(env, "eth_blockNumber", []);
      details = {
        settled_via: "x402_v2",
        phase: "verified",
        request_hash: requestHash,
        proof_hash: proofHash,
        payer: a.from.toLowerCase(),
        amount_usdc: minimum,
        from_block: fromBlock,
        transaction: null,
        telemetry_execution_id: crypto.randomUUID(),
      };
      await claimPayment(env, key, details);
      details = await readPayment(env, key);
    }
    if (
      details.settled_via !== "x402_v2" ||
      details.request_hash !== requestHash ||
      details.proof_hash !== proofHash
    )
      return fail(409, "payment_request_mismatch");
    if (!replayOnly) await db
      .prepare(
        "INSERT OR IGNORE INTO paid_executions(tx_hash, request_hash, payer, state, created_ms) VALUES (?1, ?2, ?3, 'ready', ?4)",
      )
      .bind(key, requestHash, a.from.toLowerCase(), Date.now())
      .run();
    row = await db
      .prepare("SELECT * FROM paid_executions WHERE tx_hash = ?1")
      .bind(key)
      .first();
    if (!row) return fail(409,'paid_result_unavailable');
    if (row.response_expires_ms && row.response_expires_ms <= Date.now()) {
      await db
        .prepare(
          "UPDATE paid_executions SET response_ciphertext = NULL WHERE tx_hash = ?1",
        )
        .bind(key)
        .run();
      return fail(410, "paid_result_expired", {
        instruction:
          "The authorization remains claimed. Contact the operator; do not pay again automatically.",
      });
    }
    if (row.state === "completed") {
      emit("execution_replayed", null, 200, details.telemetry_execution_id);
      return await deliver(request, row, signature, details, true);
    }
    if (replayOnly) return fail(409,'paid_result_unavailable',{
      instruction:'Routing is now free. This prior payment remains claimed; do not pay again automatically.'});
    lease = crypto.randomUUID();
    const lock = await db
      .prepare(
        "UPDATE paid_executions SET state = 'running', lease_nonce = ?1, lease_until_ms = ?2 WHERE tx_hash = ?3 AND (state = 'ready' OR (state = 'running' AND lease_until_ms < ?4))",
      )
      .bind(lease, Date.now() + LEASE, key, Date.now())
      .run();
    if (lock.meta.changes !== 1)
      return fail(409, "payment_execution_pending", { retry_after_seconds: 5 });
    const phase = async (name, extra = {}) => {
      const next = { ...details, ...extra, phase: name };
      const result = await db
        .prepare(
          "UPDATE payment_claims SET details = ?1 WHERE tx_hash = ?2 AND details = ?3",
        )
        .bind(JSON.stringify(next), key, JSON.stringify(details))
        .run();
      if (result.meta.changes !== 1) throw new Error("payment_state_changed");
      details = next;
    };
    if (details.phase === "verified") {
      if (row.response_ciphertext) await phase("evaluated");
      else {
        const now = BigInt(Math.floor(Date.now() / 1000));
        if (BigInt(a.validBefore) <= now)
          return fail(400, "payment_expired_before_evaluation");
        emit("execution_started", null, null, details.telemetry_execution_id);
        const response = await withPaidContext(
          request,
          {
            valid: true,
            amount_usdc: details.amount_usdc,
            payer: details.payer,
            request_hash: requestHash,
            x402_authorized: true,
          },
          execute,
        );
        const saved = await boundedResponse(response);
        let value;
        try {
          value = JSON.parse(saved.body);
        } catch {}
        if (
          saved.status >= 400 ||
          !value ||
          value.error ||
          value.result?.isError
        )
          return fail(503, "evaluation_failed", {
            instruction:
              "No settlement requested. Retry the same authorization while valid.",
          });
        const stored = await db
          .prepare(
            "UPDATE paid_executions SET response_ciphertext = ?1, response_expires_ms = ?2 WHERE tx_hash = ?3 AND lease_nonce = ?4 AND state = 'running'",
          )
          .bind(await seal(saved, signature), Date.now() + TTL, key, lease)
          .run();
        if (stored.meta.changes !== 1) throw new Error("lease_lost");
        await phase("evaluated");
      }
    }
    if (details.phase === "evaluated") {
      // Commit ambiguity BEFORE sending any state-changing facilitator request.
      await phase("settling");
      try {
        const settled = await facilitator("/settle", payload, offered);
        if (txOK(settled.value.transaction))
          await phase("pending", {
            transaction: settled.value.transaction.toLowerCase(),
          });
        else await phase("pending");
      } catch {
        await phase("pending");
      }
    }
    if (details.phase === "settling") await phase("pending");
    let tx = details.transaction;
    if (!tx) tx = await findSettlement(env, a, details.from_block);
    if (!tx || !(await confirmed(env, tx, a, details.from_block)))
      return fail(503, "x402_settlement_pending", {
        instruction:
          "Retry the identical request with the same payment authorization. Settlement is uncertain; do not sign or pay again.",
        transaction: tx || null,
      });
    const txClaim = {
      settled_via: "x402_call",
      reservation: key,
      payer: details.payer,
      amount_usdc: details.amount_usdc,
      request_hash: requestHash,
    };
    await claimPayment(env, tx, txClaim);
    const claimed = await readPayment(env, tx);
    if (claimed?.reservation !== key)
      return fail(409, "payment_already_claimed");
    await phase("completed", { transaction: tx });
    const done = await db
      .prepare(
        "UPDATE paid_executions SET state = 'completed', response_expires_ms = COALESCE(response_expires_ms, ?1), lease_until_ms = 0 WHERE tx_hash = ?2 AND lease_nonce = ?3 AND state = 'running'",
      )
      .bind(Date.now() + TTL, key, lease)
      .run();
    if (done.meta.changes !== 1) throw new Error("lease_lost");
    row = await db
      .prepare("SELECT * FROM paid_executions WHERE tx_hash = ?1")
      .bind(key)
      .first();
    emit("payment_verified", null, null, details.telemetry_execution_id);
    emit("execution_completed", null, 200, details.telemetry_execution_id);
    return await deliver(request, row, signature, details, false);
  } catch {
    return fail(503, "x402_unavailable", {
      instruction:
        "Retry the identical request and authorization. Do not pay again automatically.",
    });
  } finally {
    if (db && key && lease) {
      try {
        await db
          .prepare(
            "UPDATE paid_executions SET state = 'ready', lease_nonce = NULL, lease_until_ms = 0 WHERE tx_hash = ?1 AND lease_nonce = ?2 AND state = 'running'",
          )
          .bind(key, lease)
          .run();
      } catch {}
    }
  }
}

// Pending settlement is a tool error, not another request for a payment.
export async function x402ExecutionResponse(request, body, response, payload) {
  if (response.ok) return response;
  const data = await response.json();
  const settlement = {
    success: false,
    errorReason: data.code || "x402_unavailable",
    transaction: data.transaction || "",
    network: NETWORK,
    payer: payload?.payload?.authorization?.from || "",
  };
  const headers = new Headers(response.headers);
  headers.set("PAYMENT-RESPONSE", encodeX402(settlement));
  headers.set("access-control-expose-headers", "PAYMENT-RESPONSE");
  if (
    isMcpClientPath(new URL(request.url).pathname) &&
    body?.method === "tools/call"
  ) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: body.id,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ...data,
                evaluated: false,
                result_available: false,
                admission_status: response.status,
              }),
            },
          ],
          _meta: { "x402/payment-response": settlement },
        },
      },
      { status: 200, headers },
    );
  }
  return Response.json(data, { status: response.status, headers });
}
