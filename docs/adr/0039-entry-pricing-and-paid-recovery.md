# 0039 — Entry pricing and paid recovery

- Status: accepted
- Date: 2026-10-24

## Context

The owner approved free specialist routing, 0.01 USDC automatic checks and
0.05 USDC Escrow evidence review. Routing and paid operations share hosts;
changing host-wide admission would also discount structured screening or the
optional Bankability full export. No conversion uplift or profitability has been
established by this price change.

## Decision

Resolve operation prices and the two free routing tools in `pricing-policy.js`.
Use the same policy in machine offers, trial continuation terms, payment
admission, onboarding and browser presentation. Keep existing profiles, schemas,
trial campaign identities, production Bearer gates and per-IP hourly limits.
Free routing consumes neither trial nor Pro allowance and cannot enter checkout.
Keep HS-code screening separately paid and Bankability's free preview plus
optional 25 USDC model export.

Bind payment recovery to the original request and exact signed proof. Completed
old-price results remain recoverable within the existing encrypted-cache window.
Fresh unclaimed x402 authorizations must match the current challenge before any
facilitator request. An already admitted authorization retains its original
amount and settlement terms while reconciling; a retry cannot create another
settlement. Now-free routing uses a cached-recovery-only path and refuses fresh
payment material. An unavailable or expired saved result never triggers a new
payment automatically.

## Validation and operating implications

Exercise all twelve profiles' operation offers and MCP/A2A admission, mixed-host
HS/model prices, existing trial quotas, free-route hourly limits, official x402
clients and both payment rails' old-price recovery using synthetic offline
proofs. Run `make verify-local` and existing deployment gates. Owner-labelled live
checks may inspect quotes and run free routing; they never transfer funds or
establish customer adoption. Deploy through the existing twelve-target workflow;
no new infrastructure, credentials or payment provider is required.
