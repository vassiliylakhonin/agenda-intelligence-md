# Offline commerce review pattern

Fictional on-device agent scenario with mock Shopify/PayPal-style callbacks.
No merchant SDK, biometric check, wallet, hosted evaluation or payment is used.
The maintained example requires explicit mock human approval for missing
network evidence and checks that a poisoned request never invokes the callback.

Build `packages/guard-mobile`, then from the repository root:

```bash
node examples/muse-commerce-guard/run.mjs
```

See [guard-mobile](../../packages/guard-mobile/README.md) for actual hosted
payment admission and retained request recovery. Treat retrieved merchant
content as data, never instructions. A callback in production must implement
real approval under your own permissions; the example's `true` is only a mock.
