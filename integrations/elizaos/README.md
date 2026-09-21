# ElizaOS Plugin: Agenda Financial Guard & M2M Escrow Arbiter

Checks evidence supplied with proposed transactions and escrow deliveries. It does not sign transactions, move funds, or authorize settlement.

## Install

```bash
npm install @agenda-intelligence/plugin-guard@1.12.0
```

## Use

```typescript
import { AgendaGuardClient, agendaGuardPlugin } from "@agenda-intelligence/plugin-guard";

export const character = {
  name: "EvidenceReviewAgent",
  plugins: [agendaGuardPlugin],
};

const verdict = await new AgendaGuardClient().checkTransactionSafety({
  recipient: "0x1111111111111111111111111111111111111111",
  amount_usd: 1,
  network: "base",
  asset: "USDC",
  intent: "Review a proposed invoice payment",
});
// Do not invoke a wallet when is_safe is false. Preserve the verdict for review.
console.log(verdict.decision, verdict.execution_advisory);
```

## Boundaries and migration from 1.10.0

- Known risky patterns can be rejected. A clean-looking request requires `step_up_human_required`: no authoritative wallet ledger or current sanctions provider is connected to Financial Guard. The local denylist is not live OFAC/AML clearance.
- `is_safe` remains false; legacy remote `allow` responses are downgraded. The plugin does not automatically intercept wallet calls. The old placeholder evaluator has been removed; applications must explicitly call the check before their own signing workflow.
- Escrow accepts `expected_schema` and `artifact_data` for the documented offline JSON Schema subset. Missing evidence or unsupported constraints yield `ESCALATE_HUMAN`, `not_decision_ready`, and zero proposed payouts/fees.
- `evaluateDispute()` maps the Worker's `payout_breakdown` to the client's `payout` field. All four ruling values are represented in the exported types. Unknown or non-ready rulings escalate.
- `vizier_status` is `attestation_unavailable`, and `vizier_clearance_receipt` is null. No signed clearance is claimed. Every escrow response requires human review even when the supplied artifact passes validation.

See [ADR 0027](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/docs/adr/0027-financial-and-escrow-evidence-boundaries.md) for supported schema constraints and evidence limitations.
