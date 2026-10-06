# ElizaOS catalog submission text

The earlier registry submission [PR #31592](https://github.com/elizaOS/eliza/pull/31592)
is a historical reference. Use the current package README and peer range when
preparing a new listing; do not reuse the old capability list or test counts.

## Current listing draft

[Agenda Guard](https://www.npmjs.com/package/@agenda-intelligence/plugin-guard)
provides clients for proposed transaction and delivery evidence review and a
structured `CHECK_TRANSACTION_SAFETY` ElizaOS action. Human review is required;
it does not intercept a wallet, verify current sanctions clearance, perform
background monitoring, authorize signing or settle escrow.

- [Current package instructions and migration](../../integrations/elizaos/README.md)
- [Tested synthetic example](../../integrations/elizaos/examples/mock-review.cjs)
- [Character template](../../integrations/elizaos/characters/guard.character.json)

`EVALUATE_ESCROW_DISPUTE` is not a registered plugin action; escrow is exposed by
the client API. There is no continuous evaluator. `AGENDA_GUARD_ENDPOINT` configures
the financial endpoint. The optional ElizaOS peer range is `>=1.7.2 <2`; structural
compatibility is checked against 1.7.2, not every runtime release.

Hosted evaluation is paid, with explicit signature challenge and recovery;
discovery and fixed examples are free. Do not claim zero retention, latency SLA,
mainnet certification, customer traction or automatic financial execution.
Publication and marketplace acceptance are separate from a working npm package.
