# Machine-client edge access

## Active configuration

On 2026-10-21, the owner enabled the Configuration Rule **Agenda machine APIs -
BIC compatibility** (`c44f5e94022d468ab0caea0f121cf826`) in the active
`agendamcp.dpdns.org` zone. The existing Free plan supports this rule.

The rule matches only the fourteen canonical hostnames recorded in
[`scripts/mcp-monitor-origins.json`](../../scripts/mcp-monitor-origins.json) on
that date, including Vizier and the standalone Corridor service. It does not use
a wildcard hostname. On the original thirteen hosts it matches:

- Exact paths `/mcp`, `/mcp/agent`, `/mcp/output-verification`, `/message/send`,
  `/health`, `/health/dependencies` and `/status`.
- Path prefixes `/.well-known/` and `/v1/`.
- `POST /`, the A2A JSON-RPC endpoint. Browser `GET /` is outside the exception.

On `corridor.agendamcp.dpdns.org`, a separate OR branch matches only exact
`/mcp`, `/healthz` and `/.well-known/mcp.json`. This extension was confirmed by
the owner at action time. Public discovery works with normal urllib; every
anonymous `tools/call` still requires the operator-issued Bearer key.

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
The initial strict thirteen-host SDK, default urllib, application urllib, health and
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

## Dependency readiness and publication

The monitor now covers fourteen services. Corridor uses its own `/healthz` and
MCP manifest contract; it does not publish a signed A2A card. Signature checks
remain mandatory on the other thirteen. The twelve fleet dependency endpoints
are checked separately from liveness; CIS must report `snapshot.status=success`
and an age no greater than its configured maximum or 72 hours, whichever is lower.

The CIS snapshot was rebuilt and gated from all four official sources on
2026-10-21 at 14:52:19 UTC, with 88,626 names. The canonical uploaded file's SHA-256
was `f8fceb4b2f900febe467e4db47655317ddd36b4f5337c8e2d89637da6afe50bc`.
The Worker's dependency endpoint confirmed the new timestamp and HTTP 200.
Its runtime digest fingerprints the parsed index, rather than uploaded bytes.
The protected daily publisher runs the existing clean-main publication gates;
the independent daily watchdog remains read-only. Address publisher and
watchdog/monitor failures before allowing the snapshot to expire again. The
local owner-authenticated publisher remains the recovery path. No age
threshold, source/canary/drift gate, authorization or quota was weakened.
