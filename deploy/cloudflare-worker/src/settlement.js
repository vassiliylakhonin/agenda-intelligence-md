import {
  BASE_FALLBACK_RPC_URLS,
  BASE_RPC_URL,
  BASE_USDC_CONTRACT,
  BASE_USDBC_CONTRACT,
  BASE_USDC_WALLET,
  ERC20_TRANSFER_TOPIC,
  TIER_DOSSIER_USDC_AMOUNT,
  TIER_MICRO_CHECK_USDC_AMOUNT,
  TIER_MICRO_DISPUTE_USDC_AMOUNT,
  TIER_PRO_USDC_AMOUNT,
  USDC_DECIMALS
} from "./profiles.js";

export function normalizeAddressForTopic(address) {
  if (!address || typeof address !== "string") return "";
  const clean = address.toLowerCase().replace(/^0x/, "");
  return "0x" + clean.padStart(64, "0");
}

export function extractAddressFromTopic(topic) {
  if (!topic || typeof topic !== "string") return "";
  const clean = topic.toLowerCase().replace(/^0x/, "");
  return "0x" + clean.slice(-40);
}

export function parseTransferLog(log, targetRecipient = BASE_USDC_WALLET) {
  if (!log || typeof log !== "object") return null;
  const contract = (log.address || "").toLowerCase();
  const isUsdc =
    contract === BASE_USDC_CONTRACT.toLowerCase() ||
    contract === BASE_USDBC_CONTRACT.toLowerCase();
  if (!isUsdc) return null;

  const topics = Array.isArray(log.topics) ? log.topics : [];
  if (topics.length < 3) return null;

  const topic0 = (topics[0] || "").toLowerCase();
  if (topic0 !== ERC20_TRANSFER_TOPIC.toLowerCase()) return null;

  const expectedRecipientTopic = normalizeAddressForTopic(targetRecipient);
  const actualRecipientTopic = (topics[2] || "").toLowerCase();
  if (actualRecipientTopic !== expectedRecipientTopic) return null;

  const fromAddress = extractAddressFromTopic(topics[1]);
  const toAddress = extractAddressFromTopic(topics[2]);

  let rawValue = 0n;
  try {
    rawValue = BigInt(log.data || "0x0");
  } catch (_e) {
    return null;
  }

  const amountUsdc = Number(rawValue) / 10 ** USDC_DECIMALS;

  return {
    contract,
    from: fromAddress,
    to: toAddress,
    raw_value: rawValue.toString(),
    amount_usdc: amountUsdc
  };
}

