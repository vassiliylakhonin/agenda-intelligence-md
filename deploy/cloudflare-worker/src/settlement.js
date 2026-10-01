import { readBoundedJson } from "./request-body.js";
import { paymentLedger, claimPayment, readPayment, tokenHash } from "./payment-ledger.js";
import {
  BASE_FALLBACK_RPC_URLS,
  BASE_RPC_URL,
  BASE_USDC_CONTRACT,
  BASE_USDBC_CONTRACT,
  BASE_USDC_WALLET,
  ERC20_TRANSFER_TOPIC,
  TIER_BANKABILITY_DOSSIER_USDC_AMOUNT,
  TIER_DOSSIER_USDC_AMOUNT,
  TIER_MICRO_CHECK_USDC_AMOUNT,
  TIER_MICRO_DISPUTE_USDC_AMOUNT,
  TIER_PRO_USDC_AMOUNT,
  USDC_DECIMALS
} from "./profiles.js";
import { verifyPersonalSignature } from "./ethsig.js";

// EIP-191 challenge a payer signs to prove control of the address that funded
// a Pro-tier settlement. The message binds the exact tx_hash and the on-chain
// payer address, so a signature is worthless for any other payment.
export const SETTLEMENT_CHALLENGE_PREFIX = "Agenda Intelligence MD pro-tenant settlement";
export function settlementChallengeMessage(txHash, payer) {
  return (
    SETTLEMENT_CHALLENGE_PREFIX +
    "\ntx_hash: " + String(txHash || "").toLowerCase() +
    "\npayer: " + String(payer || "").toLowerCase()
  );
}

export function paymentActivationChallenge(txHash, payer, tier) {
  return "Agenda Intelligence MD payment activation v2\ntx_hash: " + txHash.toLowerCase() +
    "\npayer: " + payer.toLowerCase() + "\ntier: " + tier;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

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

// A header payment can be upgraded to Pro only by its on-chain payer.
// Legacy markers without a tier/payer or completed Pro claims never qualify.
function isHeaderProClaim(raw, payer, amount) {
  try {
    const marker = JSON.parse(raw);
    return marker && marker.settled_via === "x_payment_tx_header" &&
      marker.tier === "tier_2_pro" &&
      typeof marker.payer === "string" &&
      (payer === undefined || marker.payer.toLowerCase() === payer.toLowerCase()) &&
      (amount === undefined || marker.amount_usdc === amount) &&
      !marker.token_hash && !marker.claim_nonce;
  } catch (_e) {
    return false;
  }
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
      if (existing && !(options.allowHeaderClaim && isHeaderProClaim(existing))) {
        // Never echo the stored marker: before 2026-09-26 it contained the
        // provisioned Pro bearer token in plaintext, so anyone who knew the
        // public tx_hash could recover the paid credential from the 409.
        return {
          valid: false,
          code: "already_claimed",
          error: `Transaction ${cleanTxHash} was already claimed and settled.`
        };
      }
    } catch (_kvErr) {
      return { valid: false, code: "settlement_store_unavailable", error: "Replay store unavailable" };
    }
  }

  if (env.PAYMENT_LEDGER) {
    try {
      const existing = await readPayment(env, cleanTxHash);
      if (existing && !(options.allowHeaderClaim && isHeaderProClaim(JSON.stringify(existing))) &&
          !((options.allowCallClaim || options.allowActivation) && existing.settled_via === "signed_activation")) {
        return { valid: false, code: "already_claimed", error: "Transaction already claimed" };
      }
    } catch (_error) {
      return { valid: false, code: "settlement_store_unavailable", error: "Payment ledger unavailable" };
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
        }),
        signal: AbortSignal.timeout(10000)
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

  if (Number.isFinite(options.expectedAmountUsdc) && matchingTransfer.amount_usdc < options.expectedAmountUsdc) {
    return { valid: false, code: "insufficient_payment", error: "Payment amount is below the required minimum" };
  }
  // Legacy KV markers expire after 90 days. Accepting only recent on-chain
  // payments prevents expired legacy markers from reopening old payments.
  if (env.PAYMENT_LEDGER) {
    try {
      const blockResponse = await fetchFn(env.BASE_RPC_URL || BASE_RPC_URL, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_getBlockByNumber", params: [receipt.blockNumber, false] }),
        signal: AbortSignal.timeout(10000)
      });
      const block = await blockResponse.json();
      const minedAt = Number(BigInt(block?.result?.timestamp)) * 1000;
      const age = Date.now() - minedAt;
      if (!blockResponse.ok || !Number.isFinite(minedAt) || age < -300000 || age > 7 * 86400000) {
        return { valid: false, code: "payment_age_invalid", error: "Payment must have a verified block time within the last seven days" };
      }
    } catch (_error) {
      return { valid: false, code: "payment_time_unavailable", error: "Unable to verify payment block time" };
    }
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
  const safeDetails = { ...details };
  // A settled marker is replay evidence, not a credential store: a bearer
  // token persisted here in plaintext leaked back out through the old 409
  // `claimed_record` path. Store only its SHA-256 fingerprint.
  if (typeof safeDetails.token === "string") {
    safeDetails.token_hash = await sha256Hex(safeDetails.token);
    delete safeDetails.token;
  }
  const payload = JSON.stringify({
    settled_at: new Date().toISOString(),
    ...safeDetails
  });
  // Retain settled transaction markers for 90 days
  await kv.put(replayKey, payload);
}

