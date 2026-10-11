# Hosted custom domains

The registered domain `agendamcp.dpdns.org` serves the existing Worker fleet through Cloudflare Custom Domains. DNS and HTTPS are managed by Cloudflare. These are additional hostnames for the same deployed services; their tools, quotas, authentication, signed delegation and payment requirements are unchanged.

The free directory is `https://agendamcp.dpdns.org/.well-known/fleet.json`. Standard MCP clients use `/mcp/agent` for Agenda profiles and `/mcp` for Vizier. Initializing MCP and listing tools does not evaluate a paid task.

| Worker | MCP endpoint |
|---|---|
| middle-corridor-deal-risk-gate-a2a | https://middle-corridor-deal-risk-gate.agendamcp.dpdns.org/mcp/agent |
| cis-secondary-sanctions-a2a | https://cis-secondary-sanctions.agendamcp.dpdns.org/mcp/agent |
| gulf-maritime-exposure-a2a | https://gulf-maritime-exposure.agendamcp.dpdns.org/mcp/agent |
| kazakhstan-market-entry-readiness-a2a | https://kazakhstan-market-entry-readiness.agendamcp.dpdns.org/mcp/agent |
| corridor-sanctions-assistant-a2a | https://corridor-sanctions-assistant.agendamcp.dpdns.org/mcp/agent |
| critical-minerals-due-diligence-a2a | https://critical-minerals-due-diligence.agendamcp.dpdns.org/mcp/agent |
| dual-use-technology-export-a2a | https://dual-use-technology-export.agendamcp.dpdns.org/mcp/agent |
| agent-financial-guard-a2a | https://agent-financial-guard.agendamcp.dpdns.org/mcp/agent |
| m2m-escrow-arbiter-a2a | https://m2m-escrow-arbiter.agendamcp.dpdns.org/mcp/agent |
| agent-output-verification-a2a | https://output-verification.agendamcp.dpdns.org/mcp/agent |
| agentic-interaction-trust-a2a | https://interaction-trust.agendamcp.dpdns.org/mcp/agent |
| agenda-intelligence-a2a | https://agendamcp.dpdns.org/mcp/agent |
| vizier | https://vizier.agendamcp.dpdns.org/mcp |

Existing `workers.dev` URLs remain available for compatibility. OAuth issuer/resource identifiers and delegation verification are preserved; switching a network hostname does not grant authority to an agent. Marketplace ownership verification identifiers remain as registered.

Custom Domains were added to the existing Workers through Cloudflare, with no additional subscription selected. The current Wrangler configuration omits custom-domain routes; deployment must preserve the existing dashboard-managed domains. If infrastructure configuration later takes ownership of domains, configure each environment explicitly to prevent a top-level route being reassigned to another Worker.

DigitalPlat lists registration on 2026-10-11 and expiry on 2027-10-11. Free renewal is available within 120 days of expiry; registration is not a permanent guarantee of domain ownership.

Verification: validate HTTPS normally (never disable certificate checks), fetch each health and discovery endpoint, initialize an official MCP client, list tools, and follow the fleet directory. Run declared owner probes with `X-Client-Id: agenda-owner-manual` so the checks are excluded from candidate usage. Do not pay, sign, or use a trial merely to test discovery.
