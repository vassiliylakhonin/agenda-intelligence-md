# ElizaOS Plugin: Agenda Financial Guard & M2M Escrow Arbiter

Protect your ElizaOS agents from catastrophic financial exploits and automate B2B contract settlements on Base.

---

## Capabilities

- **OFAC SDN & AML Screening**: Real-time matching against sanctioned addresses (Tornado Cash, Lazarus Group, Garantex).
- **Drainer Defense**: Neutralizes infinite allowance approvals (`approve(max_uint256)`).
- **Treasury Velocity Controls**: Enforces spending limits before transactions are signed.
- **Autonomous M2M Escrow Arbiter**: Resolves data/compute deal disputes with mathematical balance conservation and cryptographic Vizier JWS receipts.

---

## Installation

```bash
npm install @agenda-intelligence/plugin-guard
```

## Setup in ElizaOS Agent Character

```typescript
import { agendaGuardPlugin } from "@agenda-intelligence/plugin-guard";

export const character = {
  name: "AutonomousSettlementAgent",
  plugins: [agendaGuardPlugin],
  // ... rest of character config
};
```
