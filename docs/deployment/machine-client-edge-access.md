# Machine-client edge access

## Active configuration

On 2026-10-21, the owner enabled the Configuration Rule **Agenda machine APIs -
BIC compatibility** (`c44f5e94022d468ab0caea0f121cf826`) in the active
`agendamcp.dpdns.org` zone. The existing Free plan supports this rule.

The rule matches only the thirteen canonical hostnames recorded in
[`scripts/mcp-monitor-origins.json`](../../scripts/mcp-monitor-origins.json) on
that date, including Vizier. It does not use a wildcard hostname and excludes
the separate `corridor.agendamcp.dpdns.org` deployment. On those hosts it matches:

- Exact paths `/mcp`, `/mcp/agent`, `/mcp/output-verification`, `/message/send`,
  `/health`, `/health/dependencies` and `/status`.
- Path prefixes `/.well-known/` and `/v1/`.
- `POST /`, the A2A JSON-RPC endpoint. Browser `GET /` is outside the exception.

Its only action is `set_config` with `{"bic": false}`. Global Browser Integrity
Check remains enabled. It changes no other WAF, DDoS, authentication, quota,
payment, signing or Worker settings. A new canonical hostname or machine route
requires reconciling this explicit filter; updating the inventory alone does
not update the live zone rule.

[Cloudflare documents selective BIC exceptions](https://developers.cloudflare.com/waf/tools/browser-integrity-check/)
and [path/hostname Configuration Rules](https://developers.cloudflare.com/rules/configuration-rules/).
This is an owned-zone configuration, not a Worker deployment or a fix for
legacy `workers.dev` URLs.

## Evidence and verification

Security Events matched Ray `a4df33029d28bcab`, `Python-urllib/3.12`,
`POST /mcp/agent` on `output-verification.agendamcp.dpdns.org`, to **Browser
integrity check / Block**. After activating the rule, the same host, request and
unchanged User-Agent returned HTTP 200 with an MCP initialization result.
The strict thirteen-host SDK, default urllib, application urllib, health and
signed A2A discovery monitor passed. No evaluation, trial, model API call or
payment was performed.

Run the existing read-only monitor with the official `mcp==1.30.0` SDK and Node 24:

```sh
python scripts/check_live_mcp.py --require-default-urllib --output live-mcp-report.json
```

The scheduled/post-deploy workflow supplies the strict flag for both full-fleet
and Output-only runs. Do not override the default urllib User-Agent to turn a
failed probe green. Maintainer traffic must keep its owner-purpose marker;
public clients need no such marker.

## Administration and rollback

Before another change, record the decision workspace and preserve the current
rule name, ID, filter, action and enabled status. Inspect the matching Security
Event rather than guessing from status 403 alone. A normal Wrangler credential
refresh can repair an expired token; it does not add WAF/settings permissions.
Do not interpret an API permission refusal as evidence that no domain exists.

For rollback, open **Rules → Overview → Configuration Rules** in the owned zone
and disable this one rule. Leave the global BIC switch enabled. Repeat the
strict monitor and record the expected compatibility failure if rollback
restores the original block. Never disable all WAF phases, change the client's
identity after a refusal, deploy a bypass proxy, or bypass the protected Worker
deployment workflow. Restoring scoped BIC restores its browser-oriented header
restriction; evaluate that tradeoff explicitly before rollback.
