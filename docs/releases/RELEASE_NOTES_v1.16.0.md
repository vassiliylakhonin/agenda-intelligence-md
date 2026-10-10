# 1.16.0 — 2026-10-10

Output Verification now preserves bounded Markdown wrapping and table labels,
binds numeric support to the named row, and compares explicit negative clauses.
It retains deterministic lint and human-review boundaries. On five frozen
owner-source cases, original-answer false holds decreased from four to one;
this is an owner evaluation, not independent customer validation.
On the same five deliberately corrupted probes, three now route to revision
(previously two); two semantic errors still pass to human review. This small
replay does not establish general factual accuracy.

Three usable integration surfaces are added:

- [Interaction Trust + Vizier](../integrations/action-bound-execution.md): a
  request-bound SDK execution seam with signed delegation provenance, scope,
  expiry, real human-review consumption and durable replay reservation; an
  offline CLI only checks snapshots and cannot authorize execution.
- [MCP Integration Check](../integrations/mcp-integration-check.md): optional
  official MCP client, CLI and GitHub Action for discovery, schemas, explicit
  auth, unknown-method errors and opted-in examples. No tool executes from a
  server's instructions. Optional SDK requires Python 3.10+.
- [Agent Checkout Readiness](../integrations/checkout-readiness.md): an offline
  ACP 2026-04-17 sandbox trace profile covering one product/variant, price,
  stock, repeated create/complete/cancel, and full-refund handoff to a merchant
  adapter. No live transaction or settlement proof is claimed.

Core Python support remains 3.9+. No new core dependency, hosted product,
pricing or quota is added. The official ACP schema is bundled unmodified with
its Apache-2.0 license, NOTICE, pinned provenance and verified checksum; project
code remains MIT. Optional dependencies are isolated in `reviews` and `mcp-check`.

Validation includes the full local gate, official-client stdio and loopback
HTTP auth scenarios, production public MCP discovery/free fleet-directory
example, checkout adversarial cases and isolated installed-package CLI checks.
