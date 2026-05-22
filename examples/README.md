# Examples

Worked examples for the Agenda Intelligence MD product shell. The examples here serve **four distinct purposes**; pick the group that matches what you're trying to do.

Every example declares its evidence mode. None of these are intelligence products. None are legal, compliance, sanctions, AML, or investment advice. Live retrieval and factuality verification are explicit non-goals of this repo — see [`README.md`](../README.md) and [`AGENTS.md`](../AGENTS.md).

## Learning path

Most contributors want one of the four loops below. Skim them in order to see the full surface of the product shell, then deep-dive into the loop you care about.

1. **The schema contract** (5 min) — open [`agenda-request.json`](agenda-request.json) and [`agenda-brief.json`](agenda-brief.json), then run `agenda-intelligence validate-brief examples/agenda-brief.json`. Smallest complete loop: request → memo → schema validation.
2. **The protocol value-prop** (10 min) — read [`before-after/`](before-after/) (`eu-ai-act.md`, `red-sea-shipping.md`, `sanctions-routing.md`). Each shows the same question handled without the protocol vs with it, plus a scoring rubric. This is the clearest demonstration of *why* the project exists.
3. **A full source-anchored memo + JSON projection** (10 min) — read [`source-backed/critical-minerals-export-controls.md`](source-backed/critical-minerals-export-controls.md) alongside its paired files: `.brief.json` (JSON projection), `.evidence.json` (evidence pack), `.audit.json` (audit output). Then run `agenda-intelligence validate-brief` and `validate-evidence` on the JSON files. This is what `live_source_backed` mode looks like end-to-end.
4. **Geography routing in practice** (5 min) — read [`central-asia-caspian-brief.md`](central-asia-caspian-brief.md), [`middle-east-brief.md`](middle-east-brief.md), [`eu-brief.md`](eu-brief.md), [`hormuz_strait_brief.md`](hormuz_strait_brief.md). Each is a brief produced for one of the routed regions; compare to the term sets in [`AGENTS.md`](../AGENTS.md) "Geography routing" and the regional references vendored under `skills/agenda-intelligence/references/regional/`.

## Index by purpose

### 1. Schema contract (request / memo / evidence)

| File | Schema | Try it |
|---|---|---|
| [`agenda-request.json`](agenda-request.json) | `schemas/agenda-request.schema.json` | `agenda-intelligence validate-manifest` (covers the request surface) |
| [`agenda-brief.json`](agenda-brief.json) | `schemas/agenda-brief.schema.json` | `agenda-intelligence validate-brief examples/agenda-brief.json` |
| [`source/evidence-pack.json`](source/evidence-pack.json) | `schemas/evidence-pack.schema.json` | `agenda-intelligence validate-evidence examples/source/evidence-pack.json` |

### 2. Protocol value-prop (before / after)

See [`before-after/README.md`](before-after/README.md) for the full pattern. Worked cases:

- [`before-after/eu-ai-act.md`](before-after/eu-ai-act.md)
- [`before-after/red-sea-shipping.md`](before-after/red-sea-shipping.md)
- [`before-after/sanctions-routing.md`](before-after/sanctions-routing.md)
- [`before-after/evaluation-rubric.md`](before-after/evaluation-rubric.md) — the rubric used to score the deltas

### 3. Source-anchored memos with JSON projections

Each markdown memo under [`source-backed/`](source-backed/) is paired with its JSON projection files (`.brief.json` + `.evidence.json` + `.audit.json` where present). This is the canonical demonstration of `live_source_backed` mode and the audit surface.

| Memo | Domain | Paired JSON |
|---|---|---|
| [`source-backed/critical-minerals-export-controls.md`](source-backed/critical-minerals-export-controls.md) | Trade / strategic minerals | `.brief.json`, `.evidence.json`, `.audit.json` |
| [`source-backed/iran-secondary-sanctions.md`](source-backed/iran-secondary-sanctions.md) | Iran / secondary sanctions | (see directory) |

Other JSON-only briefs under `source-backed/` (us-china tariffs, EU CSRD, EU DSA, UK-EU regulatory divergence, Fed rate hold divergence, Red Sea shipping, Turkey elections) demonstrate the JSON surface in isolation, without the markdown counterpart.

### 4. Geography routing demonstrators

Each of these is a brief produced for one of the routed regions in `analyze`. Compare against the term sets in [`AGENTS.md`](../AGENTS.md) "Geography routing".

| Region | Example |
|---|---|
| Central Asia + Caspian | [`central-asia-caspian-brief.md`](central-asia-caspian-brief.md) |
| Gulf + Middle East | [`middle-east-brief.md`](middle-east-brief.md), [`hormuz_strait_brief.md`](hormuz_strait_brief.md) |
| EU | [`eu-brief.md`](eu-brief.md) |
| Sector — sanctions | [`sector/sanctions-brief.md`](sector/sanctions-brief.md) |

### 5. Memo shape variants

| File | Use when |
|---|---|
| [`compact-brief.md`](compact-brief.md) | Smallest valid brief shape — useful as a reference for the minimum sections |
| [`red-team-brief.md`](red-team-brief.md) | Challenging an existing claim or framing rather than drafting neutral analysis |

## Evidence modes

The product shell accepts these `evidence_mode` values in the request/memo contract (note: **product-shell vocabulary**, not the specialist-example vocabulary):

| `evidence_mode` | What it means | Example |
|---|---|---|
| `reasoning_only` | No sources retrieved or supplied; structural reasoning only | [`compact-brief.md`](compact-brief.md) |
| `user_provided` | The caller supplies sources in the request | (see `agenda-request.json` shape) |
| `mixed` | Some sources supplied, some not — each claim carries explicit provenance | (specialist examples often map here; see sibling skill repos) |
| `live_source_backed` | Sources retrieved and cited at memo write-time. Per `AGENTS.md`: this is the *caller's* claim; the product shell does not retrieve sources itself | [`source-backed/critical-minerals-export-controls.md`](source-backed/critical-minerals-export-controls.md) |

The vertical-specialist repos use a different evidence-mode vocabulary (`live-source-backed`, `user-provided sources`, `illustrative source packet`, `reasoning-only`). Mapping is documented in `AGENTS.md` of each specialist repo; the common case is that specialist `live-source-backed` material maps to product-shell `user_provided` or `mixed`, not `live_source_backed`, because the product shell does not retrieve sources itself.

## How to judge an example

A strong example should:

- declare `evidence_mode` (or the specialist equivalent) and confidence;
- separate facts, assessments, assumptions, scenarios, and unknowns;
- carry per-claim provenance per [`SOURCE_POLICY.md`](../SOURCE_POLICY.md) (Axis A / Axis B);
- give concrete watch-next indicators, not "monitor closely";
- say what evidence would change the judgment;
- include a limitation note that limits something real.

Use [`../evals/`](../evals/) and the audit CLI surfaces for fuller validation passes.
