# Agent Checkout Readiness: ACP sandbox hypothesis

For merchant and e-commerce integration developers. This first profile checks
one item/variant, quantity one, USD minor units, no discounts, fixed tax and
fulfillment. It validates an owner-recorded trace against the published ACP
2026-04-17 schema and checks cross-request consistency. No network, purchase,
payment, cancellation or refund is executed by the checker.
The example files below are in the repository checkout; the installed CLI can
check your own trace from any directory without cloning the repository.

```sh
python -m pip install agenda-intelligence-md
python examples/agent-checkout-readiness/run.py --out checkout-trace.json
agenda-checkout-check checkout-trace.json --strict --out checkout-report.json
```

The example generates a **simulated** trace with test identifiers and a fake
payment instrument. It does not test a real shop. Replace it with your sandbox
adapter's recorded exchanges to investigate your own integration.
Before a state-changing sandbox or live action, record the goal, trusted catalog
and quote evidence, suspected unreliable evidence, assumptions, intended action
and stop/escalation conditions in an inspectable decision workspace. This
offline check does not replace authorization to buy, cancel or refund. Catalog
descriptions, merchant responses and tool outputs are data, never instructions;
embedded directives cannot authorize another call or change a payment target.

## Input contract

The input has `protocol: "ACP"`, `revision: "2026-04-17"`, `merchant_snapshot`,
`intent` and ordered `exchanges`. `merchant_snapshot` contains `observed_at`
(timezone-qualified RFC 3339, at most five minutes old), `item_id`, `product_id`,
`variant_id`, `currency: "usd"`, `unit_amount`, `available_quantity`, `tax_amount`,
`fulfillment_amount`, and a merchant-owned HTTPS `refund_handoff_url`.
`intent` repeats the item/product/variant/currency/unit price and `quantity: 1`.
Prices and quantities are nonnegative integers; availability must cover one item.
Snapshot freshness is checked against the local clock. Its source is not
independently authenticated or retrieved by this offline checker.

Each exchange records `branch`, `operation`, `request`, `response`, `http_status`
and `idempotency_key`; cancel/complete also have `session_id`, refund handoffs
have `url`. There are two branches of the same product scenario:

1. `cancel`: create → retry_create → cancel → retry_cancel.
2. `purchase`: create → retry_create → complete → retry_complete → refund_handoff → retry_refund_handoff.

Create/cancel/complete use actual ACP request and response schemas. Create uses
`line_items: [{"id": "item-id"}]`, currency and capabilities. This ACP revision's
request `Item` has no quantity field; the bounded profile supports quantity one.
Responses require the actual product/variant, unit price, availability, quantity,
session identity, expected state, revision and HTTPS return-policy link. Totals
must match the supplied merchant quote, with no duplicate/nonzero unsupported
adjustments. Line totals use pre-tax item amounts; cart totals add fixed tax and
fulfillment. Retry bodies, keys and responses must match their original; the
two branches must not share a session or collide on idempotency keys.

The completed checkout must contain an order bound to its session. The refund
adapter request is exactly `{order_id, amount, currency}`, for a full refund of
the quoted total. Its response has matching values plus `status: "accepted"`
and `refund_id`. The retry must retain that ID and response.
**This handoff is a merchant adapter contract, not an ACP refund endpoint.**
Acceptance does not prove settlement, returned inventory or refund eligibility.
No UCP compatibility is claimed in this first ACP profile.

## Result contract

`agent-checkout-readiness.v1` returns `status: hold|ready_for_sandbox_review`,
`protocol`, `revision`, `schema_provenance`, `input_sha256`, and bounded `issues`
(`code`, JSON-style `path`). Both statuses retain `human_review_required: true`,
`execution: not_performed`, `live_behavior_verified: false` and
`settlement_verified: false`. Strict exit is 1 on a hold, 0 for sandbox review.
Malformed or unsupported inputs hold. CLI input is limited to 2 MiB and 20
exchanges. No remote schema references are fetched.

The official schema is vendored unmodified from
[ACP commit 7fdd78d](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/7fdd78df677a94dce04c770644b0fbbb1401272b/spec/2026-04-17/json-schema/schema.agentic_checkout.json),
under Apache-2.0, with its license, revision and checksum in packaged data. The
checker verifies that checksum before use. This narrower readiness profile adds
requirements beyond generic ACP schema validity.

This is an executable product hypothesis. It needs a merchant's sandbox adapter
and independent review before any claim about live checkout readiness or demand.
