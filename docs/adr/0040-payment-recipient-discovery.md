# 0040 — Payment recipient discovery

Status: accepted. Date: 2026-10-24.

## Context and evidence

Agenstry's fresh Output Verification card snapshot contained the released price
and the real recipient inside deeply nested vendor offers, but its free
`get_agent_full` API returned null for every payment field and its UI displayed
`no payment wallet declared`. A separate A2A service using a dedicated x402
capability extension was recognized as x402/Base/USDC, while its wallet was still
null. Therefore protocol recognition and wallet extraction/refresh are separate
checks; a local fixture cannot prove an upstream scanner change.

The current A2A card schema has a closed root. Adding arbitrary `payTo` or `x402`
root fields would break our signed public contract merely to suit one index.
The exact operation's x402 requirement remains authoritative for payment.

## Decision

Add an optional discovery capability identified by `https://www.x402.org/`,
using the shallow recipient fields seen in public x402 discovery. It describes
our actual HTTP/MCP transport, not the separate A2A task-state payment extension.
Publish it only when standard x402 is enabled. Keep the existing vendor block.

Use a shared settlement identity helper for the capability and payment
manifests: `payTo`, CAIP-2 `network`, native-USDC `asset`, `currency`, canonical
`manifest` and public `explorer_url`. These are additive discovery fields with
no universal amount; free routing, trials and separately paid tools coexist.
Do not accept caller-provided wallet, network or asset overrides. Retain current
recipient, prices, quotes, authentication and replay behavior.

## Validation and limits

Validate all twelve wire cards against A2A, compare manifest/capability identity
to their operation quotes, exercise disabled standard configuration and spoofed
recipient inputs, and run `make verify-local`. Deploy through the existing
Vizier workflow. Re-probe the actual directory API/UI after deployment; distinguish
published metadata, parsed identity, scheduled balance scan and real paid calls.
Do not fabricate transfers or claim revenue to populate an earnings panel.

If the directory continues to omit the wallet after reading the new snapshot,
record that upstream limit and prepare a concrete support request for human
review. Sending a vendor message requires direct human authorization.
