# ADR 0035: Native A2A trials and standard x402 v2

Date: 2026-10-18. Accepted for the existing hosted fleet.

## Decision

Expose the existing fixed-profile free evaluator via an optional A2A metadata extension. `SendMessage` and legacy `message/send` share the same D1 reservation, completion receipt and product/network campaign key as HTTP/MCP. No new quota, selection of another paid tool, or bypass of deployment authentication is introduced. Publish examples and the extension URI in signed discovery.

Add an opt-in `X402_STANDARD=1` deployment mode, enabled on the existing fleet, for x402 v2 `exact`, `eip155:8453`, native USDC, EIP-3009 EOA signatures. Preserve the existing transaction-hash/funding-wallet-signature path and prices. HTTP uses the standard payment headers; MCP uses `x402/payment` request metadata and `x402/payment-response` result metadata, with identical structured/text payment requirements.

Use the public PayAI facilitator's free allowance without merchant credentials or credits. A provider outage or free-tier refusal denies paid access; never buy credits or silently switch providers. Send only the payment authorization, signature and server-owned payment terms. Do not forward source text, request bodies, arbitrary client extensions, resource descriptions or URL queries.

Locally recover and check the EIP-712 signer; verify the exact amount, token, network, recipient and bounded validity. The chain RPC must report Base. Persist the first request/proof binding before evaluation and retain it permanently. Compute the advisory result before requesting settlement, hold it encrypted, commit an ambiguity marker before the state-changing settlement request, and release only after Base shows both the exact AuthorizationUsed nonce and the matching USDC transfer. All execution callbacks remain evidence/routing evaluations, never delegated action execution.

Reuse existing payment_claims/paid_executions tables: the `x402:<hash>` namespace is an authorization reservation, not a transaction hash accepted by the legacy API. Claim the actual settled transaction in the shared ledger too, preventing cross-method reuse. No migration is required. Conditional leases serialize evaluation and settlement; cached results expire after 24 hours, including pending results, while payment claims never expire.

On uncertain settlement, retry only the identical request and authorization: inspect the known transaction or search a bounded onchain nonce window. Never call settle twice automatically. Unresolved or expired recovery remains closed for operator reconciliation. Do not return a fresh payment challenge after ambiguous settlement.

## Security and compatibility boundaries

Standard EIP-3009 signs a transfer capability; it does not cryptographically sign an arbitrary request body. Its first admitted URL/body/protocol context is durably bound by this server. Treat the proof as a secret bearer capability over TLS. The legacy path retains its stronger funding-wallet signature over the request hash. Authentication, task ownership and action/human approval remain separate from payment.

Only the exact native-USDC EIP-3009 EOA path is supported. No Permit2 approvals, smart-account signatures, Solana, generic ERC20 allowances or Pro subscription issuance through this adapter. The optional Bankability full dossier remains an explicit purchase after its free preview. No live settlement or universal wallet compatibility is claimed by offline tests.

## Evidence

Official x402 specification and HTTP/MCP transports pinned at x402-foundation/x402 commit faa1c694c66a3732aaabbce93bdae140e521a67d. CI pins official @x402/fetch, @x402/mcp and @x402/evm 2.28.0 and viem 2.57.7 as development-only dependencies. Counterexamples cover malformed/foreign proofs, replay, parallel admission, failed evaluation, ambiguous settlement, false facilitator success, cache expiry and wallet-policy denial. Public provider checks use only supported discovery and read-only verification of an expired synthetic proof; no settlement request is sent.