export async function verifyBaseTransactionReceipt(
  txHash,
  env = {},
  options = {}
) {
  if (!txHash || typeof txHash !== "string") {
    return { valid: false, error: "Missing or invalid tx_hash format" };
  }

  const cleanTxHash = txHash.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(cleanTxHash)) {
    return {
      valid: false,
      error: "Invalid transaction hash: must be a 64-character hex string starting with 0x"
    };
  }

  const kv = env?.AGENDA_USAGE;
  const replayKey = `settled_tx:${cleanTxHash.toLowerCase()}`;

  if (kv && typeof kv.get === "function") {
    try {
      const existing = await kv.get(replayKey);
      if (existing) {
        let record = null;
        try {
          record = JSON.parse(existing);
        } catch (_e) {
          record = { raw: existing };
        }
        return {
          valid: false,
          code: "already_claimed",
          error: `Transaction ${cleanTxHash} was already claimed and settled.`,
          claimed_record: record
        };
      }
    } catch (_kvErr) {
      // If KV read errors, proceed to verify
    }
  }

  const fetchFn = options.fetchFn || globalThis.fetch;
  const rpcEndpoints = env?.BASE_RPC_URL
    ? [env.BASE_RPC_URL]
    : BASE_FALLBACK_RPC_URLS;

  let rpcJson = null;
  let lastError = null;

  for (const endpoint of rpcEndpoints) {
    try {
      const rpcResponse = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "AgendaIntelligence/1.9 (+https://github.com/vassiliylakhonin/agenda-intelligence-md)"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionReceipt",
          params: [cleanTxHash]
        })
      });

      if (rpcResponse && rpcResponse.ok) {
        rpcJson = await rpcResponse.json();
        if (rpcJson && "result" in rpcJson) {
          break;
        }
      } else if (rpcResponse) {
        lastError = `Base RPC returned HTTP status ${rpcResponse.status}`;
      }
    } catch (netErr) {
      lastError = `Failed to query Base RPC endpoint: ${netErr.message || String(netErr)}`;
    }
  }

  if (!rpcJson || !("result" in rpcJson)) {
    return {
      valid: false,
      error: lastError || "Failed to reach Base RPC mainnet"
    };
  }

  const receipt = rpcJson?.result;
  if (!receipt) {
    return {
      valid: false,
      error: `Transaction ${cleanTxHash} not found on Base mainnet. Ensure the transaction is confirmed before settling.`
    };
  }

  if (receipt.status !== "0x1") {
    return {
      valid: false,
      error: `Transaction ${cleanTxHash} reverted or failed on chain (status: ${receipt.status}).`
    };
  }

  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  let matchingTransfer = null;

  for (const log of logs) {
    const parsed = parseTransferLog(log, BASE_USDC_WALLET);
    if (parsed) {
      matchingTransfer = parsed;
      break;
    }
  }

  if (!matchingTransfer) {
    return {
      valid: false,
      error: `Transaction ${cleanTxHash} contains no USDC transfer to recipient ${BASE_USDC_WALLET}.`
    };
  }

  return {
    valid: true,
    tx_hash: cleanTxHash,
    amount_usdc: matchingTransfer.amount_usdc,
    payer: matchingTransfer.from,
    recipient: matchingTransfer.to,
    contract: matchingTransfer.contract,
    block_number: receipt.blockNumber
  };
}

export async function markTransactionSettled(txHash, details, env = {}) {
  const kv = env?.AGENDA_USAGE;
  if (!kv || typeof kv.put !== "function") return;
  const replayKey = `settled_tx:${txHash.toLowerCase()}`;
  const payload = JSON.stringify({
    settled_at: new Date().toISOString(),
    ...details
  });
  // Retain settled transaction markers for 90 days
  await kv.put(replayKey, payload, { expirationTtl: 90 * 86400 });
}

export async function provisionProBearerToken(payerAddress, txHash, env = {}) {
  const kv = env?.AGENDA_USAGE;
  const rawId = typeof crypto?.randomUUID === "function" ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const token = `agy_pro_${rawId}`;
  const now = Date.now();
  const validUntil = now + 30 * 86400 * 1000; // 30 days

  const tokenData = {
    tier: "tier_2_pro",
    payer: payerAddress,
    tx_hash: txHash,
    created_at: new Date(now).toISOString(),
    valid_until: new Date(validUntil).toISOString(),
    quota: 10000,
    used: 0
  };

  if (kv && typeof kv.put !== "function") {
    return { token, tokenData };
  }

  if (kv) {
    await kv.put(`bearer_token:${token}`, JSON.stringify(tokenData), {
      expirationTtl: 30 * 86400
    });
  }

  return { token, tokenData };
}

