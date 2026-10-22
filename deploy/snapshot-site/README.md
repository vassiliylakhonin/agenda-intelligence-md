# Sanctions snapshot publication

The CIS worker reads the canonical public machine URL:
`https://sanctions-index.agendamcp.dpdns.org/sanctions-name-index-compact.json`.
The existing CIS Worker serves this exact GET/HEAD path from its own Static
Assets binding. No request-time fetch or proxy to Pages is involved. The
screening adapter and dependency health read the same binding directly when
the canonical URL is configured, avoiding same-zone Worker Route fetch limits.
A missing/refused binding degrades without a network fallback; the existing
isolate cache, provenance digest and72-hour runtime freshness gate remain.
The
separate `sanctions-name-index` Pages project retains the full and compact
compatibility publications; its `pages.dev` default-urllib access is not claimed
fixed.

Cloudflare case02390282 traced the customer's BIC-only Skip as applied despite
HTTP403/error1010. Support attributes the remaining signature-dependent block
to Pages-side processing, outside our zone rules. The machine host's existing
BIC exceptions remain scoped to GET/HEAD of this one public file. Other zone
protections, authentication, quotas and API behavior are preserved.

Rehearse all four official-source, canary, shape, timestamp and 10% drift gates:

```
python3 scripts/publish_sanctions_index.py
```

The protected `Publish gated sanctions snapshot` workflow on immutable clean
main runs daily at04:05 UTC and supports manual dispatch. It first rebuilds and
gates the candidate, then mints a ten-minute owner grant in a separate signer
step. `--publish-prepared` rechecks the candidate gates, publishes Pages with the
existing Pages-only credential, and deploys only the compact asset with the
existing Worker credential through `vizier-gated-deploy.js`. It requires both
credentials and the signed grant before either upload; neither credential is a
fallback for the other. The asset SHA-256 is included in the Vizier request and
deployment message and rechecked before Wrangler runs. Publication succeeds only
when unchanged default urllib receives the exact canonical bytes. HTTP401/403
stops verification without retry, redirect or changed identity. A partial failure
is reported as a failed release; Pages and Worker are separate deployments.

Normal fleet deployments restore the canonical compact bytes using default
urllib, then verify freshness (72h), shape, name count and canaries. The generated
`deploy/snapshot-worker-assets/` directory may contain only the single compact
file; metadata, full indexes, symlinks and other files are refused. Only the CIS
environment has the assets binding; Worker-first routing prevents static assets
from bypassing the hostname/method/path contract. The dashboard-managed exact
route to `cis-secondary-sanctions-a2a` is:
`https://sanctions-index.agendamcp.dpdns.org/sanctions-name-index-compact.json`.
Existing dashboard-managed CIS custom domains must remain attached.

For the one-time origin migration, the existing fleet workflow's explicit
`bootstrap_snapshot=true` restores only the compact recovery artifact from
successful main watchdog run39755543609, generated2026-10-22T09:28:05Z,
88633 names/four sources, raw SHA-256
`82464686b3209b877202b31a22f3223bc4f75718d6fec3b69d5c310e6f4cee86`.
It still passes the canary, count and72-hour gates. A different artifact, stale
file or absent provenance fails; there is no automatic bootstrap fallback after
a canonical refusal. Ordinary releases use the default false value. Snapshot
publication and fleet deployment share a concurrency group so an older restored
asset cannot race a new daily snapshot.

The independent daily watchdog checks the canonical default-urllib URL and72h
freshness, rebuilds all four sources and compares name-count drift when possible.
A temporary source outage warns while production remains fresh; stale production
fails and a successful rebuild is preserved for seven days. `generated_at_utc`
is the screening freshness bound; a name match remains a possible string match,
not entity identity or a sanctions determination. Human review remains required.

The dedicated `agenda-cis-snapshot-pages` token retains only Account / Cloudflare
Pages / Edit for the owned account, expiring2027-01-19 at23:59 Asia/Almaty.
Cloudflare scopes it to Pages in the account. `CLOUDFLARE_PAGES_API_TOKEN` remains
separate from the existing Worker token; neither is widened. The Pages project
GET authentication checks the expected project/subdomain, a bounded response,
explicit account and no redirects. Local OAuth authentication still requires
exactly one account. Store no credential or grant value in source or artifacts.

Rollback: redeploy a reviewed earlier Worker and its verified asset through the
same Vizier gate; preserve its snapshot age limit. Removing the exact dashboard
route returns that machine URL to Pages (which may return403), so it is not a
successful compatibility fix. The original Pages URL remains available to its
existing consumers. Never replace a failed deployment with ungated Wrangler or
weaken additional security products to make a probe pass.
