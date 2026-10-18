// Node 22+. No wallet access, automatic payment, source retrieval or relay.
import { verifyOutputReceipt } from "../../deploy/cloudflare-worker/src/output-receipt.js";
import { readBoundedJson } from "../../deploy/cloudflare-worker/src/request-body.js";

export const OUTPUT_ORIGIN = "https://output-verification.agendamcp.dpdns.org";

export function outputPaymentPolicy({
  payTo,
  expectedIssuer = OUTPUT_ORIGIN,
} = {}) {
  if (
    !/^0x[0-9a-f]{40}$/i.test(payTo || "") ||
    new URL(expectedIssuer).origin !== expectedIssuer ||
    !expectedIssuer.startsWith("https://")
  )
    throw new Error("Pin the recipient and HTTPS origin");
  let approved = false;
  return ({ paymentRequired }) => {
    const terms = paymentRequired.accepts?.[0];
    if (
      approved ||
      paymentRequired.accepts?.length !== 1 ||
      terms?.scheme !== "exact" ||
      terms.network !== "eip155:8453" ||
      terms.asset?.toLowerCase() !==
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" ||
      terms.payTo?.toLowerCase() !== payTo.toLowerCase() ||
      !/^[0-9]+$/.test(terms.amount) ||
      BigInt(terms.amount) <= 0n ||
      BigInt(terms.amount) > 50000n ||
      paymentRequired.resource?.url !== expectedIssuer + "/mcp/agent"
    )
      return false;
    approved = true;
    return true;
  };
}

export async function verifyHostedOutput(
  input,
  response,
  { expectedIssuer = OUTPUT_ORIGIN, fetchImpl = fetch } = {},
) {
  const origin = new URL(expectedIssuer);
  if (origin.protocol !== "https:" || origin.origin !== expectedIssuer)
    throw new Error("Pin the expected HTTPS origin");
  // Ignore receipt issuer/jku for key discovery. Never forward wallet/auth headers.
  const keysResponse = await fetchImpl(
    expectedIssuer + "/.well-known/jwks.json",
    { redirect: "error", headers: { accept: "application/json" } },
  );
  if (!keysResponse.ok) throw new Error("Trusted JWKS unavailable");
  const jwks = await readBoundedJson(keysResponse, 65536);
  const token = response?.evaluation_receipt?.token;
  if (typeof token !== "string" || token.length > 8192)
    throw new Error("Signed output receipt required");
  let header;
  try {
    header = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString("utf8"),
    );
  } catch {
    throw new Error("Malformed output receipt");
  }
  const candidates = (Array.isArray(jwks.keys) ? jwks.keys : []).filter(
    (key) =>
      key.kty === "EC" &&
      key.crv === "P-256" &&
      (!key.alg || key.alg === "ES256") &&
      (!key.use || key.use === "sig") &&
      (header.kid ? key.kid === header.kid : !key.kid),
  );
  if (candidates.length !== 1)
    throw new Error("A unique trusted signing key is required");
  const verification = await verifyOutputReceipt({
    request: input,
    response,
    publicJwk: candidates[0],
    expectedIssuer,
  });
  if (!verification.valid)
    throw new Error("Output receipt refused: " + verification.reason_code);
  return verification;
}

export async function reviewSignedOutput(
  input,
  {
    mode = "trial",
    paidClient = null,
    expectedIssuer = OUTPUT_ORIGIN,
    fetchImpl = fetch,
    headers = {},
  } = {},
) {
  const servingOrigin = new URL(expectedIssuer);
  if (servingOrigin.protocol !== "https:" || servingOrigin.origin !== expectedIssuer)
    throw new Error("Pin the expected HTTPS origin before submitting a packet");
  if (!["trial", "paid"].includes(mode))
    throw new Error("Choose trial or explicitly configured paid mode");
  // Retain a private immutable JSON copy for request binding; no implicit repair.
  const original = JSON.parse(JSON.stringify(input));
  let result;
  if (mode === "paid") {
    if (!paidClient?.callTool)
      throw new Error(
        "Configure an official x402 MCP client and explicit wallet budget first",
      );
    result = await paidClient.callTool("agent_output_verification", original);
  } else {
    const response = await fetchImpl(expectedIssuer + "/mcp/agent", {
      method: "POST",
      redirect: "error",
      headers: {
        ...headers,
        "content-type": "application/json",
        "MCP-Protocol-Version": "2025-11-25",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "signed-output-trial",
        method: "tools/call",
        params: { name: "free_trial", arguments: original },
      }),
    });
    const body = await readBoundedJson(response);
    if (
      !response.ok ||
      body.error ||
      body.id !== "signed-output-trial" ||
      body.jsonrpc !== "2.0"
    ) {
      throw new Error("Trial refused; no automatic paid fallback");
    }
    result = body.result;
  }
  if (!result || result.isError)
    throw new Error(
      "Evaluation refused; retain original payment context, do not auto-pay again",
    );
  // @x402/mcp 2.28 returns content but drops structuredContent on paid retries.
  // The Worker publishes identical JSON text for that official-client path.
  let structured = result.structuredContent;
  if (!structured) {
    const text = result.content?.find((part) => part.type === "text")?.text;
    if (typeof text !== "string" || text.length > 1024 * 1024)
      throw new Error("Missing bounded evaluation JSON");
    structured = JSON.parse(text);
  }
  const evaluation = mode === "trial" ? structured?.evaluation : structured;
  return verifyHostedOutput(original, evaluation, {
    expectedIssuer,
    fetchImpl,
  });
}
