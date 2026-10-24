# 0040 — Pro volume pricing

- Status: accepted
- Date: 2026-10-24

## Context

The owner requested correction of Pro's unit-price mismatch after ordinary
checks moved to 0.01 USDC: 490 USDC for 10,000 checks cost 4.9 times as much per
check at full quota. Public cards, settlement guidance and browser checkout
also repeated that price as literals.

## Decision

Set the existing Pro amount to 49 USDC for its existing 30-day, 10,000-check
allowance. At full use this is 0.0049 USDC/check, 51% below an ordinary check.
Derive all current runtime quotes and browser payment amounts from
`TIER_PRO_USDC_AMOUNT`. Keep current signatures, transaction claims, token
storage, expiry, quota consumption and per-operation prices.

The dossier and Pro now have equal prices but remain different products.
New Pro activations explicitly name `tier_2_pro`, as the published checkout
already does. Preserve the historical omitted-tier inference threshold of
490 USDC solely for legacy callers: an unspecified 49 USDC activation remains
a dossier, and an unspecified old Pro payment remains Pro. This historical
threshold is not a current amount to charge. Existing tokens keep their stored
quota and expiry. No transaction is reclassified solely because the price fell.

## Validation and implications

Exercise public price parity across all twelve profiles, signed 49 USDC Pro
activation, underpayment refusal, payer-signature requirement, 30-day/10,000
entitlement, replay refusal and legacy dossier activation using offline
synthetic receipts. Run `make verify-local` before push and deploy through the
existing Vizier-gated fleet workflow. Live readback inspects public quotes only,
uses the maintainer marker and does not transfer funds or issue credentials.
The discount is an owner-requested pricing correction, not an estimate of
optimal price, customer demand or profitability.
