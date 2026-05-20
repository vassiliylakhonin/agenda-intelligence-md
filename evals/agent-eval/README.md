# Agent-eval cases

This folder stores agent-first evaluation cases for Agenda Intelligence.

Agent-eval is for measuring whether attaching the Agenda Intelligence MCP layer
changes an agent's output structure on the same question. It is not a factual
truth benchmark, not a model-quality comparison, and not a substitute for domain
review where buying-side trust requires expert attribution.

Use the methodology in [`../../docs/agent-eval-methodology.md`](../../docs/agent-eval-methodology.md).

## File pattern

- `<case-id>.md` - scored case summary.
- `<case-id>-A.txt` - optional full baseline output when too long for the summary.
- `<case-id>-B.txt` - optional full MCP-attached output when too long for the summary.

Start from [`TEMPLATE.md`](TEMPLATE.md).

