// Explicit operator-run example. Never run this with a funded key in CI.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { x402Client } from "@x402/fetch";
import { x402MCPClient } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { readFile } from "node:fs/promises";
import {
  OUTPUT_ORIGIN,
  reviewSignedOutput,
  outputPaymentPolicy,
} from "../../../examples/output-verification/agent-loop.mjs";

if (!process.argv.includes("--pay"))
  throw new Error(
    "Explicit --pay required; this example can spend up to $0.05 USDC",
  );
const key = process.env.X402_PRIVATE_KEY,
  payTo = process.env.EXPECTED_PAY_TO;
if (
  !/^0x[0-9a-f]{64}$/i.test(key || "") ||
  !/^0x[0-9a-f]{40}$/i.test(payTo || "")
) {
  throw new Error(
    "Supply a dedicated limited-balance wallet and independently trusted EXPECTED_PAY_TO",
  );
}
const client = new Client({
  name: "agenda-owner-paid-output-example",
  version: "1",
});
const transport = new StreamableHTTPClientTransport(
  new URL(OUTPUT_ORIGIN + "/mcp/agent"),
  {
    requestInit: {
      headers: {
        "X-Client-Id": "agenda-owner-paid-output-example",
        "User-Agent": "agenda-owner-paid-output-example/1",
      },
    },
  },
);
try {
  await client.connect(transport);
  const payments = new x402Client().register(
    "eip155:8453",
    new ExactEvmScheme(privateKeyToAccount(key)),
  );
  const paidClient = new x402MCPClient(client, payments, {
    autoPayment: true,
    onPaymentRequested: outputPaymentPolicy({ payTo }),
  });
  const file = process.argv.find((arg) => arg.endsWith(".json"));
  const input = JSON.parse(
    await readFile(
      file ||
        new URL(
          "../../../examples/output-verification/request.json",
          import.meta.url,
        ),
      "utf8",
    ),
  );
  const verification = await reviewSignedOutput(input, {
    mode: "paid",
    paidClient,
  });
  console.log(
    JSON.stringify({
      receipt_valid: verification.valid,
      next_action: verification.evaluation.next_action,
      reason_codes: verification.evaluation.reason_codes,
      human_review_required: true,
      authorization_granted: false,
    }),
  );
} finally {
  await client.close();
}
