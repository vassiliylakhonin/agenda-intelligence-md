# Server research validation — 2026-10-27

Status: local implementation validated; production resources and activation are pending owner approval.
No production research job or real model invocation has been performed.

## Checks

- `make ci PYTHON=.venv/bin/python`: passed, 1,222 Python tests passed, one skipped; lint, types, paired assets, generated TypeScript check, CLI validators and MCP stdio smoke passed.
- Worker `npm test` with Node 24: 1,110 tests passed, including 19 new server-research scenarios.
- Wrangler 4.153.0 `deploy --dry-run --env ''`: passed; Workflow, dedicated D1, AI and existing bindings recognized. No deployment or resource creation occurred.
- Real source collector, run from the maintainer machine on 2026-10-27 around 10:20 UTC: all four official pages read, no access failures. This proves access from that machine at that time, not Cloudflare-runtime access or research quality.

## Collected source metadata

```json
{
  "sources": [
    {
      "id": "S1",
      "url": "https://middlecorridor.com/en/press-center/news/16-10-2026",
      "title": "TITR Association Participates in TransLogistica Kazakhstan 2026",
      "published_at": "2026-10-16T11:07:27.000Z",
      "freshness": "in_requested_window",
      "text_characters": 3312
    },
    {
      "id": "S2",
      "url": "https://www.worldbank.org/en/region/eca/publication/world-class-trade-logistics-along-trans-caspian-transport-corridor",
      "title": "Integration: World-Class Trade Logistics Along the Trans-Caspian Transport Corridor",
      "published_at": null,
      "freshness": "publication_date_unknown",
      "text_characters": 10633
    },
    {
      "id": "S3",
      "url": "https://www.carecinstitute.org/news/carec-institute-holds-online-policy-dialogue-on-transport-and-digital-logistics/",
      "title": "CAREC Institute Holds Online Policy Dialogue on Transport and Digital Logistics",
      "published_at": "2026-07-17T00:00:00.000Z",
      "freshness": "background",
      "text_characters": 4904
    },
    {
      "id": "S4",
      "url": "https://www.eabr.org/en/analytics/all-publications/transport-corridors-infrastructure/",
      "title": "Transport Corridors Infrastructure: Project Observatory and Interactive Map of the Eurasian Transport Network – 2026",
      "published_at": "2026-07-23T00:00:00.000Z",
      "freshness": "background",
      "text_characters": 4485
    }
  ],
  "failures": []
}
```

## Behavioral coverage

Tests exercise REST and stateless MCP admission/execution/polling with real SQLite and fixture HTTP/model responses; private capabilities; idempotency; concurrent global and per-capability quotas; invalid inputs; redirect host checks; source byte/media bounds; failures without synthesis; missing publication/observation dates; recent-link selection; untrusted source directives; exact quote/source-ID/quotation limits; journaled model outcomes and replay; working-text expiry; browser storage denial, lost replies and an explicit fresh run.

The fixture model does not establish live model quality. Quote matching does not establish semantic support or truth. The live source collection is narrow and includes background/undated documents. No customers, revenue, accepted deliverables, operational route availability or production reliability are claimed.

## Remaining activation gate

Automatic approval review rejected creation of `agenda-corridor-research` D1 because it is a persistent resource with possible costs and maintenance. No database was created and the rejection was not bypassed. The prepared activation requests one dedicated D1 database, one Workflow, a Workers AI binding and a Vizier-gated release of the existing root Worker; no plan upgrade or new domain. Initial admission is five jobs per UTC day globally, two per caller capability, one model dispatch per job, 20,000 prompt bytes and 2,048 output tokens.

After owner approval, configure/migrate the dedicated database, enable research, deploy through Vizier and run one owner-marked end-to-end live job. Source access, model output validation, private polling, allowance and visible output must all pass before claiming the server researcher is live.