export async function checkDynamicBearerToken(token, env = {}) {
  if (!token || typeof token !== "string" || !token.startsWith("agy_pro_")) {
    return null;
  }
  const kv = env?.AGENDA_USAGE;
  if (!kv || typeof kv.get !== "function") return null;

  try {
    const raw = await kv.get(`bearer_token:${token}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const validUntilMs = new Date(data.valid_until).getTime();
    if (Date.now() > validUntilMs) {
      return null;
    }
    return data;
  } catch (_e) {
    return null;
  }
}

export async function handleSettleRequest(request, env = {}, ctx = {}) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { allow: "POST", "content-type": "application/json", "cache-control": "no-store" }
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch (_e) {
    return new Response(
      JSON.stringify({
        error: "Malformed JSON payload.",
        required_fields: ["tx_hash"],
        example: {
          tx_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          tier: "tier_2_pro"
        }
      }),
      { status: 400, headers: { "content-type": "application/json", "cache-control": "no-store" } }
    );
  }

  const txHash = body?.tx_hash;
  if (!txHash) {
    return new Response(
      JSON.stringify({
        error: "Missing required field: tx_hash",
        example: {
          tx_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          tier: "tier_2_pro"
        }
      }),
      { status: 400, headers: { "content-type": "application/json", "cache-control": "no-store" } }
    );
  }

  const verification = await verifyBaseTransactionReceipt(txHash, env);
  if (!verification.valid) {
    const status = verification.code === "already_claimed" ? 409 : 400;
    return new Response(
      JSON.stringify({
        error: verification.error,
        code: verification.code || "settlement_verification_failed",
        tx_hash: txHash
      }),
      { status, headers: { "content-type": "application/json", "cache-control": "no-store" } }
    );
  }

  const requestedTier = body?.tier || (verification.amount_usdc >= TIER_PRO_USDC_AMOUNT ? "tier_2_pro" : "tier_3_deal_dossier");

  if (requestedTier === "tier_2_pro") {
    if (verification.amount_usdc < TIER_PRO_USDC_AMOUNT) {
      return new Response(
        JSON.stringify({
          error: `Insufficient payment for Dedicated Pro Tenant: received ${verification.amount_usdc} USDC, required ${TIER_PRO_USDC_AMOUNT} USDC.`,
          required_usd: TIER_PRO_USDC_AMOUNT,
          received_usd: verification.amount_usdc
        }),
        { status: 400, headers: { "content-type": "application/json", "cache-control": "no-store" } }
      );
    }

    const { token, tokenData } = await provisionProBearerToken(verification.payer, verification.tx_hash, env);
    await markTransactionSettled(verification.tx_hash, {
      tier: "tier_2_pro",
      payer: verification.payer,
      amount_usdc: verification.amount_usdc,
      token
    }, env);

    return new Response(
      JSON.stringify({
        status: "settled",
        tier: "tier_2_pro",
        name: "Dedicated Pro Tenant",
        bearer_token: token,
        valid_days: 30,
        valid_until: tokenData.valid_until,
        monthly_quota: tokenData.quota,
        receipt: {
          network: "base",
          chain_id: 8453,
          asset: "USDC",
          amount_usdc: verification.amount_usdc,
          payer: verification.payer,
          recipient: verification.recipient,
          tx_hash: verification.tx_hash,
          settled_at: new Date().toISOString()
        },
        instructions: "Pass 'Authorization: Bearer " + token + "' on all subsequent API and MCP calls."
      }),
      { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } }
    );
  }

  // Micropayment Tiers: tier_micro_check ($0.05) & tier_micro_dispute ($0.50)
  if (
    requestedTier === "tier_micro_check" ||
    requestedTier === "tier_micro_dispute" ||
    (verification.amount_usdc >= TIER_MICRO_CHECK_USDC_AMOUNT && verification.amount_usdc < TIER_DOSSIER_USDC_AMOUNT)
  ) {
    const isDispute =
      requestedTier === "tier_micro_dispute" || verification.amount_usdc >= TIER_MICRO_DISPUTE_USDC_AMOUNT;
    const tierName = isDispute ? "tier_micro_dispute" : "tier_micro_check";
    const requiredAmount = isDispute ? TIER_MICRO_DISPUTE_USDC_AMOUNT : TIER_MICRO_CHECK_USDC_AMOUNT;

    if (verification.amount_usdc < requiredAmount) {
      return new Response(
        JSON.stringify({
          error: `Insufficient payment for ${tierName}: received ${verification.amount_usdc} USDC, required ${requiredAmount} USDC.`,
          required_usd: requiredAmount,
          received_usd: verification.amount_usdc
        }),
        { status: 400, headers: { "content-type": "application/json", "cache-control": "no-store" } }
      );
    }

    await markTransactionSettled(
      verification.tx_hash,
      {
        tier: tierName,
        payer: verification.payer,
        amount_usdc: verification.amount_usdc
      },
      env
    );

    return new Response(
      JSON.stringify({
        status: "settled",
        tier: tierName,
        name: isDispute ? "M2M Escrow Dispute Evaluation" : "Agent Financial Pre-Sign Check",
        receipt: {
          network: "base",
          chain_id: 8453,
          asset: "USDC",
          amount_usdc: verification.amount_usdc,
          payer: verification.payer,
          recipient: verification.recipient,
          tx_hash: verification.tx_hash,
          settled_at: new Date().toISOString()
        },
        instructions:
          "Micropayment confirmed on Base. Pass 'X-Payment-Tx: " +
          verification.tx_hash +
          "' on your API call for verified machine execution."
      }),
      { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } }
    );
  }

  // Tier 3 Deal Dossier ($49 pilot)
  if (verification.amount_usdc < TIER_DOSSIER_USDC_AMOUNT) {
    return new Response(
      JSON.stringify({
        error: `Insufficient payment for Confidential Deal Dossier: received ${verification.amount_usdc} USDC, required ${TIER_DOSSIER_USDC_AMOUNT} USDC.`,
        required_usd: TIER_DOSSIER_USDC_AMOUNT,
        received_usd: verification.amount_usdc
      }),
      { status: 400, headers: { "content-type": "application/json", "cache-control": "no-store" } }
    );
  }

  await markTransactionSettled(
    verification.tx_hash,
    {
      tier: "tier_3_deal_dossier",
      payer: verification.payer,
      amount_usdc: verification.amount_usdc
    },
    env
  );

  return new Response(
    JSON.stringify({
      status: "settled",
      tier: "tier_3_deal_dossier",
      name: "Confidential Deal Dossier",
      expedited: true,
      receipt: {
        network: "base",
        chain_id: 8453,
        asset: "USDC",
        amount_usdc: verification.amount_usdc,
        payer: verification.payer,
        recipient: verification.recipient,
        tx_hash: verification.tx_hash,
        settled_at: new Date().toISOString()
      },
      instructions:
        "Payment confirmed on Base. Your transaction hash is stamped on the file. Send parameters or submit to /message/send with 'X-Payment-Tx: " +
        verification.tx_hash +
        "'."
    }),
    { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } }
  );
}

export function generateX402PaymentResponse(profile, request, env, reason = "quota_exceeded") {
  const isFinancialCheck = profile === "agent_financial_guard";
  const isEscrowDispute = profile === "m2m_escrow_arbiter";
  const requiredUsdc = isFinancialCheck
    ? TIER_MICRO_CHECK_USDC_AMOUNT
    : isEscrowDispute
      ? TIER_MICRO_DISPUTE_USDC_AMOUNT
      : TIER_MICRO_CHECK_USDC_AMOUNT;
  const requiredRaw = String(Math.round(requiredUsdc * 1e6));

  const authHeader = `X402 token="USDC", network="base", chain_id=8453, recipient="${BASE_USDC_WALLET}", amount="${requiredUsdc}", asset="USDC", contract="${BASE_USDC_CONTRACT}"`;

  const body = {
    error: "payment_required",
    status: 402,
    message:
      reason === "quota_exceeded"
        ? "Free Community Sandbox hourly quota reached. Direct M2M settlement required for autonomous machine execution."
        : "Autonomous M2M settlement required for direct execution.",
    x402: {
      version: "1.0",
      protocol: "x402",
      network: "base",
      chain_id: 8453,
      token: "USDC",
      token_contract: BASE_USDC_CONTRACT,
      recipient_wallet: BASE_USDC_WALLET,
      amount_usdc: requiredUsdc,
      amount_raw: requiredRaw,
      profile: profile || "agenda",
      pricing_tiers: {
        micro_check_usd: TIER_MICRO_CHECK_USDC_AMOUNT,
        micro_dispute_usd: TIER_MICRO_DISPUTE_USDC_AMOUNT,
        deal_dossier_usd: TIER_DOSSIER_USDC_AMOUNT,
        monthly_pro_usd: TIER_PRO_USDC_AMOUNT
      },
      how_to_pay:
        "Send transfer(recipient, amount_raw) to token_contract on Base (Chain ID 8453), then retry this request with header 'X-Payment-Tx: <tx_hash>' or purchase a Pro Bearer key at /v1/settle."
    }
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 402,
    headers: {
      "content-type": "application/json",
      "www-authenticate": authHeader,
      "x-payment-protocol": "x402",
      "cache-control": "no-store"
    }
  });
}
