# Changelog

## 1.3.0 — 2026-10-18

- Default to the custom Financial Guard and Escrow hostnames.
- Preserve current advisory action and evidence status/scope metadata without granting transaction or settlement authority.
- Accept an externally signed x402 v2 PAYMENT-SIGNATURE proof after inspecting PAYMENT-REQUIRED; retain the exact request and proof for explicit recovery and expose unverified PAYMENT-RESPONSE metadata.
- Keep legacy transfer-hash/EIP-191 recovery, mandatory human review, and refusal of proof substitution or mixed payment formats. No automatic signing, funding or retries; no funded settlement claim.
