# Agenstry discovery and ownership

## Hosted fleet and installable package

The deployed Workers expose public Agent Cards at `/.well-known/agent-card.json`,
MCP discovery at `/mcp`, and A2A at `/message/send`. Their cards describe the
capabilities of the selected Worker profile. The Python package remains a
separate installable stdio MCP server:

```bash
pip install agenda-intelligence-md
agenda-intelligence-mcp
```

Use the Worker URL for a hosted listing. Use the repository/package for the
installable MCP listing. Follow the [hosted quickstart](../deployment/hosted-quickstart.md)
for actual request envelopes, structured examples and the signed payment path.

## Free discovery and paid evaluation

Cards, MCP initialize/tools-list, fixed synthetic worked examples and the no-op
heartbeat are public. Live evaluations use the configured pay-per-call policy.
A free example is a precomputed demonstration, not a live or paid evaluation.
Discovery does not authorize a transaction or establish successful client use.

Financial Guard reviews supplied pre-sign evidence against local risk rules.
M2M Escrow reviews delivery evidence and proposed allocations; it does not
execute or authorize payouts. Other profiles keep their published evidence and
human-review boundaries. Do not describe these checks as factual-truth
verification, identity authentication, current sanctions clearance or guaranteed
safety.

## Verify a workers.dev domain

1. In Agenstry Account, enter the exact Worker hostname and select the
   `/.well-known/ file` method, since workers.dev DNS is not under our control.
2. Copy that domain's issued public challenge into its own
   `AGENSTRY_VERIFY_TOKEN` environment variable in `wrangler.toml`.
3. Run local checks and deploy through the existing Vizier-protected workflow.
4. Check the live `/.well-known/agenstry-verify` response against the exact issued
   token, then select **Check now** in Agenstry and confirm **verified**.

Challenges are public ownership proofs, not API credentials. A shared placeholder
or a challenge issued for another domain is not a valid proof. Existing issued
file proofs are covered by the Worker regression tests.

Indexing, ownership verification, technical conformance and revenue evidence are
separate states. A public listing need not be bound to the owner's account.
Account impressions and calls cover Agenstry's own measurements and do not
replace direct Worker telemetry. Do not publish test traffic as customers or
revenue.

## Improve discovery honestly

Keep stable skill IDs and describe actual inputs, outputs and bounded examples.
Link the structured contracts and quickstart rather than inventing additional
skills to increase a score. Legal registry IDs and stronger authentication schemes
should only be declared when real and implemented. Submit revenue evidence only
for real independent settlements. Catalog scores may lag a deployment; inspect
both the public listing and current readiness result.
