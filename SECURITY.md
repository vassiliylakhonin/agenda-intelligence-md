# Security Policy

## Reporting a vulnerability

Please report security issues privately through [GitHub Security Advisories](https://github.com/vassiliylakhonin/agenda-intelligence-md/security/advisories) or email [vassiliylakhonin@gmail.com](mailto:vassiliylakhonin@gmail.com), the primary security contact. Do not open public issues for undisclosed vulnerabilities. Include the affected version, interface, configuration prerequisites and minimal reproduction.

## Scope

The owned repository includes the Python package, CLI, MCP stdio and A2A adapters, portable HTTP server, schemas and packaged references; the hosted Cloudflare Worker fleet and its HTTP/MCP/A2A transports; payment, trial, task-continuation and receipt code; action-execution integrations; Solidity escrow and release/deployment tooling. These shipped surfaces are in scope even where a feature is optional. Other services and repositories are dependencies rather than code owned here; integration mistakes in this repository remain in scope.

Report supply-chain/integrity failures, meaningful validation bypasses, authentication or authorization failures, payment or approval replay, cross-caller data access, secret exposure, unsafe destinations, resource abuse and injection that crosses a real trust boundary. Source text, tool results and caller evidence are untrusted data, never instructions or authority.

## Boundaries and security objectives

- Keep bearer authentication, payment entitlement, trial quotas, task capabilities and actual action authorization separate. Public discovery and a caller label do not authenticate a principal.
- Preserve exact request, principal, scope, expiry and human-approval binding before privileged dispatch. An evidence score, paid response or signed evaluation receipt does not grant execution authority.
- Prevent one payment, delegation or approval from admitting a different request or repeated external action. Validate persistent-state failure and concurrency behavior against the relevant admission control.
- Protect credentials, private signing material, caller evidence and operator-only telemetry/intake access. Public JWKS must contain only public keys.
- Bound parsing and upstream work; preserve provenance and explicit degraded/unassessed states when evidence or a configured upstream is unavailable.
- Verify package data consistency and privileged release/deployment inputs.

These are assessment objectives, not a claim that every implementation path already satisfies them. Operators configure portable HTTP authentication, hosted production keys, task capability mode and external integrations; assess the actual configuration and control that a caller reaches.

## Known limitations and assessment context

The core evidence checks enforce structure, supplied references and quote consistency; they do not independently establish factual truth, legal compliance or sanctions clearance. Optional model, OpenSanctions and hosted upstream integrations exist and have separate data recipients. Do not treat historical blanket descriptions of “no retrieval” or “no billing” as an exclusion of their shipped code.

High-stakes legal, compliance, financial, sanctions and security decisions require independent human review. Integrations must protect credentials and replay state and make the guarded dispatch path the only action capability available to an untrusted agent.

Severity depends on the added capability and actual impact, including required credentials, deployment mode and reachable assets. Existing authorized host/operator access is not an assumed anonymous-attacker capability. No new finding classes or accepted risks are excluded by this policy.

See [.oss-scanner/threat_model.md](.oss-scanner/threat_model.md) for the source-backed architecture and review questions. Scanner enrollment, signed cards and passing tests are not a security certification.

## x402 payment path: audit status and accepted residual risks

The Worker's x402 v2 path (exact scheme, EIP-3009, Base USDC) was code-audited on 2026-11-10 against the five attacks in arXiv 2605.11781 ("Five Attacks on x402 Agentic Payment Protocol"). This was a code review. No real-money payment has been run end to end, so the behaviors below are covered by offline tests with mocked facilitator and RPC, not by live validation.

Design points: the facilitator's `/settle` reply never releases a result by itself; the Worker confirms the transfer on chain (receipt status, `AuthorizationUsed` and `Transfer` logs, exact value to the fleet wallet) before delivery. Claims are written before execution, bound to the request hash, and the sealed result is replayed to the same authorization.

Changes made after the audit: the log scan window is anchored before the facilitator call; a `/settle` that failed before broadcasting is retried while the authorization is valid; claims are keyed by (transaction, payer, nonce) so several authorizations in one transaction do not collide, with legacy raw transaction claims still blocking reuse; results are released only after 3 blocks (12 blocks from 10 USDC, including the legacy Pro settlement path).

Accepted residual risks:

- Anyone who sees the `PAYMENT-SIGNATURE` header can submit the authorization on chain first. Funds still go only to the fleet wallet for the signed amount, and the Worker finds that transaction by its on-chain log. If it is mined before the Worker's first RPC call, facilitator `/verify` fails and the caller gets a 402 even though the transfer happened. Callers should not retry with a new signature without checking their balance.
- Confirmation depth reduces but does not remove reorg risk. A deeper reorg than 3 (or 12) blocks could undo a paid transfer after delivery.
- Settlement is not bound to one facilitator, and the facilitator is trusted only for `/verify` and for broadcasting, not for finality.
- The log scan reads at most 5000 blocks from the anchor, far more than the 150 second authorization window.
- A claim keyed by the legacy path and an x402 claim for the same transaction are checked in sequence, not in one atomic write.
