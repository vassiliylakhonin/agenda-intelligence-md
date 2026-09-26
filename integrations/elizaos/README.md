# ElizaOS Plugin: Agenda Financial Guard & M2M Escrow Arbiter

[![npm version](https://img.shields.io/npm/v/@agenda-intelligence/plugin-guard.svg)](https://www.npmjs.com/package/@agenda-intelligence/plugin-guard)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Evidence evaluation and pre-flight transaction firewall for ElizaOS autonomous agents executing financial actions on EVM networks (specialized for **Base Mainnet & Sepolia** with Circle USDC).

> **Notice on ElizaOS Registry:** Following elizaOS's architectural transition retiring the community plugin catalog ([Issue #32219](https://github.com/elizaOS/eliza/issues/32219)), plugins are distributed and consumed directly as npm packages. `@agenda-intelligence/plugin-guard` does not require any central registry to operate with your ElizaOS agents.

---

## Capabilities

- **Pre-Flight Transaction Firewall**: Inspects recipient address, token allowance, transaction calldata, and payment velocity before broadcasting.
- **Drainer & Phishing Defense**: Flags suspicious approval amounts (`approve(type(uint256).max)`), known malicious contracts, and deceptive intent prompts.
- **Autonomous M2M Escrow Arbitration**: Evaluates delivery milestones, deliverable schemas, and submission hashes deterministically for agent-to-agent contracts.
- **Zero-Retention Processing**: Evaluations execute statelessly in volatile Edge RAM; private keys, wallet mnemonics, and prompts are never stored.
- **Strict Human-in-the-Loop Governance**: Unverified or risky transfers enforce `step_up_human_required` to prevent unauthorized asset draining.

---

## Installation

Install directly into your ElizaOS agent repository:

```bash
# Using pnpm (recommended for ElizaOS)
pnpm add @agenda-intelligence/plugin-guard

# Or using bun
bun add @agenda-intelligence/plugin-guard

# Or using npm
npm install @agenda-intelligence/plugin-guard

# Pin this release when a reproducible install is needed
npm install @agenda-intelligence/plugin-guard@1.13.0
```

---

## Character Configuration

You can enable the plugin directly in any ElizaOS character file (e.g., `characters/guard.character.json`):

```json
{
  "name": "AgendaGuardAgent",
  "plugins": [
    "@agenda-intelligence/plugin-guard"
  ],
  "settings": {
    "secrets": {
      "AGENDA_GUARD_ENDPOINT": "https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev"
    }
  }
}
```

A complete, production-ready character configuration is available in [characters/guard.character.json](./characters/guard.character.json).

To run your agent with this character:

```bash
# In your ElizaOS root
pnpm start --character="integrations/elizaos/characters/guard.character.json"
```

---

## Programmatic Usage

### 1. In ElizaOS Runtime (`AgentRuntime`)

```typescript
import { AgentRuntime } from "@elizaos/core";
import { agendaGuardPlugin } from "@agenda-intelligence/plugin-guard";

const runtime = new AgentRuntime({
  // ... runtime configuration
  plugins: [agendaGuardPlugin],
});
```

### 2. Standalone Client (`AgendaGuardClient`)

You can invoke safety and escrow evaluations directly in your custom agent workflows or pre-transaction hooks:

```typescript
import { AgendaGuardClient } from "@agenda-intelligence/plugin-guard";

const client = new AgendaGuardClient();

// Pre-flight transaction check
const verdict = await client.checkTransactionSafety({
  recipient: "0x1111111111111111111111111111111111111111",
  amount_usd: 50,
  network: "base",
  asset: "USDC",
  intent: "Payment for data analytics service",
});

console.log("Decision:", verdict.decision); // 'allow' | 'reject' | 'step_up_human_required'
console.log("Risk Score:", verdict.score);
console.log("Advisory:", verdict.execution_advisory);

// Do not sign or broadcast if human review is required or score is elevated
if (!verdict.is_safe || verdict.decision !== "allow") {
  console.warn("Transaction held for human review:", verdict.execution_advisory);
}
```

### 3. Escrow Dispute Arbitration

```typescript
const ruling = await client.evaluateDispute({
  escrow_id: "escrow-base-4920",
  dispute_claim: {
    claimant: "buyer",
    reason: "Delivered artifact did not match agreed specification schema",
  },
  deal_terms: {
    buyer_id: "agent-alpha",
    seller_id: "agent-beta",
    amount_usd: 100,
    currency: "USDC",
    deadline_utc: "2026-09-30T00:00:00Z",
    arbitration_policy: "pro_rata",
  },
  specification: {
    deliverable_type: "json_dataset",
    expected_schema: {
      type: "object",
      required: ["insights", "timestamp"],
    },
  },
  delivery_submission: {
    submitted_at: "2026-09-25T14:00:00Z",
    artifact_data: { insights: ["trend_detected"], timestamp: 1774533600 },
  },
});

console.log("Ruling:", ruling.ruling); // 'RELEASE_TO_SELLER' | 'REFUND_TO_BUYER' | 'PARTIAL_SETTLEMENT' | 'ESCALATE_HUMAN'
console.log("Payout Details:", ruling.payout);
```

---

## Available Actions

| Action | Description |
| :--- | :--- |
| `CHECK_TRANSACTION_SAFETY` | Pre-flight evaluator inspecting recipient, allowance, velocity, and calldata before transaction signing. Returns verdict data and risk advisory. |

---

## Recipes & Code Examples

- **[Pre-Flight Guard & Wallet Execution Flow](./examples/safe-transaction-flow.ts)**: A complete, runnable TypeScript recipe demonstrating how an autonomous agent intercepts transaction intentions, queries `AgendaGuardClient`, gates wallet signing behind `step_up_human_required`, and aborts high-risk or drainer transfers.

---

## Security Boundaries & Guarantees

- **No Settlement Authorization**: This plugin does not hold private keys, sign transactions, or move funds. Applications must explicitly query the check before their own signing workflows.
- **Explicit Human Review Required**: A clean-looking request requires `step_up_human_required` unless verified against authoritative on-chain state. The local denylist does not substitute for live OFAC/AML clearance.
- **Zero-Retention**: Evaluations run in volatile Edge RAM using deterministic rules, with zero storage of private keys or agent prompts.
- **Escrow Evidence Limitations**: Offline JSON Schema evaluation handles documented standard subsets. Missing or malformed evidence yields `ESCALATE_HUMAN` and zero unauthorized payouts.

See [ADR 0027](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/docs/adr/0027-financial-and-escrow-evidence-boundaries.md) for supported schema constraints and evidence limitations.
