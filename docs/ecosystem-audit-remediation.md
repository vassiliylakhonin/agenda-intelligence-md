# Ecosystem audit remediation

Scope: the twelve Agenda-profile Workers, plus connectivity checks for the independent Vizier deployment. No real payments, wallet signatures, sanctions-clearance certification or settlement execution are part of verification.

## Corrected runtime behavior

- Bankability requires documented capex, debt and DSCR. Text hints cannot supply missing financial data. Optional guarantee flags must be actual JSON booleans. Zero debt remains zero. Both Python and Worker paths expose mandatory human signoff and unverified-input labels.
- Bankability output uses internal illustrative thresholds. Paid output is a Markdown memo and JSON schedule with a 15-year tenor and assumed 5.5% interest. It does not generate Excel/PDF files; workbook digests are null, rather than the SHA-256 of an unrelated empty file.
- Financial Guard checks encoded ERC-20 approve even if the caller says transfer. Well-formed calldata is decoded by allowance word, rather than matching arbitrary 128-bit sequences. Invalid nested method/calldata types return HTTP 400.
- Escrow rejects malformed declared digests, out-of-range fees, unsupported policies and invalid percentage thresholds. Delivery/time telemetry remains caller-reported: hold for human review, never authorize payout.
- Dual-Use structured JSON exposes human_review_required, factual_verification_performed=false, score_scope, evidence_gaps and not_advice_notice. Readiness is readiness for human review, not export authorization.
- DLP receipt forwarding has explicit scope and signature_verified=false. Unknown ownership stays unknown; a country code is not a counterparty identity. Legacy clearance fields do not expose a DLP token as general sanctions clearance.
- A confirmed payment does not manufacture a Vizier attestation. Financial Guard reports payment confirmation separately and retains mandatory human review.
- Output verification reports missing supporting quotes/source content and repair actions even when an evidence identifier is supplied.
- Strict output schemas include runtime provenance fields and unicode_normalization; packaged schema copies and generated MCP/TypeScript contracts are kept in sync.

## Machine clients and edge HTTP 403

The audit reproduced Cloudflare HTTP 403 / error 1010 for Python urllib's default User-Agent on all thirteen public hosts. On 2026-10-21, Cloudflare Security Events identified the exact request as a Browser Integrity Check block. The owned `agendamcp.dpdns.org` zone now has a narrowly scoped BIC exception for the thirteen canonical hosts' machine routes. The unchanged default-urllib reproduction and the strict thirteen-host discovery monitor pass. See the [configuration and rollback runbook](deployment/machine-client-edge-access.md).

A truthful application identifier remains useful client practice; the owned machine routes also accept urllib's default identity:

```python
from urllib.request import Request, urlopen

request = Request(
    "https://agendamcp.dpdns.org/health",
    headers={"User-Agent": "MyAgent/1.0 (+https://example.org/agent)"},
)
with urlopen(request, timeout=15) as response:
    print(response.status)
```

The official MCP SDK works with its normal User-Agent. Existing Python financial/escrow clients already identify themselves. Do not rotate/spoof identities after a refusal or disable protection globally. A Worker cannot repair a request blocked before it reaches the runtime. The BIC exception changes only the owned zone's matching requests; it does not establish compatibility on legacy `workers.dev` hostnames.

## Payment contract

`/v1/settle` requires tx_hash. Pro issuance additionally requires payer_signature, including when the tier is inferred from the paid amount. Sign the exact EIP-191 challenge returned by the service: `Agenda Intelligence MD pro-tenant settlement`, newline `tx_hash: <lowercase hash>`, newline `payer: <lowercase on-chain payer>`. Payment confirmation and Bearer issuance are not security clearance.

## Production rollout boundary

Run deployments through `scripts/vizier-gated-deploy.js` or `npm run deploy:all`. The gate requires a clean committed checkout, a short-lived owner-signed deployment grant, and a matching principal-signed Vizier ALLOW before Wrangler runs. The operator-controlled signer is separate from the deployment step. Never create an unsigned substitute, retrieve signing secrets into audit output, or use direct Wrangler deployment to bypass this gate.

The manual `Deploy existing Worker fleet through Vizier` GitHub workflow can deploy all existing TOML-configured targets from an immutable tested main commit. It reuses the existing protected production environment and mints a separate ten-minute, single-target grant per job. No local signing key is needed; it never deploys a PR branch or bypasses a BLOCK/REVIEW. The independent Vizier Worker is outside this fleet.

Cloudflare OAuth alone is insufficient. An unset VIZIER_DEPLOY_GRANT_FILE / unavailable operator signer leaves rollout pending. Source fixes and local test evidence do not establish that public sites have been updated. After authorized deployment, repeat SDK, REST refusal and A2A probes against each live hostname, and separately retest default urllib connectivity.

## Continuous read-only discovery monitoring

`python scripts/check_live_mcp.py --require-default-urllib --output live-mcp-report.json` requires the official `mcp==1.30.0` SDK. It derives the fleet from Wrangler TOML and includes independent Vizier, using the canonical owned domains in `scripts/mcp-monitor-origins.json`. Each host gets health, A2A-card and ordinary SDK initialize/tools-list checks with no SDK header override. Missing, renamed or unexpected tools fail discovery. Update `scripts/mcp-catalog-baseline.json` alongside intentional catalog changes. No tool execution, payments, grants or keys are performed. The separate default Python urllib initialize probe keeps its unchanged User-Agent, and the strict flag makes any refusal fail the process.

The `Live MCP client compatibility` workflow runs every four hours and after successful protected deployments. Both fleet and Output-only runs require default-urllib compatibility, SDK, health and signed A2A checks. It uploads the JSON report and fails on regressions. Pull requests changing the monitor also run it. Existing daily stateful fleet proofs remain separate. Scheduled GitHub Actions are best-effort, not an uptime SLA; GitHub notification delivery follows the repository owner's Actions settings.

The existing domain and Free plan supported the scoped fix. No domain purchase, plan upgrade or Worker redeployment was needed.

## Standard-library discovery example

Run `python3 scripts/urllib_mcp_client.py` for root discovery, or pass an existing Worker MCP URL as its argument. This standard-library-only example returns `{server, tools}` JSON using an explicit `Agenda-urllib-client/1.0` identity. It is a minimal JSON discovery example for the deployed stateless Workers, not a general session/SSE MCP transport. Use the official MCP SDK for general protocol support. No global urllib monkey patch, browser impersonation or infrastructure change is needed.

Financial, escrow, human-review and fleet-proof Python clients already send explicit application headers. Telemetry identifies itself truthfully. The live monitor independently checks application-identified urllib initialize/tools-list, ordinary SDK discovery and untouched default-urllib initialize. Maintainer checks retain `X-Client-Id: agenda-owner-<purpose>` without overriding the SDK/default urllib User-Agent.

## 2026-10-21 administrative diagnosis

The earlier zones API refusal used expired Wrangler OAuth credentials and did
not establish absence of an owned zone. A normal refresh of the existing grant
allowed inventory reads and confirmed the active custom domain. WAF/settings
APIs still refused that credential's insufficient permissions; no grant was
expanded. The authenticated owner dashboard supplied the matching Security Event
and the supported Configuration Rule. The owner confirmed activation of the
prepared rule. The global BIC setting remains enabled; only the documented
machine-route exception is active. The successful live checks are infrastructure
compatibility evidence, not external demand, tool-quality or paid-usage evidence.
