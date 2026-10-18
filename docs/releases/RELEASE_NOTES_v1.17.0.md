# Agenda Intelligence MD 1.17.0

This release synchronizes the installed package, hosted Worker metadata, signed
cards and official MCP Registry version after the October 18 behavior changes.

- Advisory evaluations expose `next_action: block | review | insufficient`,
  `decision_kind`, `score_kind` and `authorization_granted: false`, alongside
  existing detailed verdicts. They never authorize a real-world action.
- Every mismatched supplied quote is unsafe even beside a matching quote;
  missing source text remains insufficient evidence. Illustrative/placeholder
  references do not establish documentary readiness. Screening and caller claims
  expose their unassessed/unverified boundaries.
- All twelve saved landing examples are regenerated from actual local handlers.
  Worker tests and deployment preflight now check for stale saved responses.
- Existing trials support native MCP and optional native A2A metadata. Standard
  x402 v2 exact Base native-USDC EIP-3009 is available through HTTP/MCP alongside
  the legacy payment adapter, with unchanged prices and trial quotas.
- Hosted Output Verification optionally signs a short-lived evaluation receipt;
  the official-client example verifies origin, key, request/result binding and
  expiry. A receipt is not factual verification, caller identity or permission.

The x402 settlement path is covered with pinned official clients and simulated
facilitator/chain responses. No funded live transfer or successful production
settlement is claimed. Discovery, refusal and quota-respecting production checks
are separate from a paid end-to-end test or independent customer adoption.

Cache refresh still follows each endpoint's HTTP policy. The new version lets a
client detect the release when it next refreshes metadata; it does not remotely
invalidate an arbitrary client's cache.
