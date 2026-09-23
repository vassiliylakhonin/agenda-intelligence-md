# ElizaOS Community Plugin Registry Submission

> **Status Notice (September 2026):**
> PR [#31592](https://github.com/elizaOS/eliza/pull/31592) was reviewed and validated (65/65 tests passed, merge recommended).
> However, elizaOS decided to **retire the community plugin registry** (tracked in [#32219](https://github.com/elizaOS/eliza/issues/32219)) to focus on core runtime and first-party packages.
> Consequently, `@agenda-intelligence/plugin-guard` is distributed directly via **npm** (`pnpm add @agenda-intelligence/plugin-guard`) and community catalogs such as `awesome-eliza`.

This document retains the metadata and catalog description for submitting `@agenda-intelligence/plugin-guard` to community catalogs (e.g., [awesome-eliza](https://github.com/elizaos/awesome-eliza)).

---

## PR Details (Archived)

**Title:** `feat(registry): add @agenda-intelligence/plugin-guard`

**PR Number:** `#31592` (Closed upstream due to registry deprecation)

---

## PR Description (Copy & Paste)

```markdown
### Summary
Adds `@agenda-intelligence/plugin-guard`, an enterprise-grade security and transaction defense plugin for ElizaOS autonomous agents executing financial actions on EVM networks (specialized for **Base Mainnet & Sepolia** with Circle USDC).

NPM Package: [`@agenda-intelligence/plugin-guard`](https://www.npmjs.com/package/@agenda-intelligence/plugin-guard) (v1.10.0)

### Why ElizaOS Agents Need This
Autonomous agents with wallet access are vulnerable to:
1. **Malicious Recipient Addresses**: Sending funds to sanctioned entities or mixer routers (e.g. OFAC SDN, Tornado Cash, Lazarus, Garantex).
2. **Drainer Approvals**: Malicious contract interaction prompting infinite approvals (`approve(0xfff...)`).
3. **Wallet Depletion (Velocity Breaches)**: Uncontrolled repeated transactions exceeding agent budget limits.
4. **Adversarial Prompt Injection**: User instructions subtly hijacking payment intent.
5. **M2M Counterparty Defaults**: Agent-to-Agent transactions without delivery verification.

### Capabilities & Actions Included

| Action / Evaluator | Description |
| :--- | :--- |
| `CHECK_TRANSACTION_SAFETY` | Pre-flight transaction evaluator inspecting recipient, allowance, intent, and velocity. |
| `EVALUATE_ESCROW_DISPUTE` | Autonomous B2B arbitration resolver for milestone deliverables on Base USDC. |
| `TRANSACTION_RISK_EVALUATOR` | Continuous background listener preventing unsanctioned token transfers. |

### Installation

```bash
pnpm add @agenda-intelligence/plugin-guard
# or
npm install @agenda-intelligence/plugin-guard
```

### Character Configuration (`character.json`)

```json
{
  "name": "DefensiveTrader",
  "plugins": [
    "@agenda-intelligence/plugin-guard"
  ],
  "settings": {
    "secrets": {
      "AGENDA_GATE_URL": "https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev",
      "AGENDA_BEARER_KEY": "optional_pro_key_for_elevated_rate_limits"
    }
  }
}
```

### Zero-Retention Architecture
All evaluations are processed strictly in volatile Edge RAM using deterministic rule engines. No private keys, wallet mnemonics, or agent prompts are ever stored on disk.
```