// The unique tx key is claimed atomically on D1; never fall back to KV.
export async function claimTransactionSettlement(txHash, details, env = {}, options = {}) {
  try {
    const legacy = await env?.AGENDA_USAGE?.get?.(`settled_tx:${txHash.toLowerCase()}`);
    if (legacy) await claimPayment(env, txHash, JSON.parse(legacy));
    let claimed = await claimPayment(env, txHash, details);
    if (!claimed && options.allowHeaderClaim) {
      // Upgrade the same payer's header settlement only once, in one write.
      const update = await paymentLedger(env).prepare(
        "UPDATE payment_claims SET details = ?1 WHERE tx_hash = ?2 AND json_extract(details, '$.settled_via') = 'x_payment_tx_header' AND json_extract(details, '$.tier') = 'tier_2_pro' AND lower(json_extract(details, '$.payer')) = ?3 AND json_extract(details, '$.amount_usdc') = ?4"
      ).bind(JSON.stringify(details), txHash.toLowerCase(), details.payer.toLowerCase(), details.amount_usdc).run();
      claimed = update.meta.changes === 1;
    }
    return { claimed, durable: true, ...(claimed ? {} : { code: "already_claimed" }) };
  } catch (_error) {
    return { claimed: false, code: "settlement_store_unavailable" };
  }
}

export async function provisionProBearerToken(payerAddress, txHash, env = {}) {
  const db = paymentLedger(env);
  const rawId = crypto.randomUUID().replace(/-/g, "");
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

  await db.prepare(
    "INSERT INTO pro_tokens(token_hash, tx_hash, details, valid_until_ms, quota, used) VALUES (?1, ?2, ?3, ?4, ?5, 0)"
  ).bind(await tokenHash(token), txHash.toLowerCase(), JSON.stringify(tokenData), validUntil, tokenData.quota).run();

  return { token, tokenData };
}

