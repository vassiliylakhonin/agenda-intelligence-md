# Fleet research implementation — 21 October 2026

Goal: restore usable services and make a concrete first assignment easier to
understand, prepare, correct and accept. The market evidence remains a hypothesis.

| Finding | Implementation / evidence |
|---|---|
| CIS source stale despite healthy discovery | Owner-authenticated clean-main publisher rebuilt all four sources and passed shape/canary/drift gates. Canonical file SHA-256 verified; dependency endpoint 200 with new 14:52:19 UTC timestamp. Monitor now fails on stale/disabled CIS source or age above 72h. |
| Manual-only refresh can recur | Protected daily Pages publisher invokes the existing gates, exact canonical hash verification and existing credential boundary. Initial run `39625335214` confirmed that the existing Worker token lacks Pages access. The publisher requires a separate owner-confirmed Pages credential in the same protected environment; Worker token scope stays unchanged. Operational success must be checked in a subsequent run. Read-only watchdog retained. |
| Corridor default Python 403/1010 | Owner confirmed the exact BIC-only rule extension for three machine paths. Default urllib and SDK discovery pass; anonymous tool call remains 401. Monitor covers its `/healthz` and MCP manifest without inventing a signed A2A contract. |
| Stale public descriptions | Snapshot activation/freshness, free trials, canonical origins and actual Escrow human-review scope corrected; package mirrors updated. |
| Ordinary answer formatting creates friction | Hosted answer review accepts paired typographic quotes and simple HTTP(S) Markdown source links. Label still resolves against supplied text; exact quote checks remain. Nested/unsafe/complex syntax stays a finding; no URL retrieval or semantic truth claim. |
| Routing makes users re-enter a question | Agenda/Assistant prepare target JSON locally. Exact compatible values and the verbatim question transfer; missing fields and mappings are explicit. No inferred identities/amounts, URL data, cross-origin submission, storage or trial consumption. |
| Minerals already has an evidence loop | Put its owner document requests first and expose a copyable request draft. Existing actual-handler MCP→A2A revision tests cover newly reviewable records, expiry, scope changes and removed adverse blockers. No supplier messages are sent. |
| Escrow example lacks actual artifact evidence | Saved intact artifact includes expected SHA-256 and supported schema; changed-content example fails hash. Both retain human review, unverified SLO and no settlement. Independent synthetic payment vector preserves exact-request recovery regression. |
| Corridor should produce a draft | Owner local SQLite exercise completes PREPARED→DRAFT_SUBMITTED→revised DRAFT_SUBMITTED, uses the actual calculator, retains unverified submission/human sign-off and owner isolation. No model, network or external reviewer is implied. |
| Sell a defined piece of work | Two English offers on existing landing pages: one project document/review or one workflow acceptance sprint. Written scope, test-price basis, sample, acceptance cases, one revision and private data-transfer agreement precede an order. API prices remain separate. |
| Distinguish demand from technical traffic | Engagement template records qualified opportunity, scope, payment, delivery, buyer acceptance/return and repeat payment separately. Includes labour, reviewer time, material errors and variable costs. No synthetic progress counts as revenue. |
| Trust versus actual execution authority | Document the client-specific Trust→authoritative executor/Vizier boundary in the service handover. No score/payment/hash becomes an authorization grant. Existing adapter is used where the scoped workflow needs enforcement. |

## Explicitly conditional research items

Supplier Evidence Desk stays a later bounded service test after a buyer purchases
and repeats a dossier task. A new hosted job/order platform, MPP/payment adapter,
custom identity infrastructure, universal registry, wallet, GPU inference, multi-
agent swarm and broader domain data providers need a measured bottleneck or a
paid requirement. They are not unconditional findings to implement immediately.
The existing APIs, trials, case/revision contracts and customer stack can serve
first use. No new framework, model key or payment rail was added.

Prospect discussions, actual contracts/payment, acceptance, paid repeats and
measured reviewer savings cannot be created by an owner self-test. Prepared
buyer questions and scope templates support those next actions; no outreach was
sent. There are no claimed new customers, revenue or independently verified
semantic outcomes.

## Verification

`make verify-local PYTHON=.venv/bin/python` covers Python, package/schema mirrors,
generators, contracts, lint/type checks and Worker tests. `node
examples/service-engagement/check-sample.mjs` reruns the local synthetic repair
and artifact example. Strict live discovery checks official SDK, default urllib,
public metadata and dependency readiness for fourteen services, with maintainer
headers and no paid evaluations. The production deploy uses the existing
Vizier-gated fleet workflow; deployment and daily-publisher run results must be
recorded in the release evidence, not inferred from a green local test.
