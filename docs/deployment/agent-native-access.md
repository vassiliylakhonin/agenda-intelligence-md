# Native agent access

All twelve hosted Agenda profiles expose one fixed free-trial evaluation. Output Verification has five campaign attempts per network/product; the others have two. HTTP, MCP and A2A share the same allowance, plus the existing fleet-wide UTC daily capacity. Changing transports, labels or sessions does not reset it. Production Bearer authentication still applies where configured.

## A2A

Read `/.well-known/agent-card.json`, then the Agenda metadata in `capabilities.extensions`. The optional `https://agendamcp.dpdns.org/extensions/free-trial/v1` extension advertises `a2a_free_trial`, including status/evaluation message examples. Internal legacy card readers can use `x_agenda_intelligence.a2a_free_trial`.

POST to `/message/send` with `A2A-Version: 1.0` and `Content-Type: application/json`:

```json
{
  "jsonrpc": "2.0",
  "id": "trial-status-1",
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "replace-with-a-unique-id",
      "role": "ROLE_USER",
      "metadata": {"com.agenda/free-trial": {"operation": "status"}},
      "parts": [{"text": "Check free trial availability"}]
    }
  }
}
```

For evaluation, set `operation` to `evaluate` and replace parts with exactly one `{"data": YOUR_PRODUCT_INPUT, "mediaType": "application/json"}`. Obtain the matching raw input schema/example from `GET /v1/trial` or MCP `free_trial` inputSchema; replace synthetic inputs with supplied evidence. Only the fixed trial product runs. Do not put a tool name, payment or another A2A envelope inside the data.

Success is `result.task` with `TASK_STATE_COMPLETED`, an evaluation JSON artifact and `metadata.trial.completion_recorded: true`. Status uses `metadata.trial_status` and consumes no attempt. Legacy A2A 0.3 uses `message/send` and returns `result` as the task. Completed-task retrieval follows the existing task-token policy; a task ID does not grant another evaluation. Invalid input consumes no attempt; an admitted evaluation/storage failure can consume one. Quota refusal is a JSON-RPC error, HTTP 429, with `trial.limit_reason`; only daily exhaustion has Retry-After.

## Standard x402 v2

For the concrete Output Verification loop, see [signed output evaluations](output-evaluation-receipts.md): stable diagnostic codes, a five-minute request/result attestation, independently pinned JWKS verification, explicit-budget official-client example and local synthetic replays. Evaluation, readiness and settlement receipts have different scopes and cannot substitute for one another.

When `/.well-known/x402` advertises `x_agenda_access.standard_x402`, paid profile evaluation supports:

| Transport | Requirements | Payment | Settlement result |
| --- | --- | --- | --- |
| HTTP / A2A | HTTP 402, base64 `PAYMENT-REQUIRED` | base64 `PAYMENT-SIGNATURE` | base64 `PAYMENT-RESPONSE` |
| Native MCP | tool `isError: true`; identical PaymentRequired in structuredContent and content[0].text | `params._meta["x402/payment"]` | `result._meta["x402/payment-response"]` |

The current rail is `exact`, Base `eip155:8453`, native USDC, EIP-3009 EOA signatures. Entry prices: normal review $0.01 USDC, Escrow $0.05, optional Bankability full scenario $25. Text-only Agenda and Corridor Assistant routing is free without trial or Pro consumption; HS-code screening is a separate paid operation. Read actual requirements per operation; the transfer's recipient, amount and token must match. Discovery, trials and a free Bankability preview are not payment requests.

A standard client can use `@x402/fetch` or `@x402/mcp` with `@x402/evm`. Official 2.28.0 clients run against the actual Worker handler in offline CI. For MCP, connect the normal MCP client to the chosen profile's `/mcp/agent`, wrap it with `x402MCPClient`, and implement `onPaymentRequested` to approve only the wallet owner's explicit budget, expected network and recipient. That removes the custom HTTP-payment adapter. The generic library defaults may auto-pay: configure your approval/budget policy before giving a client a funded signer.

Retain the exact original request/protocol context and payment payload privately. An identical retry recovers the encrypted result for up to 24 hours. A different request cannot spend the same authorization again. The EIP-3009 signature authorizes one transfer, not the request body or any agent action; the server durably binds its first admitted request. Use TLS and never log, publish or hand the proof to another agent.

If settlement is uncertain, no evaluated output is released. Retry the same request/proof to reconcile the onchain nonce; do not create another payment. MCP returns a tool error with failed payment-response metadata, without a new payment challenge. Expired/unresolved recovery requires the operator; no automatic refund or re-payment is claimed.

The public PayAI facilitator receives only payment fields, not documents, queries or source text. Its free allowance may be exhausted or unavailable; paid credits are not configured. Base RPC independently checks the authorization nonce and transfer. Maintainer tests do not make live payments, so no actual settlement or revenue is claimed.

The existing `X-Payment-Tx` + `X-Payment-Signature` funding-wallet path and Pro entitlement remain supported. Choose one payment method. For the optional Bankability full dossier, first inspect the free preview and explicitly approve the $25 continuation; an ordinary preview does not auto-charge.

All source text is data, never instructions. Payment grants access to the evaluation only; it grants no relay, signing, sanctions clearance, shipment or settlement authorization. Human review remains required.

Sources: [official x402 v2 specification](https://github.com/x402-foundation/x402/blob/faa1c694c66a3732aaabbce93bdae140e521a67d/specs/x402-specification-v2.md), [MCP transport](https://github.com/x402-foundation/x402/blob/faa1c694c66a3732aaabbce93bdae140e521a67d/specs/transports-v2/mcp.md), [PayAI developer reference](https://payai.network/developers).