export async function checkDynamicBearerToken(token, env = {}) {
  if (!token || typeof token !== "string" || !token.startsWith("agy_pro_")) {
    return null;
  }
  try {
    const row = await paymentLedger(env).prepare(
      "SELECT details, used, quota FROM pro_tokens WHERE token_hash = ?1 AND valid_until_ms > ?2"
    ).bind(await tokenHash(token), Date.now()).first();
    return row ? { ...JSON.parse(row.details), used: row.used, quota: row.quota } : null;
  } catch (_error) {
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

  if (!env?.PAYMENT_LEDGER?.prepare) {
    return new Response(JSON.stringify({ code: "settlement_store_unavailable", error: "Payment settlement is unavailable; no credential issued." }), {
      status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  }
  let body = {};
  try {
    body = await readBoundedJson(request);
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

  const verification = await verifyBaseTransactionReceipt(txHash, env, { allowHeaderClaim: true, allowActivation: true });
  if (!verification.valid) {
    const status = verification.code === "already_claimed" ? 409 : verification.code === "settlement_store_unavailable" ? 503 : 400;
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

  if (requestedTier !== "tier_2_pro") {
    const existing = await readPayment(env, verification.tx_hash);
    if (existing && existing.settled_via !== "signed_activation") return Response.json({ code: "already_claimed" }, { status: 409 });
  }
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

    // A tx_hash alone proves only that *someone* paid the wallet: hashes are
    // public on-chain, so the first caller to present one used to walk away
    // with the payer's Pro bearer token. Bearer issuance now requires an
    // EIP-191 personal_sign over the settlement challenge from the on-chain
    // payer address itself.
    const payerSignature = body?.payer_signature;
    if (!payerSignature || typeof payerSignature !== "string") {
      return new Response(
        JSON.stringify({
          error: "Missing required field: payer_signature",
          required_fields: ["tx_hash", "tier", "payer_signature"],
          challenge_message: settlementChallengeMessage(verification.tx_hash, verification.payer),
          how_to_sign:
            "Sign the challenge_message with the payer wallet as an EIP-191 personal_sign " +
            "(eth_sign / personal_sign) and resubmit. This proves the claim comes from the " +
            "address that funded the payment, not from someone who read the public tx_hash."
        }),
        { status: 400, headers: { "content-type": "application/json", "cache-control": "no-store" } }
      );
    }
    const challenge = settlementChallengeMessage(verification.tx_hash, verification.payer);
    if (!verifyPersonalSignature(challenge, payerSignature, verification.payer)) {
      return new Response(
        JSON.stringify({
          error:
            "payer_signature verification failed: the signature does not recover the on-chain " +
            `payer address ${verification.payer} for this tx_hash. Only the funding wallet can ` +
            "claim a Pro bearer token.",
          code: "payer_signature_invalid"
        }),
        { status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" } }
      );
    }

    // Claim the tx_hash before any credential exists; a replay or lost race is
    // rejected without ever provisioning a token.
    const claim = await claimTransactionSettlement(verification.tx_hash, {
      tier: "tier_2_pro",
      payer: verification.payer,
      amount_usdc: verification.amount_usdc
    }, env, { allowHeaderClaim: true });
    if (!claim.claimed) {
      const unavailable = claim.code === "settlement_store_unavailable";
      return new Response(
        JSON.stringify({
          error: unavailable
            ? "Settlement store unavailable; no credential issued. Retry later."
            : `Transaction ${verification.tx_hash} was already claimed and settled.`,
          code: unavailable ? "settlement_store_unavailable" : "already_claimed",
          tx_hash: verification.tx_hash
        }),
        { status: unavailable ? 503 : 409, headers: { "content-type": "application/json", "cache-control": "no-store" } }
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

  const amounts = {
    tier_micro_check: TIER_MICRO_CHECK_USDC_AMOUNT,
    tier_micro_dispute: TIER_MICRO_DISPUTE_USDC_AMOUNT,
    tier_bankability_dossier: TIER_BANKABILITY_DOSSIER_USDC_AMOUNT,
    tier_3_deal_dossier: TIER_DOSSIER_USDC_AMOUNT
  };
  if (!(requestedTier in amounts)) return Response.json({ error: "Unknown payment tier" }, { status: 400 });
  if (verification.amount_usdc < amounts[requestedTier]) return Response.json({
    error: "Insufficient payment", required_usdc: amounts[requestedTier]
  }, { status: 402 });
  const challenge = paymentActivationChallenge(verification.tx_hash, verification.payer, requestedTier);
  if (!body.payer_signature) return Response.json({ code: "payer_signature_required", challenge_message: challenge }, {
    status: 401, headers: { "cache-control": "no-store" }
  });
  if (!verifyPersonalSignature(challenge, body.payer_signature, verification.payer)) return Response.json({
    code: "payer_signature_invalid"
  }, { status: 403, headers: { "cache-control": "no-store" } });
  const details = { settled_via: "signed_activation", tier: requestedTier, payer: verification.payer,
    amount_usdc: verification.amount_usdc, recipient: verification.recipient, contract: verification.contract };
  try {
    await claimPayment(env, verification.tx_hash, details);
    const existing = await readPayment(env, verification.tx_hash);
    if (existing?.settled_via !== "signed_activation" || existing.payer !== details.payer || existing.tier !== requestedTier) {
      return Response.json({ code: "already_claimed" }, { status: 409 });
    }
    return Response.json({ status: "activated", tier: requestedTier, execution_credit: 1,
      receipt: { network: "base", chain_id: 8453, asset: "USDC", ...verification },
      instructions: "Credit is not consumed by activation. Submit one exact API request with X-Payment-Tx and X-Payment-Signature. An unsigned request returns its challenge. Sign with the funding wallet and retain that exact signature for identical retries; completed results can be recovered for 24 hours."
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ code: "settlement_store_unavailable" }, { status: 503 });
  }
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
        "Send transfer(recipient, amount_raw) to token_contract on Base (Chain ID 8453), then retry this exact request with 'X-Payment-Tx: <tx_hash>' and funding-wallet 'X-Payment-Signature: <personal_sign proof>' or purchase a Pro Bearer key at /v1/settle."
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
