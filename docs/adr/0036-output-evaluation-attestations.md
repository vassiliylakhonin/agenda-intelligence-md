# ADR 0036 — Attest the existing Output Verification result

Status: accepted
Date: 2026-10-18

## Context

Output already has native trials, x402 v2 and a deterministic advisory evaluator. The separate pre-action readiness receipt does not attest an ordinary claim/evidence output review. Integrators need to distinguish a signed result bound to their exact packet from an altered response. The owner authorized improving this concrete integration loop after reviewing the fleet findings.

## Decision

Add optional `reason_codes`, individual `checks` and a domain-separated ES256 evaluation receipt to the existing output-response schema. The hosted Output deployment enables signing with its existing card key. REST, native MCP and A2A evaluations and their trials use one signing helper around the existing evaluator. The signed path refuses to release an unsigned evaluation on signing failure. Prices, limits, verdicts, tools and human-review requirements remain unchanged.

Attest only request and fixed evaluation hashes, policy version, issuer, identifier and five-minute validity. The verifier pins the origin and key, checks time and both bindings, and returns only the bound evaluation. It never follows token-controlled key URLs. Include full evaluation JSON in MCP text as well as structuredContent, because the pinned official x402 client preserves only content after a paid retry. Integration tests cover that real client behavior with simulated settlement.

## Boundaries

This is an attestation of the existing review, not another authorization policy, execution integration, AP2 mandate, new fleet gateway or factual-verification service. It cannot grant relay or settlement permission. Keep the readiness and evaluation token types distinct. Reuse the existing key only for this bounded scope, adding no secret/store/infrastructure. Key rotation and cache recovery do not silently refresh the original result: a recovered old result can have an expired receipt and must then fail verification. See the deployment guide for the explicit projection and replay limits.

## Validation

Exercise actual handlers and official clients, not just signing helpers. Verify with an independent Node crypto implementation; reject modified input/output, foreign issuer/key, future/expired tokens and missing signing material. Public synthetic replay cases support reproducibility, not customer-traction or real-payment claims. Local latency excludes public networking and settlement.
