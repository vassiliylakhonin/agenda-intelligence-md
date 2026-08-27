# Agent-eval cases

Per-case structural deltas of agent output with and without the Agenda Intelligence MCP product shell. Methodology: [`docs/agent-eval-methodology.md`](../../docs/agent-eval-methodology.md). Glossary: **Agent-Eval Delta** in [`CONTEXT.md`](../../CONTEXT.md) and [`docs/adr/0008-agent-eval-delta-is-structural-product-validation.md`](../../docs/adr/0008-agent-eval-delta-is-structural-product-validation.md).

These cases are **not a benchmark**, **not a factual verification**, and **not a model-quality comparison**. They are per-case structural snapshots of how the product shell changes output shape on a fixed question. Not a substitute for domain review where buying-side trust requires expert attribution.

## File pattern

- `<case-id>.md` — scored case summary. Start from [`TEMPLATE.md`](TEMPLATE.md).
- `<case-id>-A.txt` — optional full baseline output when too long for the summary.
- `<case-id>-B.txt` — optional full MCP-attached output when too long for the summary.

## Cases

| ID | Surface | Skill under test | Status |
|---|---|---|---|
| [gtta-global-policy.md](gtta-global-policy.md) | GTTA / global | global-think-tank-analyst | complete (delta +4.5) |
| [ca-caspian-sanctions.md](ca-caspian-sanctions.md) | CA + Caspian + sanctions | central-asia-caspian-hybrid-intelligence-skill | complete (delta +4.5) |
| [gulf-me-hormuz-shipping.md](gulf-me-hormuz-shipping.md) | Gulf + ME | gulf-middle-east-hybrid-intelligence-skill | complete (delta +4.0) |

