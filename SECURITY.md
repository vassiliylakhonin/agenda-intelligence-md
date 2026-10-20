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
