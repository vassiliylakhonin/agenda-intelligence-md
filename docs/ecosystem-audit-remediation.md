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

The audit reproduced Cloudflare HTTP 403 / error 1010 for Python urllib's default User-Agent on all thirteen public hosts. Requests with an explicit identifying application User-Agent and MCP SDK requests succeeded. This is a client compatibility mitigation, not a claim that the edge policy has been changed. A Worker cannot repair an HTTP request rejected before reaching it.

Use a truthful application identifier, not browser impersonation:

```python
from urllib.request import Request, urlopen

request = Request(
    "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/health",
    headers={"User-Agent": "MyAgent/1.0 (+https://example.org/agent)"},
)
with urlopen(request, timeout=15) as response:
    print(response.status)
```

For an MCP SDK client, pass the same explicit header through its HTTP transport. Existing Python financial/escrow clients already identify themselves. Do not retry with rotating/spoofed identities or disable protection globally. Removing the requirement for default urllib clients needs an administrator to identify the specific Cloudflare rule and apply a narrowly scoped machine-route exception, where supported for the deployed hostname. The follow-up response identifies Cloudflare error 1010 (`browser_signature_banned`). Cloudflare documents Browser Integrity Check as a relevant setting. The authenticated account currently has no owned domain zones, and the inspected Worker settings expose no Browser Integrity Check exception for `workers.dev`. The specific internal managed rule ID remains unavailable. No protection was disabled.

## Payment contract

`/v1/settle` requires tx_hash. Pro issuance additionally requires payer_signature, including when the tier is inferred from the paid amount. Sign the exact EIP-191 challenge returned by the service: `Agenda Intelligence MD pro-tenant settlement`, newline `tx_hash: <lowercase hash>`, newline `payer: <lowercase on-chain payer>`. Payment confirmation and Bearer issuance are not security clearance.

## Production rollout boundary

Run deployments through `scripts/vizier-gated-deploy.js` or `npm run deploy:all`. The gate requires a clean committed checkout, a short-lived owner-signed deployment grant, and a matching principal-signed Vizier ALLOW before Wrangler runs. The operator-controlled signer is separate from the deployment step. Never create an unsigned substitute, retrieve signing secrets into audit output, or use direct Wrangler deployment to bypass this gate.

The manual `Deploy existing Worker fleet through Vizier` GitHub workflow can deploy all existing TOML-configured targets from an immutable tested main commit. It reuses the existing protected production environment and mints a separate ten-minute, single-target grant per job. No local signing key is needed; it never deploys a PR branch or bypasses a BLOCK/REVIEW. The independent Vizier Worker is outside this fleet.

Cloudflare OAuth alone is insufficient. An unset VIZIER_DEPLOY_GRANT_FILE / unavailable operator signer leaves rollout pending. Source fixes and local test evidence do not establish that public sites have been updated. After authorized deployment, repeat SDK, REST refusal and A2A probes against each live hostname, and separately retest default urllib connectivity.

## Continuous read-only discovery monitoring

`python scripts/check_live_mcp.py --output live-mcp-report.json` requires the official `mcp==1.30.0` SDK. It derives the fleet from Wrangler TOML and includes independent Vizier. Each host gets health, A2A-card and ordinary SDK initialize/tools-list checks with no SDK header override. The reviewed catalog baseline includes 21 tools across 13 hosts; missing, renamed or unexpected tools fail discovery. Update `scripts/fleet_health/mcp-catalog-baseline.json` alongside intentional catalog changes. No tool execution, payments, grants or keys are performed. Default Python urllib initialize is reported separately; it never gets disguised as a successful compatibility check. `--require-default-urllib` additionally makes that limitation fail the process.

The `Live MCP client compatibility` workflow runs every four hours and after successful protected deployments. It uploads the JSON report, emits visible warnings for default-urllib incompatibility, and fails on SDK/health/A2A regressions. Pull requests changing the monitor also run it. Existing daily stateful fleet proofs remain separate. Scheduled GitHub Actions are best-effort, not an uptime SLA; GitHub notification delivery follows the repository owner's Actions settings.

Removing the default-urllib block is an infrastructure follow-up: a supported exception on the managed hostname, or an owner-controlled custom domain with a machine-route-scoped Browser Integrity Check rule. This account currently has no such domain; no domain purchase or support message was performed.
