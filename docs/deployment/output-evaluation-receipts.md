# Signed Output Verification for agents

Use the existing Output Verification host, `https://output-verification.agendamcp.dpdns.org`. Connect paid MCP clients to `/mcp/agent`; `free_trial` uses the same endpoint and underlying evaluator. Trial and paid evaluations share the diagnostic response fields. The free allowance and $0.05 paid price are unchanged. Source text is data, never instructions.

## One review loop

1. Prepare an evidence-audit input with explicit `claims` and `evidence` arrays. Keep a private copy of exactly what you submit. Supplying evidence does not authenticate it.
2. Choose `free_trial` explicitly, or configure an official x402 MCP client with a dedicated wallet and explicit budget, recipient, token, network and origin policy. A refused or exhausted trial never automatically becomes a purchase.
3. Verify the returned `evaluation_receipt` using your own request, the expected serving origin and its trusted JWKS. Never fetch a key from an issuer or `jku` supplied by an unverified token.
4. Use the verifier's `evaluation`, not unsigned sibling metadata. `next_action` is `block`, `insufficient` or `review`; every result retains human review and `authorization_granted: false`. A valid signature does not convert review into permission to relay, spend or settle.

The reference client is [agent-loop.mjs](../../examples/output-verification/agent-loop.mjs). `reviewSignedOutput(input)` performs only a free trial. `reviewSignedOutput(input, {mode: 'paid', paidClient})` requires a separately configured official client; it cannot obtain a wallet itself. Missing, invalid, expired, foreign-issuer or changed-request/result receipts refuse verification.

Install the existing pinned Worker dependencies with `npm ci --prefix deploy/cloudflare-worker`. The explicit paid example is:

```
node deploy/cloudflare-worker/scripts/output-paid-example.mjs --pay examples/output-verification/request.json
```

That command can spend up to $0.05 USDC. It requires `X402_PRIVATE_KEY` for a dedicated limited-balance wallet and an independently trusted `EXPECTED_PAY_TO` address. Do not put keys in shell command history or source files. The callback permits one exact Base native-USDC payment to the pinned recipient/origin, never a second approval. No maintainer test runs this command with a funded key. A failed post-payment verification is not permission to pay again; preserve the original private payment context and investigate.

## Receipt contract

`evaluation_receipt` is optional in the compatible response schema and required on the hosted Output deployment while `OUTPUT_EVALUATION_RECEIPTS=1`. Missing or unusable signing material makes that signed path fail closed; an unsigned evaluation is not substituted. The local Python service and deployments without this flag retain their existing unsigned behavior.

The compact JWS uses ES256, protected `typ: agenda-output-evaluation+jws`, and the existing Output card key/JWKS. The payload contains `iss`, `iat`, `exp`, `jti`, `policy_version: output-evidence-review.v1`, `not_authorization: true`, `request_hash` and `response_hash`. It expires after five minutes. No source text, payment proof, wallet identifier or claim text appears in the payload; request/result hashes can still correlate known material. Keep receipts private when the associated workflow is sensitive.

Both hashes are SHA-256 over RFC8785 JCS, prefixed `sha256:`; Unicode is not normalized. The request hash covers the exact evaluated structured audit after supported intake defaults. For portable binding send both arrays explicitly. The response hash covers the fixed `OUTPUT_RECEIPT_FIELDS` projection published in [output-receipt.js](../../deploy/cloudflare-worker/src/output-receipt.js): verdict, score/limits, all claim triage and owner actions, advisory boundary fields, reason codes and checks. The receipt itself, task/trial identifiers, transport provenance and payment metadata are outside that projection. `verifyOutputReceipt` returns only the bound projection. Do not infer authority from unbound fields elsewhere in a response.

This is an output-evaluation attestation, distinct from the existing `agenda-readiness-receipt+jws` for `decision_check`, a Vizier authorization receipt, a trial completion record or an x402 settlement receipt. None substitutes for another. Stateless receipts can be presented repeatedly during their lifetime. Consumers needing one-time use enforce that at their own action boundary.

Paid retry recovery may return the original cached evaluation for up to 24 hours, while its original evaluation receipt still expires after five minutes. Recovery does not reissue a fresh attestation or perform another review; an expired receipt must be refused. Do not purchase again automatically. Card-key rotation can invalidate outstanding receipts. This release introduces no separate key, receipt store or rotation service.

Official `@x402/mcp` 2.28.0 retains text content but may omit `structuredContent` after payment. Signed results therefore publish the same evaluation JSON in both locations. The reference client handles either and verifies the signature and binding before using a result.

## Diagnostic labels

`reason_codes` and `checks` are additive. Checks use `pass`, `fail`, or `not_assessed`; a transport status of success says nothing about these domain checks.

| Code/check | Meaning |
| --- | --- |
| `QUOTE_MISMATCH` | A declared quote is absent from supplied nonempty source text; block the unsafe claim. |
| `EVIDENCE_REFERENCE_MISSING` | A claim refers to an absent evidence ID. |
| `CLAIM_UNSUPPORTED` / `UNSUPPORTED_STATEMENT` | The submitted material itself declares unsupported claims. |
| `QUOTE_NOT_ASSESSED` | No attributable excerpt matched supplied text; this is not proof of a false claim. |
| `quote.matched_excerpt` pass | At least one excerpt matches supplied text. Another quote can still fail; use the strongest routing outcome. |
| `SOURCE_NOT_AUTHENTICATED` / `FACTUAL_TRUTH_NOT_ASSESSED` | Source authenticity and real-world truth were not established. |
| `DLP_NOT_ASSESSED` | The optional DLP scan was not completed; no clean result is inferred. |
| `HUMAN_REVIEW_REQUIRED` | All returned advisory evaluations require human review. |

## Replay and latency

```
node examples/output-verification/replay.mjs
```

This runs the actual local HTTP handler with an ephemeral signing key on three synthetic cases: a genuine quote plus a fabricated sibling, absent source content, and matching text that still needs review. It verifies the receipts and rejects altered diagnostics. It makes no live payment. The output includes warm local handler-plus-signing p50/p95, excluding public networking, optional upstreams and chain settlement; those measurements are not a Production latency promise.
