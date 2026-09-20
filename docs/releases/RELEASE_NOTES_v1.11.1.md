# 1.11.1 — financial and escrow evidence boundaries

Upgrade Python with `pip install --upgrade agenda-intelligence-md==1.11.1` and the ElizaOS plugin with `npm install @agenda-intelligence/plugin-guard@1.11.1`.

Financial checks no longer authorize transactions from caller-reported spending history or static denylist results. Treat `step_up_human_required` as a stop before signing. Legacy remote `allow` verdicts are downgraded by the SDK, and wallet adapters block execution on review.

Escrow validates a bounded offline JSON Schema subset. Missing or unsupported evidence requires human review with zero proposed payout and fee. Unknown and escalated rulings must not reach relayer execution. A passing supplied artifact remains an evidence evaluation, not settlement authorization.

Neither profile creates quorum proposals or fabricates Vizier receipts. Receipts are null and attestation is explicitly unavailable. These changes also apply to Python local fallback and ElizaOS clients.

The ElizaOS package now exposes escalation/schema types, maps Worker payouts to its documented `payout` field, and removes the placeholder evaluator that claimed to intercept transactions. Applications must explicitly integrate the check with their own review/signing workflow.

This release also includes the unreleased fleet-monitoring, discovery, telemetry and manual sanctions-index publication improvements listed in CHANGELOG.md. No new authoritative ledger or sanctions provider is introduced. Public API endpoints and v1 schema identifiers remain stable; financial decision behavior intentionally becomes more conservative.
