# CHANGELOG

All notable changes to **Agenda‑Intelligence.md** are documented here.

## Unreleased

- **fix(gates): a declared `support_level` is a caller assertion, and the verification gate now scores it as one.**
  `agent_output_verification` computed readiness from the caller's own declared support level per claim, with
  nothing required to back it. Measured on 2026-09-04: one claim at `support_level: "direct"` and
  `evidence: []` returned `readiness_score: 100`, `readiness_label: review_ready`, `trust_signal: medium` —
  full marks for an empty pack, from the gate whose stated job is checking that claims are backed. A level now
  counts only where the claim cites an `evidence_id` present in the supplied evidence. An uncited level weighs
  nothing in the score; a claim set where nothing is corroborated returns `insufficient_information` /
  `readiness_score: 0` / `trust_signal: unknown` instead of a scored verdict; and one uncorroborated claim
  among corroborated ones holds the score below the `review_ready` band and names the claim in `evidence_gaps`
  and `owner_actions`. `allow_relay` is unchanged — it already required every claim grounded by a quote in
  supplied evidence — and so is every one of the twenty `pre-action-check` replay cases. No new response
  fields: the v1 shape is unchanged under the ADR 0003 freeze, and the `verdict` and `readiness_score`
  descriptions now state the corroboration rule. Python and Worker carry the same rule, with contract tests
  on both sides.

- **feat(gates): with that fixed, the first pass extends to `agent_output_verification` too.**
  It was one of the two gates held out of the minimal-request first pass below, on the measurement that a
  defaulted `evidence: []` returned readiness 100 / `review_ready`. That is no longer what it returns, so the
  gate takes the pass through the same mechanism the others share: a non-empty claim set is the subject, the
  evidence pack is the one defaulted field, and the artifact discloses it in the same block as the score.
  A caller who sends claims and no evidence gets `insufficient_information` and the list of claims that cite
  nothing, rather than the request guide. `pre_action_check` stays held out: it requires `risk_tier`, and
  defaulting a risk classification would invent the one judgement that gate carries.

- **feat(gates): the first pass extends to every gate whose scorers stay honest without evidence.**
  The CIS gate now shares one mechanism — `completeMinimalRequest` plus `minimalRequestFromCandidates` —
  with `agentic_interaction_trust`, `gulf_maritime_exposure`, `kazakhstan_market_entry_readiness`,
  `critical_minerals_due_diligence`, and `dual_use_technology_export`. Each spec names the subject the
  caller must have sent and defaults only the evidence and framing around it, and every one was measured
  with an empty pack before being wired: agentic returns `trust_signal: unknown`, gulf
  `exposure_signal: unknown`, market entry `readiness_label: insufficient_information`, minerals
  `risk_signal: unknown` with `operational_decision.decision: request_evidence`, and dual-use
  `not_decision_ready` with `No dated supporting sources were supplied` stated in its risk vectors.
  Disclosure is one shared block appended at the artifact call site, the way `engagementMarkdown` already
  is, so all six gates read alike. Two are held out, on evidence rather than taste.
  `agent_output_verification` scores readiness from the caller's own declared `support_level` per claim,
  so defaulting `evidence` to `[]` returned `readiness_score: 100` / `review_ready` for a request that
  supplied no evidence — measured, and the exact invention this pass exists to prevent; a caller can still
  send `evidence: []` deliberately, but it must not become the silent default. `pre_action_check` requires
  `risk_tier`, and defaulting a risk classification would invent the one judgement that gate carries.
  `critical_minerals_due_diligence` has no `other` in its `decision_stage` enum, so its default is
  `pre_offtake_agreement` — what `criticalMineralsResult` already fell back to silently, now stated in the
  artifact. Empty requests are unchanged everywhere and still answer `TASK_STATE_INPUT_REQUIRED`.

- **feat(cis): a named counterparty with no evidence pack gets a first pass instead of a refusal.**
  ADR 0026 draws its line at a caller who sent nothing, and answers them with the request guide. A caller
  who sent `counterparty.name` and `counterparty.jurisdiction` and no evidence was landing on that same
  path, because `isCisSecondarySanctionsRequest` requires all five top-level fields at once. That caller
  sent the subject of the review; the gate could already answer them truthfully and did not. The scorers
  handle an empty evidence pack honestly on their own — `cisExposureSignal` returns `unknown` with zero
  dated sources, `cisTriageRecommendation` returns `insufficient_information`, and `cisDecisionReadiness`
  returns `0`. So the A2A and `/v1/cis-secondary-sanctions/exposure` extractor now takes a second pass
  after the strict shape has been ruled out everywhere: a named counterparty is completed with defaults
  and run. Nothing is invented — the response still reports signal `unknown`, recommendation
  `insufficient_information`, readiness `0/100`, `supplied_sources: []`, and the five source types the
  caller has to bring back. `exposure_facets` carries `minItems: 1`, so the completion cannot leave it
  empty; it defaults to `ownership_or_control`, the one facet that applies to every counterparty, and the
  artifact text names all four defaulted fields in the same block as the score, so a defaulted facet is
  never read as a finding about a real company. An empty request is unchanged and still answers
  `TASK_STATE_INPUT_REQUIRED`; a request that names a counterparty and carries a bad enum is unchanged and
  still answers `TASK_STATE_FAILED`. The completion marker is a `Symbol`, so it cannot reach the wire.
  The Python service is deliberately not mirrored: `cis_secondary_sanctions_exposure` validates against
  `cis-secondary-sanctions-request.schema.json` and stays strict for embedders. Completion belongs at the
  hosted edge, which is where strangers arrive — and the completed request validates against that same v1
  schema, so what reaches the service is unchanged in kind.

- **fix(mcp): the endpoint answers a non-POST with `405`, not `404`.**
  `/mcp` was routed for POST only, so every other method fell through to the catch-all. The endpoint is
  advertised as `streamable-http`, a transport whose client may open the stream with GET, and `404` does
  not say "wrong method" — it says there is no MCP server at this address. Measured over the 24h to
  2026-09-03: 148 GET and 9 HEAD on `/mcp` across the fleet, every one a 404, from `io.verifymcp`,
  `mcp-scraper` (mcp-cloud.ai), `AIVE-MCP-EndpointProbe`, `reliability-bureau-spike` and
  `SentinelOracle` — registries and monitors deciding whether to list the endpoint. 115 of them sent
  `Accept: text/event-stream`, so they were opening the transport, not guessing at a URL. Now `405` with
  `Allow: POST`, which is what `vizier` already answered.

- **feat(discovery): the corpus is now searched exhaustively, and only the judgement is left to a model.**
  `check_evidence_packet` reads the sources a claim already names, so everything upstream of it rests on
  whoever assigned `source_ids`. On a handful of documents that is a person reading. On four hundred it is
  a model guessing, and the two failures it produces are indistinguishable in the output: a claim whose
  real support sits in an undeclared document comes back `packet_incomplete`, and a claim pointed at the
  wrong document comes back `source_review_required` with weak lexical support and no reason.
  `agenda-intelligence discover` derives literal patterns from each claim — numbers and quoted spans
  first, then content terms rarest-first by document frequency — and matches every one against every
  source, reporting the line that matched. Nothing is sampled and no model is called, so the behaviour is
  the same on 40 sources and on 4,000; a 401-source corpus is pinned by a test. Two fields carry the
  finding: `undeclared_candidates`, sources a claim's own figures reach but it does not cite, and
  `declared_without_match`, sources it cites where not one pattern occurs. `--strict` exits non-zero on
  the second.

- **docs(discovery): a candidate is a place to look, and the tests hold it to that.**
  `discovery_status` is the constant `candidates_only`, and the findings carry no field named for a
  verdict. Two limits are pinned rather than described: a supporting source sharing no token with the
  claim does not appear at all, and a source that *denies* the claim scores within a hair of one that
  supports it — both spellings share the same literals. Polarity is `check_evidence_packet`'s job, against
  the source a reviewer accepted. Reading a high candidate as support gets that case exactly backwards,
  which is why the score is documented as an ordering and never as a probability.

- **test(worker): `npm run verify:decision-gate` plays the enforcing caller against the live Gate.**
  Every existing test of the signed Gate signs and verifies with the same JavaScript, so none of them can
  see the only failure this binding has — the two parties disagreeing. This one computes the hashes with
  `agenda_intelligence.canonical`, which shares no code with the Worker, and completes
  `decision_check → decision_verify` against production. The binding itself held: independent hashes
  agreed, the receipt verified against the published JWKS rather than the key that signed it,
  `gate_passed` came back true, and all three refusals — changed action, non-`continue` receipt,
  malformed token — answered correctly. 17 checks. The four failures were all in front of it, in what a
  caller reads before it sends anything.

- **fix(worker): the Gate's own example could not reach the decision the Gate exists to produce.**
  A claim counts as grounded only if it carries `supporting_quotes`, and the decision is `continue` only
  if every claim is grounded. The advertised `example_request` had none, so it returned
  `request_evidence` every time: the one example the Gate published demonstrated only its negative path,
  and a caller following it never saw `gate_passed: true`. Its evidence was also invalid against the
  schema published beside it — `title` and `date` where `$defs.evidence_item` sets
  `additionalProperties: false` and requires `source_type` — and the guide named three risk tiers where
  the gate accepts four. The 2026-08-28 comment above it already warned that handing a caller the wrong
  example hands them a request this gate rejects; the evidence half stayed wrong anyway. Four regression
  tests, verified to fail against the previous code.

- **fix(worker): `input_schema` pointed at a GitHub HTML page.**
  `decision_policies_list` published a `/blob/` URL as the caller's input schema. Fetching it returns
  `text/html`, so a caller that does what the field says cannot parse what comes back. Now the raw URL.

- **feat(worker): the published binding states the Unicode normal form it does not apply.**
  `canonicalization: "RFC8785-JCS"` is not enough to reimplement: JCS canonicalizes structure, not text,
  so two conformant implementations still disagree when the same name arrives decomposed. The binding now
  carries `unicode_normalization: "none"`, which is what the Gate actually does, and leaves the caller to
  settle its own text before hashing rather than discovering the rule through `binding_mismatch`.

- **feat(cli): `decision-hashes -` reads stdin.**
  An enforcing caller holds the request in memory and had to write it to disk to hash it.

- **feat(canonical): a Python caller can now compute the Gate hashes it is required to compute.**
  [ADR 0025](docs/adr/0025-signed-readiness-receipts.md) tells an enforcing caller to derive
  `expected_request_hash` and `expected_action_hash` from its own copy of the request rather than
  echoing what `decision_check` returned, and `decision_policies_list` publishes
  `canonicalization: "RFC8785-JCS"` — but this package shipped no JCS. The nearest thing,
  `services._input_digest`, is `json.dumps(sort_keys=True)` over a different field
  (`run_provenance.input_digest`), and it disagrees with the Worker on 3 of 11 probe cases: it renders
  `9.0` as `9.0` where ECMAScript renders `9`, `-0.0` as `-0.0` where ECMAScript renders `0`, and a
  22-digit integer in full where ECMAScript renders `1e+22`. A caller that reached for it would pass on
  ASCII integers and get `binding_mismatch` on the first whole-number float — a ratio or threshold that
  landed exactly on an integer — with the Gate refusing a legitimate action and no field saying why.
  `agenda_intelligence.canonical` reproduces `jcs()` from `deploy/cloudflare-worker/src/jws.js` byte for
  byte, including the two rules Python gets wrong by default: ECMAScript number rendering, and key order
  by UTF-16 code unit rather than code point, which differ for any astral key. 600 randomized structures
  and 31 boundary numbers agree with Node; `tests/fixtures/jcs-parity.json` freezes 19 named cases and
  regenerates from the Worker under test, so drift in `jws.js` fails here instead of in production.
  Verified end to end: a receipt signed by the Worker over a request carrying `threshold: 9.0` verifies
  `gate_passed: true` against hashes computed by `agenda-intelligence decision-hashes`.

- **docs(canonical): JCS canonicalizes structure, not text, and the tests say so.**
  RFC 8785 does not normalize Unicode, so `Айдын Жумабай` in NFD hashes differently from the same name in
  NFC and the Gate answers `binding_mismatch` for what a reader calls one request. Decomposed text
  reaches a caller by ordinary routes — macOS paths, clipboard, some IMEs — and this product's regions are
  exactly the ones where it is not ASCII. Normalizing inside the canonicalizer would break parity with the
  Worker, so the limit is pinned by
  `TestUnicodeNormalizationIsTheCallersJob` and answered with an explicit `--normalize nfc` on the CLI
  that both parties must choose together.

- **fix(a2a): an empty message asks for input on every gate, not eight of ten.**
  [ADR 0026](docs/adr/0026-input-required-for-unstructured-gate-requests.md) enumerated the eight
  `Missing structured …` call sites and moved them to `TASK_STATE_INPUT_REQUIRED`. The shared
  `emptyRequestResult` path was not among them, so `agenda` and `kazakhstan` still answered a request with
  nothing in it — case 1 in that ADR, "an empty message" included — with `TASK_STATE_FAILED`. Swept the
  live fleet 2026-09-02: those two of ten. Both now ask for input, which also moves them out of
  `invalid_request` in `/stats`.

- **fix(mcp): the front door's schema now says it answers without a question.**
  `corridor_sanctions_assistant` declared `text` required and `additionalProperties: false` while
  answering `{text: 12345}`, `{text: null}` and `{nope: "…"}` alike with the gate list; its sibling
  `strategic_risk_triage`, generated from the same branch, refuses all three. Declared the permissive
  behaviour rather than tightening it: every other gate's refusal now routes an empty-handed caller here,
  so this is the one tool that must not turn one away.

- **test(worker): `npm run verify:refusals` sweeps the refusal paths across the live fleet.**
  `verify:public-agents` proves a gate answers a request it accepts; this proves what all ten do with the
  requests they do not — empty call, wrong-shaped object, unknown tool — plus the round trip that takes
  `example_request` out of a gate's own refusal and sends it back. 130 checks. Both fixes above came out
  of its first run.

- **docs(mcp): tool descriptions now state the precondition, not just the promise.**
  Every gate summary said what comes back — "returns ... missing evidence", "... evidence gaps" — and none
  said the caller has to bring its own evidence first, which each of them requires. An agent reading that
  while holding only a question concluded it could ask what it was missing, called, and was refused. The ten
  tools that grade caller-supplied evidence now say so and name `corridor_sanctions_assistant` as the place
  to start with a question and nothing else; the two free-text tools and the two that grade no evidence
  (`decision_policies_list`, `decision_verify`) are unchanged. Descriptions only — no schema, contract, or
  behaviour change.

- **fix(mcp): an empty `tools/call` is an error, and every refusal names its arguments.**
  A2A distinguishes "done", "broken" and "I need input you have not sent"; MCP has only `isError`, and
  the gates that answered `TASK_STATE_INPUT_REQUIRED` crossed into MCP as `isError: false` — telling a
  machine caller its empty request had worked, the failure the A2A-side fix of 2026-08-25 set out to
  stop. Seven gates did this. `INPUT_REQUIRED` now surfaces as an MCP error carrying the same field
  guide, under its own code so that sending nothing stays distinguishable from sending something
  broken. The free-text profile kept its guide only inside the artifact and so refused with no field
  named at all; it now names its one `text` argument. A2A behaviour, task states, and usage
  classification are unchanged, and no gate accepts or refuses anything it did not before.

- **fix(mcp): a `tools/call` refusal now carries the field guide, not just a sentence.**
  A caller that sent the wrong arguments got back only "The supplied arguments do not satisfy this
  tool's input contract" — no field named, no example, nothing to retry against. The refusal already
  built `required_fields`, a ready-to-send example, the routing front door and a support contact, and
  the A2A route returned all of it; the MCP layer forwarded `metadata.errors` alone and dropped the
  rest. It now forwards them, and because the example is a bare arguments object a caller can resend
  it unchanged. The refusal also no longer names `params.message.parts`, which is the A2A request
  path and does not exist in an MCP `tools/call`. No contract changed: every gate accepts and refuses
  exactly what it did before.

- **fix(cis-secondary-sanctions): report an unconfigured retrieval upstream as disabled, not degraded.**
  The dispatcher no longer invokes the keyless OpenSanctions adapter when Snapshot, Watchman, and
  OpenSanctions are all unconfigured. Evidence-only requests now emit `live_retrieval_status: "disabled"`
  with the bounded operator reason `not_configured`, make no outbound request, and attach no upstream
  attribution. A configured upstream that fails still emits `degraded` with its bounded failure reason.

- **feat(observability): separate human, machine, probe, and self-test traffic in Worker logs and `/stats`.**
  Usage and funnel events now carry bounded `traffic_class` and `request_kind` fields, so discovery traffic,
  A2A actions, and MCP actions can be counted without re-parsing user agents and paths. Daily stats expose the
  same split and direct human/machine counters. Live-retrieval failures now carry an aggregate-safe
  `reason_code` (for example `network_error` or `upstream_http_503`) while raw exception and configuration
  detail remains out of logs and user-facing limitations.

- **fix(a2a): answer an unstructured gate request with `TASK_STATE_INPUT_REQUIRED`, not `TASK_STATE_FAILED`.**
  Measured 2026-08-29 over the preceding 72h of Workers Logs: the Agenstry listing probe calls all ten hosted
  agents with the same four-character message; the three free-text profiles answered `TASK_STATE_COMPLETED`
  and the seven structured gates answered `TASK_STATE_FAILED` — the same seven every time, 14 of 38 probe
  calls. Nothing was failing. Each gate was describing its input contract through a status that means the
  opposite, on the one external channel that shows the fleet to people who did not build it. A caller who
  sends no structured request now gets `TASK_STATE_INPUT_REQUIRED` with the unchanged `GATE_REQUEST_GUIDES`
  artifact — required fields, a worked example, the front door. A caller who sends a structured request that
  does not validate still gets `TASK_STATE_FAILED` with the field errors, because that request did fail.
  `/stats` reports the new outcome as `input_required` rather than folding it into `invalid_request`, which
  on 2026-08-27 counted 271 calls that were mostly one local test script. Both still count toward
  `empty_handed`. See [ADR 0026](docs/adr/0026-input-required-for-unstructured-gate-requests.md). The Python
  A2A adapter is unchanged and still returns `TASK_STATE_FAILED` for both cases.

- **chore(observability): sample traces on `cis-secondary-sanctions`.** Over 2026-08-22..28 that Worker was
  12.4% of named-script requests but 47.4% of the fleet's CPU, with `cpuTimeP99` 423ms against a 1.27ms
  median, and it is the only agent reporting subrequests (49; every other agent reports 0). The tail is an
  outbound-call path, not computation. Logs stay unsampled fleet-wide: ~5,900 requests a week is nowhere
  near the free 200k/day budget, and thinning them would cost the funnel its census.

## 1.8.0 — 2026-08-28

- **feat(registry): declare the ten hosted endpoints in `server.json`.** The registry entry offered exactly
  one way to reach this project — install the PyPI package and speak stdio — while ten Streamable HTTP
  endpoints were live, open, and answering `tools/list` with complete input and output schemas. An agent
  browsing the registry saw software to install, not endpoints it could call. Measured the same day in the
  Agenstry directory: 4–5 listing impressions per gate, zero invocations. `remotes[]` now names all ten,
  general profile first, and `websiteUrl` points at the hosted landing page. `tests/test_server_manifest.py`
  checks both directions offline against `wrangler.toml`: no declared URL that no deployment serves, and no
  deployed Worker the manifest forgets. The release workflow syncs versions only, so it needs no change.

- **chore(signals): re-sync the vendored snapshot with the canon, and translate the links vendoring breaks.**
  The snapshot was three signals behind `global-think-tank-analyst` — the guard that should have said so had
  been looking for the checkout in the wrong place — and it carried the disclaimer removal that the canon has
  since reverted. `scripts/sync_signals.py` now also rewrites repository-relative links (`../../README.md`)
  to their canonical URL: they resolve in the canon, where signals sit two levels below the repository root,
  and point at nothing five levels down inside this package. `feed.json` embeds a copy of each signal, so its
  `content_text` is re-derived from the rewritten markdown rather than left to contradict it.

- **fix(opensanctions): never fabricate a sanctions match when the API key is missing.** The Python adapter now follows its documented degradation contract and returns an empty match list. A regression test calls the adapter directly so future callers cannot mistake simulated data for an upstream result.
- **fix(docs-smoke): execute allowlisted documentation commands without a shell.** Markdown examples are parsed with `shlex` and passed as argument lists, removing the avoidable `shell=True` surface.
- **docs(demos): replace infinite-scale, staffing, and invented-price claims with a bounded concurrency example whose output is explicitly one observed run.** Removed the generated 100-agent catalog because its inactive entries and pricing could be mistaken for shipped capabilities.
- **docs(economics): replace invented pricing, margin, labour, latency, and error-rate figures with a measurement plan and explicit evidence threshold.**
- **docs(scenarios): relabel fabricated enterprise case studies as synthetic workflow scenarios and remove invented customer volumes and outcomes.**

- **fix(docs,skills): restore the honest-scope layer removed in 9a7d32e.** That commit stripped
  "not legal advice" and "not compliance advice" from `okf/index.md`, the sanctions sector reference, and
  `skills/source-ingest/SKILL.md`, removed the limitation-note requirement the memo contract depends on,
  deleted the `## Disclaimer` block from every published signal, dropped the `Limitations` sections from all
  three agent-eval cases, and removed the `Honest scope` rubric row that scored exactly this. The runtime
  boundary never moved — live workers still return `human_review_required` and `not_advice_notice` — so what
  was left was a code boundary with no documentation behind it and, in the skills, runtime instructions that
  no longer ask for the caveat the contract still requires. The CHANGELOG's `[2.0.0] Autonomous Compliance
  Edition` block, which announced definitive legal, compliance, and sanctions determinations, is removed with
  it: the product does not do that, and AGENTS.md forbids claiming it.

- **fix(tooling): make the signal-sync guard find the GTTA checkout.** `scripts/sync_signals.py` and
  `tests/test_signal_sync.py` each hard-coded `~/work/global-think-tank-analyst`. The checkout moved to
  `~/projects`, so the script failed loudly and the test — which skips when the source is absent — went
  quiet, and stayed quiet through a sweep that edited the vendored snapshot directly. The path is now
  resolved once, in the script, from `$GTTA_SIGNALS` or a checkout beside this repository or under
  `~/work` / `~/projects`; the test imports that resolver instead of repeating it. With the guard live
  again it immediately reports the snapshot is three signals behind canon.

- **test(worker): verify all ten deployed profiles, not eight.** `critical-minerals-due-diligence` and
  `dual-use-technology-export` were live and checked by nothing — `verify:public-agents` had never called
  either. Adds the first public example for the dual-use profile
  (`examples/dual-use-technology-export/contract/`), a contract test asserting the profile still gives that
  example the answer its response fixture publishes, and both profiles to the live conformance run.

- **ops(worker): rotate `STATS_TOKEN` across every environment, not just the top-level Worker.**
  `wrangler secret put STATS_TOKEN` without `--env` reaches one Worker; the other nine answered `/stats`
  with 401 and nothing reported it, because `/stats` is the one endpoint no monitor calls. Observed
  2026-08-28, four environments behind. `scripts/rotate-stats-token.js` reads the environment list from
  `wrangler.toml`, writes the secret everywhere, rewrites only the `STATS_TOKEN` line of `.env` (the
  previous helper truncated the file and took `AGENDA_OBSERVABILITY_TOKEN` with it), and re-publishes
  through `deploy:all`, since a secret write leaves an unstamped version and drops the gated
  environment's ALLOW receipt. `--check` asks every environment and writes nothing.

- **feat(worker): the agent card now carries the same tool contracts `tools/list` carries.**
  Every hosted MCP tool has published a complete input and output JSON Schema since the endpoint
  shipped; the card published `inputModes`, so an agent that found a gate through its card learned
  that it accepts JSON and nothing about which JSON. Composing against a gate meant reading prose or
  speaking MCP first. `capabilities.extensions[].params.x_tool_contracts` now carries the schemas and
  annotations, read from `mcpToolsForProfile` rather than restated, so a schema change lands on both
  surfaces or on neither. It sits in the vendor extension because the A2A v1 `AgentSkill` field set is
  closed. Cards get heavier: `agent-output-verification`, with five tools, goes from ~8.6 kB to ~35 kB.

- **feat(deploy): every environment ships through the Vizier gate, not one of ten.** Nine environments
  went out with a plain `wrangler deploy` and left no receipt, so the question the gate exists to answer
  had an answer for one tenth of the fleet — while the gate cost the tenth environment about twenty
  seconds and refused nothing in two weeks. `vizier-gated-deploy.js` now takes `--env <name>` or
  `--top-level` and derives both the Vizier action target and the wrangler invocation from
  `wrangler.toml`, so the request names the worker the deploy actually ships; an environment the file
  does not declare is refused rather than silently defaulted. `deploy:all --check` asks every
  environment for a receipt. Until the first full gated deploy, it reports nine as `UNGATED` and exits
  non-zero, which is the true state of the fleet.

- **feat(worker): every gate response says whether anything verified it.** Agent Output Verification and
  the Agentic Interaction Trust Gate are deployments beside the other gates, not a step between them and
  the caller, and nothing in a response distinguished "verified" from "nobody looked" — so a relayed
  verdict carried the same weight either way. `task.metadata.verification` now reports `not_performed`
  for the nine gates that cannot check their own output and `self` for the verifier's own deployment,
  names where verification is available, and states that the gate issues no receipt, holds no authority,
  and performs no action. Self-reported, and it names no outcome. It sits in task metadata because every
  v1 response schema is `additionalProperties: false` and this describes the transport, not the verdict.

- **feat(worker): a decision journal, so two runs of one file can be compared.** `/stats` answers how many
  calls and from where; it keeps no input and no verdict, and the detailed funnel events live in Workers
  Logs, which retains 72 hours on the free plan — so "did this file get a different answer than last time"
  had nowhere to look. `GET /decisions?date=` (same `x-stats-token`, 30-day retention) returns one record
  per `SendMessage`: timestamp, profile, contract version, a `sha256:` hash of the input, the verdict, and
  whether human review was required. It stores a hash, never the input: these payloads carry counterparty
  names, routes and cargo. The `runs` block pairs a repeated input with the verdicts it received and marks
  the pair changed when they differ, including when only the contract version moved. `npm run decisions`
  prints the changed pairs first. One KV write per call, none on discovery GETs.

- **fix(worker): route the Dual-Use Technology deployment to its declared profile.** The environment, profile
  registry, MCP schema, and deployment existed, but the Worker host/env dispatcher fell through to the generic
  Agenda Intelligence card and response path. The deployment now serves its own A2A Agent Card, structured
  evidence-readiness response, request guidance, and MCP/A2A routing while retaining mandatory human review and
  explicit no-classification/no-clearance boundaries.

## 1.7.1 — 2026-08-27

- **feat(workers): Edge REST routes, streamable MCP resources & prompts, and critical minerals vertical worker.**
  - Direct REST validation endpoints on Cloudflare Workers: `POST /v1/evidence-packet/check`, `POST /v1/evidence-packet/repair-prompt`, `POST /v1/critical-minerals/due-diligence`.
  - Remote Streamable HTTP MCP JSON-RPC transport extended with `resources/list`, `resources/read`, `prompts/list`, `prompts/get`.
  - Added sixth vertical gate profile: `critical_minerals_due_diligence` for origin tracing, export quota compliance (rare earths, graphite, gallium, germanium, tungsten), and CSDDD alignment.

## 1.7.0 — 2026-08-27

- **feat(review): interactive standalone HTML report (`--format html`).**
  `agenda-intelligence review` now supports `--format html`, generating a self-contained, offline HTML report
  with status badges, interactive claim-to-source highlighting, clickable reviewer action checkboxes,
  and dark/light mode responsiveness.

- **feat(ingestion): native CSV/TSV table parsing, local HTML stripping, and scanned PDF layer detection.**
  `evidence_review` natively parses `.csv` and `.tsv` tabular sources into readable records, cleans tags and
  scripts from local `.html`/`.htm` documents, and explicitly warns when a PDF has no extractable text layer (OCR required).

- **feat(mcp): native MCP resources and prompt templates.**
  Implements `resources/list`, `resources/read` (`agenda://manifest`, `agenda://protocol/core`, `agenda://schemas/v1/...`)
  and `prompts/list`, `prompts/get` (`draft_evidence_memo`, `self_correct_packet`, `audit_evidence_claims`) in the stdio MCP server.

- **feat(services): enhanced quote matching with ellipsis and typographical normalization.**
  `check_evidence_packet`, `grounded_check`, and `verify_quotes` now support ellipsis (`...`, `…`) in quoted
  excerpts to match non-contiguous verbatim passages in order, and normalize typographical quotes (`“”«»‘’`),
  dashes, and unicode whitespace.

- **feat(services/cli/mcp): self-correction repair prompt generation for LLM agents.**
  Adds `build_repair_prompt` service function, `agenda-intelligence repair-prompt` CLI command, and
  `generate_repair_prompt` MCP tool. Inspects claim diagnostics (missing sources, misquotes, unmatched numbers,
  polarity/negation mismatches, weak lexical support) and formats structured markdown guidance for agent retries.

- **feat(integrations): EvidencePacketGuardrail for agent pipelines.**
  Adds `src/agenda_intelligence/integrations.py` providing a lightweight, zero-dependency guardrail and
  automated `validate_or_repair` feedback loop for LangChain, LlamaIndex, CrewAI, DSPy, and custom agent loops.

- **feat(ci): GitHub Action (`action.yml`) for evidence linting.**
  Adds a composite GitHub Action definition allowing CI workflows to validate evidence packets or run local
  document reviews directly via `uses: vassiliylakhonin/agenda-intelligence-md@main`.

- **fix(tests): isolate PYTHONPATH in subprocess calls in `test_lens_packs.py`.**

- **fix(worker): the deal-risk gate no longer contradicts the subject line two rows above it.**
  Measured live on the Middle Corridor gate right after #266 deployed: "Aluminium extrusions from
  Aktau to Jebel Ali via Baku and Poti" produced a subject line naming all four places and a cargo
  class, and directly beneath it `Route: not supplied` and `Cargo: not supplied`. The gate's
  extractors only fire on the schema's own vocabulary (a `Route:` label, or the literal word
  "route"), so ordinary English missed them; the defect predates #266, which made it visible by
  printing what had in fact been read. Route extraction now falls back to a `from X to Y` capture
  and then to the named places in written order, and cargo to the commodity class, each labelled as
  read from the wording rather than supplied as a field. The `from X to Y` capture is dropped when
  it overruns into a party, payment or valuation clause — on the live example it had swallowed
  "buyer is a UAE company incorporated in 2025, payment through a Georgian bank" into the route.
  Place names are matched from a route vocabulary kept separate from the jurisdiction table, which
  collapses Baku into Azerbaijan and is right to.

- **fix(worker): drop the duplicated source-category checklist from the routing note.** All six
  categories under "Collect next" were repeated verbatim under "Full source-category checklist" —
  1,059 bytes of a 7,442-byte note restating what the caller had just read. The complete list stays
  in the machine-readable part under `signal_screen.source_categories_required`.

- **fix(worker): answer the caller's question before describing the server (#266).** Missing from
  this file when that PR merged; recorded here. A replayed external-shaped call naming a UAE
  counterparty, Fujairah, refined products and Kazakhstan transit came back with none of those
  words: the note opened with "live wrapper is responding" and `pip install`, reached the subject on
  line 12, and gave five copies of "No caller-supplied <category> evidence in this live A2A
  request". Over the preceding 30 days ten external calls carried a real prompt, from three callers,
  and none returned after their first day. The note now opens with what was read, then the named
  regimes and lists that apply to it, one decision-relevant fact per named port, and what to collect
  with what each item settles; packaging moved to the bottom. Correction to that PR's own claim: the
  note **grew**, 5,586 to 7,442 bytes (7,036 after the checklist above came out) — the original
  "20,864 to ~7,400" compared a whole JSON body against a single text part and was wrong in both
  size and direction. What changed is the order and the content, not the length.

- **fix(worker): the deal-risk gate names its own missing sources in the offer.** Found live after
  the previous change deployed, not in review. The Middle Corridor deal-risk gate — the busiest host
  in the funnel — answered `escalate_before_signature` with seven named gaps and still returned the
  generic sentence, because it names them in `minimum_sources_before_go` and `missing_sources`,
  neither of which the first version of `ENGAGEMENT_OPEN_ITEM_FIELDS` knew. Both are added, and the
  list is now ordered from the narrowest reading of "still missing" to the broadest, since the first
  field with entries wins. A regression test asserts the gate's verdict and one of its own missing
  sources reach the offer, and fails without the fix.

- **feat(worker): offer person-led work on the caller's own open items, on every completed profile.**
  The contact reached the failure paths and, from #262, the base profile's routing note. It never
  reached the seven vertical gates, and everywhere it appeared it was the same generic sentence.
  Measured over the 2026-08-18..26 archive: twelve substantive external calls from a single caller,
  every one `TASK_STATE_COMPLETED`, no reply — while `invalidRequestResult` and the "nothing to
  route" path, which nobody whose request works ever sees, carried a contact throughout. The offer
  is now built at `runProfileRequest`, the one point every profile passes through, so a new profile
  cannot ship without it, and it names this run's own verdict and the items its file is still short
  of (`minimum_sources_before_review`, `minimum_sources_before_action`, `evidence_gaps`,
  `blocking_gaps`, `owner_actions`, found at the top of the response or one level down under
  `signal_screen`). Two results are left untouched: a `TASK_STATE_FAILED` task, which already
  carries `support_contact` and needs its request fixed rather than a scoping conversation, and any
  result that already carries an engagement — the base profile's routing note and the corridor
  assistant's orientation payload. No new response field and no schema change: `metadata.engagement`
  is the block #262 already defined, and the markdown gains the same lines it already gained there.
  No price and no traction claim. Three contract tests cover a golden gate response, a rejected
  request, and double-stamping; reverting the offer to a generic sentence fails two of them.

- **fix(cis): stop reporting a listed ship as a match on the counterparty.** OFAC SDN carries
  `NURSULTAN NAZARBAYEV` as a `Vessel` — IMO 9842217, linked to Joint Stock Company Rosnefteflot,
  designated under EO 14024. It is a Russian supply vessel named after a former head of state, not
  the person. Two defects turned that into a wrong statement in the gate's output. The Snapshot
  upstream hardcoded `schema: "Company"` on every match, so a designated person, a company, a ship
  and an aircraft were reported identically; and `cisTopExposureDimensions` turned any match count
  above zero into `direct or near-direct match in OpenSanctions consolidated dataset`, which both
  overstated what matched and misattributed provenance whenever Snapshot or Watchman was the active
  upstream. `upstream_snapshot.js` now reads the entity type published in compact index v2
  (`types` table plus a third element per row, added by the portfolio site's
  `scripts/sanctions_name_index.py`) and maps it onto the FollowTheMoney vocabulary the other
  upstreams already return — `individual` → `Person`, `entity` → `Company`, `vessel` → `Vessel`,
  `aircraft` → `Airplane`. A v1 index has no types; those rows resolve to `unknown` / `LegalEntity`
  rather than being dressed up as companies. The type travels to the caller on both `match.schema`
  and a new `entity_type` on each `auto_fetched_sources` entry, and the dimension now separates a
  match on something that could be the counterparty from a listing on a vessel or aircraft carrying
  the same name, naming the datasets that actually answered. Mirrored in `services.py` for parity,
  where OpenSanctions matches are classified from the schema the API returns. **Risk thresholds are
  deliberately unchanged**: a vessel listing still contributes to the exposure signal exactly as
  before, because whether it should is a policy decision, not a defect. Contract tests both sides:
  vessel / company / individual typing, v1 fallback without guessing, the vessel-only dimension, the
  company-match positive control, and upstream labelling. No schema, endpoint, profile, or tool
  changed.

- **feat(hosted decision gate): sign and verify exact-request readiness receipts.** The existing
  `pre_action_check` already returned `continue`, `request_evidence`, `require_approval`, or `stop`, but its
  `decision_id` was only a correlation identifier and a downstream machine could not verify that the result was
  current or bound to the action it was about to perform. The Agent Output Verification Worker now adds three
  hosted MCP tools: `decision_policies_list`, `decision_check`, and `decision_verify`. `decision_check` attaches a
  five-minute ES256 compact-JWS receipt containing no claim text, only decision metadata and SHA-256 hashes of the
  full request and action identity; `decision_verify` fails closed for a bad signature, expiry, hash mismatch, or
  any decision other than `continue`. The receipt reuses the profile's existing Agent Card P-256 key with a distinct
  JWS type for this initial bounded scope. It proves the Worker's readiness result, not identity, delegated
  authority, factual truth, external approval, legal clearance, or authorization. No new Worker, storage, payment,
  policy pack, A2A response, local stdio tool, or external action executor is added.

## 1.6.0 — 2026-08-24

- **fix(hosted MCP): publish complete contracts and stop duplicating A2A tasks in model context.** Hosted
  `tools/list` previously described every structured request as an open `{request: object}` shell, omitted
  `outputSchema` and behavior annotations, and `tools/call` serialized the full A2A task twice: pretty-printed in
  `content` and again in `structuredContent`. A local Middle Corridor fixture measured 91,861 bytes for one MCP
  response. The Worker now generates complete input and output schemas from the versioned `schemas/v1` contracts,
  accepts the request object directly while preserving the old wrapper and its A2A task-shaped result as a
  compatibility shim, advertises read-only/non-destructive/idempotent hints, and returns the service result once plus
  a short summary for direct-schema calls. The same fixture is contract-tested below 15,000 bytes. A generation-drift
  check runs before the Worker tests, and browser preflight now permits the MCP 2026-07-28 `Mcp-Method` and `Mcp-Name`
  routing headers. A2A response shapes and existing tool names are unchanged. The A2A 1.0 live fixture also now uses
  `SendMessage` and includes the required `messageId`; it previously combined legacy `message/send` with an A2A 1.0
  header in live use.

- **fix(release): align the Cloudflare Worker version with the Python release.** The live Workers and Worker source
  still reported `1.2.0` while PyPI and the repository reported `1.5.0`. The Worker now reports `1.6.0`, its contract
  tests are updated, and the Python version-sync test covers the Worker constant so the two release surfaces cannot
  drift silently again. This changes version metadata only; the local-file review command remains Python/CLI-only.

- **feat(evidence review): add a bounded local-file review workflow and Unicode lexical support.**
  `agenda-intelligence review <manifest>` now loads caller-selected UTF-8, Markdown, DOCX, or optional PDF
  sources, hydrates the stable evidence-packet request, and returns a reviewer-facing Markdown or JSON result
  without repeating full source text. Paths stay inside the manifest directory; source size, extracted text, and
  PDF page count are bounded. The deterministic tokenizer now retains Unicode words instead of silently dropping
  Cyrillic and Arabic text, preserves numeric percentages, and checks common English, Russian, and Arabic negation
  cues. Exact-match Cyrillic and Arabic fixtures and a Russian polarity-conflict fixture pin the behavior. This is
  not claim extraction, translation, semantic entailment, source discovery, or factual verification; those limits
  remain visible in every result and human review remains required.

- **fix(skill packaging): ship and validate the complete `source-ingest` contract.** The plugin exposed the skill,
  and packaged `llms.txt` advertised it, but the Python package data carried only `agenda-intelligence`; the
  dual-copy test also checked only that one skill despite the documented `skills/**` invariant. `source-ingest` is
  now mirrored into package data, every packaged skill is parity-checked, its downstream routes resolve from the
  skill directory, and its evidence-mode handoff names the exact values accepted by the evidence-pack and
  agenda-memo schemas. The Claude marketplace description of the sibling Global Think Tank Analyst also drops the
  unsupported `decision-grade` wording, with a metadata test preventing that grade claim from returning.

- **fix(agent card verifier): the live check still read `x_agent_contract` from the card root.** The extension move rewrote every `card?.x_agenda_intelligence` read in `verify-agent-card.js` but missed `card?.x_agent_contract`, so after the 2026-08-23 deploy the Middle Corridor card reported three false failures while the card itself validated against the official schema. The unit test that covers this verifier passed throughout, because it handed the verifier `agentCard()` — the internal shape — instead of what the endpoint serves. It now passes the wire shape, which reproduces the defect when the fix is reverted.

- **fix(agent card): the card carried fields the A2A v1 schema does not define.** An independent conformance scan published 2026-08-23 (`msavdert/a2a-scorecard`, 2,479 endpoints) failed every card this project serves on schema validation, and the finding checks out against `a2aproject/A2A` `specification/a2a.proto`: `AgentCard` defines a closed field set and `AgentProvider` exactly two fields, `organization` and `url`. The Workers were serving `support`, `x_agenda_intelligence`, `x_agent_contract` and a top-level `signature` at the card root plus `provider.legalEntity`; the published alias added `remote_mcp`, `resources`, `updated_at`, `x_identity`, `x_profile_mcp`, `x_profile_resources` and `x_security_posture`, plus `provider.name` and `provider.contact`; the Python adapter card added `url`, `protocolVersion` and `protocolVersions`. None of those are card fields, and the one extension mechanism the spec defines is `capabilities.extensions[]`, whose `params` is an arbitrary JSON Struct.

  Everything moves there under `https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/a2a/extensions/agenda-intelligence/v1`, declared `required: false` — no data is dropped and reading it is never needed to call an agent. The signature moves from a top-level `signature` string holding a compact detached JWS (`<header>..<signature>`, RFC 7797 unencoded payload, written for the Agenstry `jws_signature` criterion) to `signatures: [{protected, signature}]` with an ordinary base64url-encoded payload, which is what A2A v1 section 8.4.2 specifies; existing signing keys and the JWKS are unaffected. Agenstry's own current criteria point the same way — its `valid_card` criterion requires A2A v1.0 schema validation, and its signature criterion names no field — so this is not a trade between the two.

  Normalisation happens at the wire boundary, so `profiles.js`, the Python adapter's callers, the contract tests and every internal reader keep reading `card.x_agenda_intelligence` unchanged; only the served JSON moves. The field list is an allow-list rather than a list of known offenders, so a profile adding a new block stays conformant without touching it. Verified by validating the served cards against the official generated `a2a-v1.0.1` JSON Schema bundle: 8 of 8 pass, and the same harness fails all three currently-deployed cards with exactly the violations the scan reported. `npm run verify:agent-card` now checks the field set on the live cards, and it reports failure until the Workers are redeployed. Callers reading a card served before the move still resolve, because the extension reader falls back to the card root. 198 worker tests and 538 Python tests green.

  Not changed: Vizier returns `-32009 VersionNotSupported` to a caller that sends no `A2A-Version` header, which the same scan grades as a non-answering endpoint. A2A v1 section 3.6.1 says an empty header means version 0.3 and section 3.6.2 says an unsupported version must be refused, so that behaviour is correct as written and was left alone.

- **feat(worker): give a machine caller a way to reach a person.** A successful `message/send` to the base profile returned `agent_card`, `repository`, `package`, `mcp_transport`, `modules_used` and `triage`, and no contact anywhere in the payload (measured 2026-08-22 against the live endpoint). The agent card's `support` field and the landing-page mailto do not reach a caller that integrates from code and never renders HTML — and the single external non-probe call on record arrived exactly that way, from another Cloudflare Worker with no user agent, referer or origin, which also makes it unidentifiable from the logs. `metadata.engagement` now carries `offer`, `contact_email`, `support_hours`, `next_step` and `human_page`, matching the block the corridor assistant already returns. No price, no customer claim, no urgency: a contract test fails the build if any appears. Additive metadata only — no schema, endpoint, or artifact change. Zero inbound contact has arrived through it; it is a channel, not a measurement.

- **fix(worker telemetry): the two biggest crawlers were counted as unidentified callers.** `caller_kind` recognised a probe by keyword only — `bot`, `crawler`, `probe`, `audit` and so on — and the two highest-volume crawlers against these endpoints name neither a role nor a bot suffix. Measured 2026-08-20..22, 411 requests over three days therefore landed in `external`, the bucket that means "not a probe", 224 of them from one scheduled crawler alone. A probe is now also recognised by the self-identification convention: a parenthesised contact prefixed with `+`, as in `(+https://example.com/bot)` or `(+someone@example.com)`. Every crawler in the observed population that the keywords missed carries it. Generic HTTP libraries (`node`, `python-httpx`, `Go-http-client`, `undici`) stay `external` on purpose — `external` means unidentified, and collapsing it into "probe" would hide exactly the callers this classification exists to find.

- **feat(worker telemetry): name the caller who signs nothing.** The usage and funnel events recorded a truncated user agent and nothing else about who called, so a request that sent no user agent at all was indistinguishable from any other automation, and the count of "real" calls silently included directory probes and this repository's own conformance runs. Both events now carry `caller_kind` (`self_test`, `service_probe`, `external`, `unsigned_external`) and `caller_zone`, the calling Cloudflare Worker zone from the `cf-worker` header. `/stats` reports both, and `npm run funnel` prints them. Measured over 12,155 raw log rows for 2026-08-19..22: 50 rows carried a `cf-worker` zone and 49 of those were probes already self-identified in the user agent (ProofBench, mcpqueen-grader, x402-observatory, Cloudflare infrastructure); the fiftieth sent no user agent and was the single external non-probe call in the window. 55 requests arrived unsigned in total. Deliberately narrower than a full caller taxonomy: every probe observed so far names itself, so only the unsigned bucket carries information the user agent did not already give. No schema, endpoint, or response-shape change — `event_version` moves to 3 for usage and 2 for funnel, and nothing reads it. The fields are observability only and are not evidence of demand. Worker deploys are manual, so live environments keep the old event shape until redeployed.

## 1.5.0 — 2026-08-21

- **feat(evidence-packet): flag claims that negate the source they cite.** Lexical support is the share of a claim's content terms found in its named source, and `not` / `no` are stopwords that never reach that ratio — so `check_evidence_packet` returned `packet_complete` for a claim asserting the exact opposite of its own source (measured: claim "The EBRD did not approve the loan facility in March 2024" against source "The EBRD approved the loan facility in March 2024" scored `lexical_support=supported`, coverage 0.875). The check now compares negation and denial cues between the claim and its closest sentence in the cited source; a one-sided cue downgrades `supported` to `weak` and adds `lexical_support_polarity_mismatch` plus a reviewer action. Sentence scope, not the multi-sentence excerpt window, so a negation elsewhere in the same document does not flag an unrelated claim. Both directions are covered: a negated claim against a positive source, and a positive claim against a negated source. Reversed subject/object ("A approved a facility for B" against "B approved a facility for A") remains out of reach for term overlap and is documented as a limit in `README.md`, pinned by `test_polarity_check_does_not_claim_to_catch_reversed_roles`. No schema change: `lexical_support.status` keeps its three values and the new string lands in the existing free-form `issues[]`. Behaviour change for `--strict` callers: a packet with a polarity conflict now exits non-zero. The same guard is applied to `grounded_check`, which carried the identical blind spot: a one-sided cue downgrades `grounded` to `weakly_grounded` and appends the owner action. 536 tests green.

- **fix(worker positioning): remove the stale free-memo promise from the corridor front door.** The Corridor &
  Sanctions Risk Assistant, the three structured gate pointers, and invalid-request guidance now use the current
  person-led route: send a one-line description of the route or counterparty and the next decision or review; fit,
  scope, fee, and timing are confirmed before work starts. No price, new product, protocol, schema, or response shape
  was added. Worker deploys remain manual, so the live cards keep the old copy until the affected environments are
  redeployed.

- **fix(CIS discovery): remove the published price from the worker service text.** The agent-card description, the
  skill-list entry, and the corridor-assistant intake notice carried a USD 99 returned-file pilot price. They now
  state the pricing shape only: one fixed fee per file, agreed before work starts, with scope, fee and timing
  confirmed within one business day. Mirrors the site removal of 2026-08-19. Worker deploys are manual, so the live
  card keeps the old text until it is redeployed.

- **fix(CIS discovery): align the public Worker metadata with the paid file-preparation intake.** The CIS card and
  MCP summary now route exporters, importers, traders, freight forwarders, and finance leads who own the file to
  the redacted intake. The public description no longer targets institutional compliance teams, advertises a free
  pre-deal memo, or leads with the internal readiness score. The structured API contract and response are unchanged.

- **fix(deploy): a manual deploy loop overwrote two Vizier-gated deployments.**
  On 2026-08-14 the `agent-output-verification` worker was shipped four times:
  the protected workflow deployed it at 05:23:51 and 05:43:30, each carrying an
  ALLOW receipt, and a hand-rolled "deploy all eight" loop overwrote both at
  05:25:20 and 05:44:29 with plain `wrangler deploy --env`. Same commit, so the
  running code never diverged — but the live version lost its receipt, which is
  the whole reason the gate exists. The trail was restored by dispatching the
  workflow (`vrf_6bf1ffee-29d8-4566-b2ff-2e9b3e75039f`).

  `npm run deploy:all` now ships the seven ungated envs plainly and routes
  `agent-output-verification` through `deploy:agent-output-verification:gated`,
  refusing to fall back to a direct deploy if the gate declines. It finishes by
  reading the live deployment list and failing when the newest deployment has no
  receipt — detection rather than prevention, since wrangler remains callable
  directly, but the drift is then reported rather than silent.

  The receipt check reads only the final block of `wrangler deployments list`:
  a receipt earlier in the list is exactly the overwritten case, so scanning the
  whole output would have reported success on the drifted worker. A unit test
  covers both sequences. Worker suite 188/188.

- **fix(worker discovery): two directory listings showed a bare name because
  the origin root carries no description.** `GET /` returned a link index —
  `ok`, `name`, `version`, and pointers to every discovery document. Directories
  that register the root as the card URL and never follow `agent_card` therefore
  had nothing to copy.

  Observed 2026-08-14 on agent-tools.cloud, which lists three of the workers.
  The entry whose `card_url` pointed at `/.well-known/agent-card.json` read
  correctly: description, provider, skills, conformance `pass`. The two whose
  `card_url` was the origin root came back `description: null`,
  `provider_name: null`, `skills: []`, conformance `partial`, and had
  `protocol_version` filled from the card `version` (`1.2.0`) because the root
  JSON offers nothing better. Their public entries were a name and nothing else.

  The root now repeats `description`, `provider`, `documentation_url`, and a
  compact `skills` list (id, name, description) alongside the existing keys. All
  previous fields and links are unchanged, so nothing that reads the root today
  breaks. Additive only: no schema, endpoint, profile, or response change.
  Worker suite 187/187. **Activation:** redeploy each published env; directories
  pick it up on their next crawl.

- **fix(worker landing): the HTML page gave a human no way to make contact.**
  The agent card has always carried `support.email` and `support_hours`, so any
  machine reading the card could find a person. The landing page served to
  browsers carried neither. Measured 2026-08-14 across all eight live profiles:
  no mailto, no provider link, no contact of any kind — a human who arrived
  could read the page and nothing else. Three weeks of funnel instrumentation
  recorded a handful of such visits a week and no calls, and this is at least
  part of why: there was no next step to take.

  The page now ends with a short contact block using the existing
  `SUPPORT_CONTACT_EMAIL` and `SUPPORT_HOURS_LOCAL` constants, plus a link to
  the provider site already declared in the card. The mailto subject carries the
  profile name, so a reply can be attributed to the page that produced it —
  which also makes this the first place where machine discovery could turn into
  something countable.

  Presentation only: no schema, endpoint, profile, or response change, and no
  new claim about the product. Two tests assert every profile's page carries the
  contact and that the subject names the profile. Worker suite 186/186.
  **Activation:** redeploy each published env.

- **feat(worker tooling): require the Vizier gate in GitHub Actions before the
  Agent Output Verification production deploy.** A secret-free job tests an
  immutable `main` commit first. A fresh protected job then records its external
  decision workspace, validates a Vizier `ALLOW` receipt bound to that commit and
  fixed Worker target, and invokes pinned Wrangler. Deployment credentials live
  in a branch-restricted GitHub Environment; local Keychain operation stays
  available. Repository and Cloudflare administrators remain able to bypass the
  application-level gate and must not be delegated to action-taking agents.

- **feat(worker): add an optional signed Gmail notification after CIS review intake.** The Worker can now schedule a timestamped HMAC-SHA-256 webhook after KV storage, while keeping email delivery outside the form's success path. A Google Apps Script relay verifies the signature, suppresses duplicate request IDs, and sends the redacted request to the operator's Gmail. Both the deployment URL and shared secret remain encrypted Worker secrets.

- **feat(worker): add a durable redacted intake endpoint for the CIS review service page.** The `cis_secondary_sanctions` Worker now accepts `POST /intake/cis-review` from the portfolio origin, validates a bounded JSON payload, drops honeypot submissions, rate-limits repeated requests, and stores the request in the existing `AGENDA_USAGE` KV namespace with a 30-day TTL. `GET /intake/cis-review` reuses the existing private `STATS_TOKEN` authorization, and `npm run intake` prints retained requests for the operator. Five Worker tests cover storage, validation and origin rejection, honeypot handling, rate limiting, and authenticated retrieval. Intake storage remains independent from the optional notification transport.

- **fix(a2a): publish each Worker's JWKS location inside its protected JWS
  header.** Signed Agent Cards now include an RFC 7515 `jku` value derived from
  the card's own HTTPS `supportedInterfaces` origin and pointing to that
  deployment's `/.well-known/jwks.json`. This removes provider-level key lookup
  ambiguity without changing keys, endpoints, skills, authentication, or
  payload contracts.

- **docs(a2a): declare the existing evidence-gap analysis on the Agent Output
  Verification card.** The Worker already returns missing evidence ids,
  quote-to-reference mismatches, unsupported statements, weak claims, evidence
  gaps, and owner actions through the relay-readiness contract. Its public
  Agent Card now exposes that behavior as a third structured skill, alongside
  relay readiness and the pre-action evidence check. This is metadata parity,
  not a new endpoint, model call, retrieval capability, security scheme, or
  factuality claim.

- **feat(worker tooling): gate the Agent Output Verification deployment through
  Vizier.** The local deployment command binds the fixed Worker target to the
  current clean Git commit, validates the decision and receipt hash, and runs
  Wrangler only after `ALLOW`. The Vizier credential stays in macOS Keychain.
  This operator-side check is bypassable by a process that already has general
  shell and Cloudflare credential access. No Worker request, response, Agent
  Card, or public API contract changes.

- **fix(worker): support Agenstry HTTP ownership verification.** Worker
  deployments can now serve `GET /.well-known/agenstry-verify` from a
  per-environment `AGENSTRY_VERIFY_TOKEN` secret. The route returns `404` when
  the binding is absent or malformed, disables caching, and is excluded from
  funnel telemetry. Verification tokens remain outside source and Wrangler
  configuration.

- **feat(action gate): add `pre_action_check` to the existing Agent Output
  Verification surface.** The additive request and response contracts route a
  caller-controlled action to `continue`, `request_evidence`,
  `require_approval`, or `stop` using supplied claim evidence, risk tier,
  policy-check results, and an optional external approval reference. The same
  behavior is exposed through Python services, HTTP, stdio MCP, the A2A
  adapter, and the existing Cloudflare Worker profile. Twenty replay cases run
  against both Python and Worker implementations. The function is stateless;
  it does not authenticate, authorize, enforce, sign a receipt, store an
  approval, or perform an action. No new Worker or deployment is included.

- **fix(a2a): align all eight Worker profiles with the A2A 1.0 JSON-RPC
  contract.** Agent Cards now advertise the protocol only through
  `supportedInterfaces`; public deployments no longer misrepresent the
  optional `X-Client-Id` observability header as authentication. `SendMessage`
  validates the v1 Message shape, rejects unsupported versions, preserves the
  JSON-RPC request id, and returns the required `result.task` wrapper. The
  legacy `message/send` and `tasks/send` forms remain available as unadvertised
  A2A 0.3 aliases. Added local tests and an eight-endpoint public conformance
  matrix covering cards, representative calls, result envelopes, content
  types, and JSON-RPC errors. Operational inventory, signing state, staged
  deployment, and rollback-sensitive key guidance are recorded in
  [A2A-MAINTENANCE.md](A2A-MAINTENANCE.md).

- **chore(packaging): conform to the Agent Plugins 1.0.0 layout.** Added a root
  `plugin.json` and a root `mcp.json` carrying the `$schema` identifiers from
  <https://agent-plugins.org>. The existing `.claude-plugin/`, `.codex-plugin/`
  and `.mcp.json` files are unchanged; the specification ignores them, so no
  installer loses its manifest. `skills/` already matched the spec's discovery
  rule (one skill per immediate child directory holding a `SKILL.md`).
  Both new files validate against the published Draft 2020-12 schemas.

- **feat(worker tooling): `npm run funnel` reads the funnel events, and works
  around Cloudflare's silent sampling.** The events shipped in the previous
  entry could only be read by hand. `deploy/cloudflare-worker/scripts/funnel.js`
  now queries the Workers Observability API with `CF_API_TOKEN` from `.env` and
  prints steps, networks, user agents, referrers, and a plain list of visits
  that are not self-identified automation — crawlers are split out for display
  rather than dropped, since a crawler visit is still a fact about who found the
  endpoint.

  The trap it works around: this dataset is sampled on wider timeframes.
  Measured 2026-08-07 against five known events — a 6-hour query returned all
  five at `abr_level` 1, a 24-hour query returned one at `abr_level` 10. A naive
  72-hour query undercounts by an order of magnitude with no error and no
  warning. The script walks the window in 6-hour slices, merges them, and prints
  a warning if a slice still comes back sampled. Tooling only: no worker code,
  schema, or deployment change.

- **feat(worker analytics): instrument the steps before a call, and what the
  caller left with.** The KV log records `message/send` and `tools/call` only,
  so with single-digit weekly visitors the drop-off was invisible: someone who
  opened the agent card and left produced no record anywhere, and a call that
  returned `insufficient_information` was indistinguishable from one that
  returned a usable verdict.

  Two additions. Each discovery GET now emits an
  `agenda_intelligence_a2a_funnel` event with a `step` of `landing`, `card`,
  `discovery`, or `docs`, carrying the same privacy-safe caller fields as the
  usage event. `/health`, `/status`, `/robots.txt`, `/stats`, and the JWKS route
  stay silent so monitoring traffic does not bury real visits. These go to
  Workers Logs, not KV: the free KV tier allows 1,000 writes a day against
  250-480 discovery GETs on a namespace already shared with the rate limiter
  and the snapshot cache, while Workers Logs takes 200,000 a day at no cost.

  Second, every logged call now carries a uniform `outcome` — the routing
  decision the caller received, its status, and its score — read from the
  profile's `readiness_contract`. `/stats` gains an `outcomes` breakdown and
  `counters.empty_handed`, the number of calls that ended in
  `insufficient_information` or `invalid_request`. That ratio, not the raw call
  count, is what says whether people who arrive can use the thing.

  No IP address, cookie, authorization header, or prompt text is stored, in
  either event. Additive: no schema, endpoint, or A2A profile change. Worker
  suite 158/158. **Activation:** redeploy each published env.

- **feat(mcp): adopt the 2026-07-28 stateless core, and serve MCP from the
  deployed workers.** The stdio server still declared `2025-03-26`, three
  revisions behind. The 2026-07-28 revision removed sessions, the `initialize`
  handshake, and SSE resumability; added the mandatory `server/discover`; made
  every result carry `resultType`; and made `tools/list` cacheable via `ttlMs` /
  `cacheScope`. All of that is now implemented. Older revisions keep working —
  `initialize`, `notifications/initialized`, and `ping` are still answered, and a
  request that states no version in `_meta` is treated as compatible. A version
  stated in `_meta` and outside the supported set is rejected with `-32022`.

  Because sessions are gone, MCP over HTTP no longer needs per-client state, so
  the Cloudflare workers now serve `POST /mcp` on the same request/response path
  they already use for A2A — no Durable Objects, no new binding. One deployment
  serves one profile and therefore exposes exactly one tool, named identically to
  its stdio twin. `tools/call` and `message/send` share one dispatch
  (`runProfileRequest`), so the two transports cannot return different verdicts
  for the same payload, and `tools/call` inherits the same Bearer gate, rate
  limit, and usage logging. `server/discover` and `tools/list` stay open, like
  `agent/card`. The MCP server card advertises both transports.

  Roots, Sampling, and Logging were deprecated in the same revision; none were
  ever used here. MCP Apps and the Tasks extension are deliberately not adopted.
  See [ADR 0024](docs/adr/0024-mcp-2026-07-28-stateless-core.md).

- **feat(mcp): two live workers had no MCP tool, and the rest could not be
  called without guessing.** Two defects in what an agent can act on.

  First, `kazakhstan_market_entry_readiness` and `agent_output_verification`
  shipped as service functions, HTTP routes, A2A profiles, and deployed
  Cloudflare Workers, but never as MCP tools — an MCP client could reach four of
  the six live vertical workers. Both are now exposed through `mcp_server`
  wrappers and the `TOOLS` registry, with golden and failure contract tests.
  `tests/test_mcp_tool_callability.py` now fails if any deployed worker has no
  MCP tool, so the surfaces cannot drift apart again.

  Second, every tool taking a structured payload declared it as a bare
  `{"type": "object"}` whose description named a schema file the caller has
  never read. An agent selecting from `tools/list` had to guess the payload,
  fail validation, and drop the tool. Nine constructive parameters now inline
  the request shape — field names, types, enum values, required list, local
  `$defs` references resolved, plus the schema's own worked example — generated
  from the bundled schema at import time rather than hand-copied, so it cannot
  drift. `get_schema` still serves the full nested contract, and each
  description names the exact key to ask for. Cost, measured: the `tools/list`
  payload grows from 23,313 bytes over 27 tools to 37,002 over 29 — roughly 3.4k
  extra tokens per connected session. The shapes are capped at two levels for
  that reason.

  `agent-manifest.json` and its packaged copy are regenerated to match (ADR 0012
  keeps them mirrored), and `llms.txt`, its packaged copy, and `MCP.md` no
  longer say market-entry is A2A-only. Python suite 515/515, lint and typecheck
  clean. No schema, endpoint, or A2A profile change; no worker redeploy needed.

- **fix(worker analytics): `modules_used` was recorded as `unknown` for every
  vertical worker.** `buildUsageEvent` normalised the field with
  `details.modules_used.map((item) => item.module)`, which is correct only for
  the routed `analyze` path (`[{ module, role }, ...]`). The six single-profile
  branches pass plain strings (`["cis_secondary_sanctions"]`), so the map read
  `.module` off a string, produced `[undefined]`, persisted `[null]` in KV, and
  aggregated as `unknown`. Measured over 2026-04-26..2026-07-24: 649 of 1329
  logged calls reported no modules — exactly the sum of the six affected
  profiles (310 + 134 + 97 + 95 + 12 + 1), confirming the cause. The new
  `normalizeModules` helper accepts both shapes and drops empty entries.
  Analytics-only; no request/response schema, enum, endpoint, or profile
  change. Regression test covers the string shape.

- **feat(worker analytics): name the caller that the coarse client class
  cannot.** `buildUsageEvent` already derived `referrer_host` and `cf.colo`,
  but `recordUsageStats` dropped both before writing to KV, so `/stats` could
  report only country and a five-bucket client class — every unrecognised
  caller aggregated as `unknown` from an unknown source. The reduced event now
  also persists the referrer host, the Cloudflare colo, the network operator
  (`cf.asOrganization`), and the user-agent truncated to 120 characters, and
  `/stats` gains `networks`, `referrers`, and `user_agents` breakdowns
  (`user_agents` capped at the top 15 rows/day — crawlers each ship their own
  string). `event_version` goes 1 → 2. Still no IP address, cookie,
  authorization header, or prompt text: the privacy guarantee documented in the
  worker README is unchanged in kind, and the README field list is updated.
  `scripts/stats.js` prints the three new rows. Worker suite 145/145, Python
  suite 506/506. **Activation:** redeploy each published env (`wrangler deploy`
  plus `--env` for the seven profile envs); until then `/stats` keeps returning
  the old shape for previously stored days, which remain readable — the new
  breakdowns simply read `unknown`/`none` for events written before the deploy.

- **feat(cis worker): surface the snapshot provenance date in A2A metadata.**
  The Snapshot upstream (ADR 0014) already computed
  `snapshot_generated_at` from the static public-list index it matches
  against, but the worker dropped the value before assembling the response, so
  a caller saw `live_retrieval_status: "success"` with no way to tell whether a
  "no match" reflected the current lists or a hand-rebuilt index that had gone
  stale. The A2A metadata block now carries
  `live_retrieval_snapshot_generated_at` (the index build date under the
  Snapshot upstream, `null` for Watchman / OpenSanctions, which query live).
  Additive metadata field, worker-only — the Python service uses the
  OpenSanctions adapter and has no snapshot path; no request/response schema,
  enum, endpoint, or profile change, so ADR 0003 / ADR 0015 are untouched. New
  worker test asserts the date is surfaced with the upstream on and is `null`
  with it off. Worker suite 142/142. **Activation:**
  `wrangler deploy --env cis-secondary-sanctions`.

- **fix(cis worker): drop the edge-cache override that pinned a stale
  sanctions index.** The Snapshot fetch passed
  `cf: { cacheTtl: 3600, cacheEverything: true }`, so Cloudflare held the index
  body at the edge for an hour independently of the adapter's own six-hour
  module TTL — and unlike the module cache, the edge copy survived isolate
  restarts and a `wrangler deploy`. Observed on 2026-07-24: the refreshed index
  was live on the site, the worker had been redeployed, and callers were still
  served the 2026-06-26 build with no operator lever to force the new one. The
  fetch now sets no `cf` override, leaving the module TTL as the single
  freshness regulator; the origin's own cache headers still absorb request
  load. Regression assertion added to the existing Snapshot adapter test.
  Worker suite 142/142. **Activation:**
  `wrangler deploy --env cis-secondary-sanctions`.

- **chore(cis worker): agent-card prose said "screening" for what is dated
  snapshot name matching.** Companion to the provenance-date change above. The
  card's `wrapper_scope` described "active server-side name screening against a
  public-list snapshot" and one buyer use case read "OFAC EO 14114
  secondary-sanctions exposure screening" — the product's own landing page FAQ
  says in as many words that this is *not* sanctions screening, so the card was
  the surface where the claim leaked, and it is the surface agents and
  marketplaces read. Reworded to "name matching against a dated public-list
  snapshot rebuilt on an operator cadence, not a live list feed" and "exposure
  triage before screening". Card free-string text only; no schema, enum,
  endpoint, or profile change. Worker suite 142/142. **Activation:**
  `wrangler deploy --env cis-secondary-sanctions`.

## 1.4.0 — 2026-07-22

- **release: publish the MCP evidence-packet workflow.** Synchronizes the
  package and discovery surfaces at `1.4.0`, adds a focused runnable stdio
  example for `check_evidence_packet`, and documents the decision-workspace
  boundary before high-stakes or irreversible action.

- **feat(mcp): expose the primary evidence-packet preflight.** Adds
  `check_evidence_packet` to the local stdio MCP contract so an agent can run
  the repository's primary claim/source packet check without dropping to the
  CLI or importing Python. The tool preserves the existing deterministic,
  caller-supplied-text boundary: it reports reference, quote, lexical-support,
  and unmatched-number diagnostics, never factual truth or authorization.

- **feat(mcp): authoring tools `create_brief` and `append_evidence`.** Adds two
  MCP tools (`since: v1.4`) that let an agent produce protocol documents inside
  the contract instead of hand-building JSON and validating it afterwards.
  `create_brief` assembles a brief from supplied fields, reports
  `missing_required` so an agent can fill it in over several turns, defaults
  `evidence_mode` to `reasoning_only`, and surfaces unknown keys in
  `ignored_fields` rather than dropping them. `append_evidence` appends a claim
  and its sources to an evidence pack, de-duplicates sources on `(name, url)`
  when the claim already exists, keeps `unsupported_claims` consistent with
  per-claim `support_status`, and never infers `supported` — an omitted status
  defaults to `unsupported` or `partially_supported`, and extending a claim
  without an explicit status leaves the stored one unchanged. Both are
  deterministic and stateless: they return the document to the caller and do not
  write files, fetch URLs, verify quotes, score source reliability, or assess
  factual truth. Additive per ADR 0012; no existing tool, schema, or response
  shape changed.

- **chore(verification): reproducible repository evidence.** Adds
  `make verification-report`, which runs the existing Python/package and
  Cloudflare Worker gates and writes a deterministic JSON result with hashed
  contract files. The report records zero paid API calls and explicitly limits
  its claim to internal technical verification. The Makefile now pins local
  `src/` ahead of stale editable installs so documentation smoke tests exercise
  the checked-out code.

## 1.3.0 — 2026-07-15

- **release: prepare v1.3.0 evidence-packet preflight.** Syncs package,
  manifest, discovery, container, registry, and plugin versions; adds a
  published-wheel smoke check for the evidence-packet command; and replaces
  the stale `1.2.0` first-run path with a coherent editable-source workflow.

- **feat(focus): evidence-packet preflight as the primary repo workflow.**
  Adds additive `evidence-packet-request` and `evidence-packet-response` v1
  schemas plus `services.check_evidence_packet`. The existing `check` CLI now
  auto-detects this packet shape and returns `packet_complete`,
  `source_review_required`, or `packet_incomplete`, with claim/source reference
  checks, verbatim quote checks, lexical-support diagnostics, unmatched-number
  flags, and owner actions. `factuality_status` is always `not_assessed` and
  human review is always required. Legacy `check <agenda-brief.json>` behavior
  remains compatible. Existing vertical workers and MCP/A2A/HTTP contracts are
  unchanged and are now documented as compatibility profiles rather than the
  repository's primary product narrative.

- **docs(example): first live-source-backed Claim Verdict pack.** Records
  authoritative PyPI and GitHub release metadata retrieved on 2026-07-11 for
  `agenda-intelligence-md` `1.2.0`, with two bounded `verified` verdicts and an
  explicit reminder that source stance is caller-supplied rather than fetched
  or inferred by `verify-claims`.

- **fix(release): serialize MCP Registry publication behind PyPI visibility.**
  The tag-triggered registry workflow now waits for the exact package version
  to become visible through the PyPI JSON API before publishing. This closes
  the observed `404` race between parallel release workflows. Post-release
  smoke now executes `grounded-check` and `verify-claims` from the published
  wheel and asserts that both MCP tools are present.

- **feat(capability): bounded factual Claim Verdict (`verify_claims`).** Adds a
  separate deterministic layer over caller-supplied evidence records. It checks
  freshness, source authority, independent source groups, conflicts,
  jurisdiction, and exact subject identifiers as of a declared date, then
  returns `verified`, `contradicted`, `partially_supported`, `unresolved`, or
  `not_verifiable`. Ships with request/response schemas, CLI and MCP surfaces,
  an example request, ADR 0023, and contract tests. It does not discover or
  fetch sources, perform fuzzy entity resolution, or make legal/compliance
  determinations. `verified` means the declared evidence threshold is met by
  the supplied set, not absolute truth; human review remains required.

- **feat(capability): `grounded_check` — claim-to-corpus grounding triage over
  caller-supplied source texts.** New composed service capability (tier of
  `audit_claims` / `verify_quotes`, not a commercial vertical worker) that takes
  a claim set plus the full text of the sources the claims should rest on and
  returns a deterministic per-claim grounding status (`grounded` /
  `weakly_grounded` / `ungrounded`), term coverage against the best-matching
  corpus document, a best-matching passage excerpt, numeric values not found
  anywhere in the corpus, verbatim quote checks, owner actions, and an overall
  `grounding_signal`. Ships behind `schemas/v1/grounded-check-request.schema.json`
  + `grounded-check-response.schema.json`, the `grounded_check` MCP tool, the
  `grounded-check` CLI subcommand, an example pack under
  `examples/grounded-check/`, and contract tests. Lexical and local-text only:
  no live retrieval, no source discovery, no source-reliability scoring, no
  factual-truth verification — grounding in a wrong corpus does not make a claim
  true; `human_review_required` is always true. Classification: reusable
  runtime improvement; no traction claim.

- **feat(worker): Cloudflare A2A parity + host for `agent_output_verification`.**
  JS parity of the relay-readiness verdict in `deploy/cloudflare-worker`
  (`src/index.js` result/card/parser, `src/profiles.js` discovery profile),
  a dedicated wrangler env `agent-output-verification-a2a`
  (`AGENT_PROFILE=agent_output_verification`), and worker contract tests
  (grounded/allow, unsupported/block, orphan-evidence/block, weak/verify, invalid
  shape, bad enum). `make verify-local` green (141 worker tests). The live
  endpoint is not deployed by this change — `wrangler deploy --env
  agent-output-verification` is the operator step. Build-to-learn: exposed as a
  discoverable trust/verification node, no traction claim.

- **feat(capability): `agent_output_verification` — A2A relay-readiness verdict
  over a claim set.** New composed service capability (tier of `audit_claims` /
  `score_output`, not a commercial vertical worker) that wraps a claim-level
  evidence audit (`evidence-audit.schema.json`) and returns a machine-actionable
  relay verdict — `allow_relay` / `verify_before_relay` / `block_unsafe_claims` —
  plus unsafe/weak claims, evidence gaps, and owner actions, for one agent
  verifying another agent's output before relaying or acting on it. Ships behind
  `schemas/v1/agent-output-verification-response.schema.json`, `POST
  /v1/agent-output/verification`, the `agent_output_verification` A2A capability
  and agent-card skill, and contract tests. Schema-level and structural only: no
  factual-truth verification, no live retrieval, `human_review_required` is true
  for any verdict other than `allow_relay`. Classification: build-to-learn — no
  observed buyer or paid usage; exposed as a discovery/positioning capability,
  not a revenue claim.

- **feat(worker): profile-as-funnel — point the structured gates at the
  Corridor & Sanctions Risk Assistant front door.** Appended one factual
  navigation line (`PROVIDER_FRONT_DOOR_POINTER`) to the Middle Corridor,
  Gulf maritime, CIS secondary-sanctions, and Kazakhstan market-entry card
  descriptions so a human landing on any gate is funnelled to the front
  door and the free pre-deal screening memo instead of navigating nine
  cards blind. No traction claim, no contract/schema/response change.

- **feat(worker): add GLEIF ownership enrichment for `cis_secondary_sanctions`
  (ADR 0022).** New `deploy/cloudflare-worker/src/upstream_gleif.js` adapter
  resolves a counterparty name against the free, no-key GLEIF LEI relationship
  pool (`api.gleif.org`, CC0-1.0) and contributes disclosed direct/ultimate
  parent as `ownership_chain_evidence` / `beneficial_ownership_source`. It runs
  **alongside** the sanctions-list upstream (never replaces it) and is **off by
  default** — activated only when the operator sets `GLEIF_ENABLED`, so merging
  changes no live behavior. Disclosed relationships only; not hidden or
  multi-layer beneficial ownership; boundaries unchanged (not advice,
  human-review required, not identity verification). Adds a SOURCE_POLICY
  whitelist row (dual-copy) and two worker tests. No schema or response-shape
  change.

- **feat(worker): sharpen Agentic Interaction Trust Gate positioning to
  counterparty-agent verification.** Reframed the `agentic_interaction_trust`
  agent card, skill, tags, examples, and use-case doc to lead with the
  agent-to-agent case — "before you let a counterparty agent transact or
  invoke a capability, check whether the evidence to trust that interaction
  is present" — matching the A2A/x402 marketplace audience. No contract,
  schema, service-function, or response change; boundary reaffirmed
  (evidence-readiness only, not identity verification or authorization).

- **feat(worker): add Corridor & Sanctions Risk Assistant discovery front.**
  New lightweight A2A profile `corridor_sanctions_assistant` (Zee-pattern):
  a human-facing front door that orients a corridor/sanctions deal-risk
  question, routes to the four structured gates, and hands off a free
  pre-deal screening memo. It is NOT a vertical worker — no schema, no
  service function, no triage, scoring, screening, or retrieval of its own;
  `message/send` returns a deterministic orientation artifact only.
  Adds the profile (`deploy/cloudflare-worker/src/profiles.js`), card +
  routing + deterministic responder (`src/index.js`), wrangler env
  `corridor-sanctions-assistant`, worker tests, and a use-case doc. Going
  live is an operator deploy (`wrangler deploy --env
  corridor-sanctions-assistant`), a public-positioning step outside CI.

- **feat(distribution): add Codex plugin manifest.** Added
  `.codex-plugin/plugin.json` so Codex marketplace installs expose the bundled
  `skills/` and `.mcp.json` MCP server instead of installing only legacy Claude
  plugin metadata.

- **feat(evidence-ledger): add internal evidence assembly module.**
  Added `agenda_intelligence.evidence_ledger` with an append-only
  `EvidenceLedger`, deterministic reference normalization, protected-reference
  filtering, claim-support/data-integrity channels, and a presentation-update
  guard that rejects formatter changes to route, score, verdict, or references.
  The shared service-layer dated-source intake now uses the ledger for
  de-duplicated supplied-source typing. No schema, CLI, MCP, HTTP, A2A, or
  public response contract change.

- **feat(agent-readiness): add agent-card readiness lint + canon checklist.**
  New top-level `AGENT_READINESS.md` (delegation-readiness checklist:
  identity attribution, capability scope, interface contract, security
  declaration, autonomy boundary, payment permissions, operator contact;
  stance MCP-first / A2A-later / payment-safe / human-escalated) and a new
  CLI command `validate-agent-card` — a static lint of a published agent
  card against that checklist plus the statically checkable subset of a
  public registry 9-criterion conformance methodology (CC-BY-4.0,
  attributed in the doc). No endpoint probing, no cryptographic signature
  verification, no new worker surface, no MCP tool added. Contract:
  `schemas/v1/agent-readiness-report.schema.json` (+ packaged copy);
  tests cover one golden signed card and one failure card (unsigned,
  payment surface without limits).

## [1.1.2] – 2026-07-02

- **release: v1.1.2 distribution checkpoint.** Bumped package, manifest,
  registry, and plugin metadata versions to `1.1.2`. Added an
  `agenda-intelligence-md` console-script alias for
  `agenda_intelligence.mcp_stdio:main` so `uvx agenda-intelligence-md`
  resolves (required by MCP Registry clients, which construct the launch
  command from the package identifier). Listed `central-asia-caspian` and
  `gulf-middle-east` in the plugin marketplace after their repos renamed
  runtime overlays from `skills/` to `runtimes/` and added plugin packaging.

- **feat(distribution): stage official MCP Registry publication metadata.**
  Added `server.json` (registry name
  `io.github.vassiliylakhonin/agenda-intelligence-md`, PyPI package entry,
  stdio transport, `uvx` runtime hint) and an invisible `mcp-name:` HTML
  comment marker at the top of README so the registry can verify PyPI
  package ownership. Publication itself is a separate step: it requires a
  v1.1.2 PyPI release (so the marker lands in the published README) and an
  interactive `mcp-publisher login github` + `mcp-publisher publish`.
  The planned v1.1.2 release should also add an `agenda-intelligence-md`
  console-script alias for `agenda_intelligence.mcp_stdio:main`, because
  registry clients construct `uvx agenda-intelligence-md` from the package
  identifier and no script by that name exists today.

- **feat(distribution): package the repo as a Claude Code plugin marketplace.**
  Added `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`
  (listing this runtime plugin plus `global-think-tank-analyst`) and
  `.mcp.json` so the MCP server auto-loads on plugin install via
  `uvx --from agenda-intelligence-md agenda-intelligence-mcp`. Added an
  "Install in Claude Code" section to README. Verified locally with
  `claude plugin install` from an isolated config (2 skills + 1 MCP server
  discovered). The two regional specialist repos are deferred: their
  `skills/{claude,codex,openclaw}/` runtime-overlay layout collides with
  plugin skill auto-discovery (overlay dirs would install as junk-named
  skills), so listing them waits on a packaging-convention decision.

- **release: prepare v1.1.1 hardening checkpoint.** Bumped package,
  manifest, and MCP registry metadata versions to `1.1.1`; added
  `RELEASE_NOTES_v1.1.1.md`; corrected `RELEASE_NOTES_v1.1.0.md` to match the
  already-published A2A / Worker parity release. No tag is pushed in this
  commit because the current tag workflow publishes to PyPI on any `v*` tag.

- **feat(weekly-delta): add confidential workflow golden/failure bench.**
  Added `weekly-delta-bench` for deterministic weekly/status fixtures. The
  bench checks route selection, unsafe-to-repeat claim extraction, owner-action
  coverage, missing source-plan categories, alias-only discipline, and boundary
  notice. The initial fixture set includes one alias-only committee-escalation
  golden case and one naming-leak failure case. No LLM, factual verification,
  advice, or new worker surface added.

- **test(memo-quality): add confidential project-room quality regressions.**
  Added a golden confidential project-room memo, a schema-valid naming-leak
  failure memo, a new `confidential_alias_discipline` guardrail in
  `memo-quality-bench`, and a `weekly-delta` regression that checks alias-only
  synthetic output, unsafe-to-repeat claims, and owner-action coverage. This
  raises the memo-quality fixture set to 5 golden / 8 failure cases without
  changing the agenda-memo schema or factual-verification boundary.

- **docs(analysis-bank): close the AnalysisBank hardening checkpoint.** Added
  release notes and an operator checkpoint for the reasoning-memory layer:
  before/after state, runtime path, edit checklist, quality gates, and a stop
  rule. This documents the current contract after lifecycle linting, packaged
  memory parity, retrieval/applicability benches, guarded `analyze` prompt
  injection, and `audit.reasoning_memory`. No runtime behavior changed in this
  docs-only checkpoint.

- **docs(discovery): remove the deprecated discovery wedge.** Deleted the deprecated teardown/profile docs, public-signal scans, profile template, OKF concept, catalog entry, entity-map node, and README / `llms.txt` positioning so the repository no longer advertises that removed discovery path. The remaining build-to-learn public artifact is the alias-first confidential project-room workflow.

- **feat(worker): optional access controls on the CIS message/send route, both off by default.** Two independent levers, shipped dormant so live behavior is unchanged until activated (same "off by default — activation is the go-live step" pattern as the Snapshot upstream). (1) Wired `cis_secondary_sanctions` into the existing per-profile bearer gate (`productionAuthKey` now reads `CIS_SECONDARY_SANCTIONS_API_KEY`) — a hard paywall that closes the route (incl. the public demo) for the day a paying integration appears; agent-card discovery stays public. (2) Added a best-effort soft rate limit on `message/send` (`rateLimitPerHour` / `checkRateLimit`): when `RATE_LIMIT_PER_HOUR > 0` it buckets per profile + client IP (`cf-connecting-ip`) + UTC hour in the existing `AGENDA_USAGE` KV and returns JSON-RPC `-32002` / HTTP 429 over the cap, keeping the free browser demo usable while throttling bulk programmatic use. KV is eventually consistent so this deters scripting rather than being a hard control, and it fails open on any storage error. Both documented as commented `wrangler.toml` entries on the CIS env. New contract tests (CIS key scoping; `rateLimitPerHour` parsing; throttle-past-cap with per-IP isolation; no-op when unconfigured; fail-open on KV error); worker suite 121/121 green, `verify:agent-card` green. No schema, request/response shape, or dual-copy path touched. Deploy is manual `wrangler deploy --env cis-secondary-sanctions`; merging changes nothing live.
- **fix(worker): agent-card prose lagged the active Snapshot upstream.** The `live_retrieval` block correctly listed Snapshot as active, but four prose fields still described the profile as "optional OpenSanctions / Watchman live retrieval when configured": `wrapper_scope`, `skills[0].description`, `focus[1]` ("OpenSanctions consolidated dataset name matching"), and the `boundaries` active-line carried a wrong license tag (CC-BY 4.0 / Apache-2.0 — those are the OpenSanctions/Watchman licenses, not the public-list snapshot's). Reworded all four to describe active server-side name screening against a public-list snapshot (Snapshot upstream; Watchman / OpenSanctions as alternates), with the "possible string match only, not a determination" boundary. Card text only; worker suite 117/117; redeployed to `cis-secondary-sanctions-a2a` (verified live via cache-busted fetch — the plain `.well-known` response converges as the edge cache expires).

- **docs(cis): sync README / SOURCE_POLICY / use-case doc to the active Snapshot upstream.** After [ADR 0020](docs/adr/0020-activate-snapshot-upstream-cis-secondary-sanctions.md) activated `cis_secondary_sanctions` live retrieval, the prose still described the profile as OpenSanctions-only and "both upstreams currently deferred". Updated the README CIS section + endpoint line, the use-case doc, and the `SOURCE_POLICY.md` per-profile whitelist (dual-copy synced) to list three upstreams tried in order — **Snapshot** (active, $0, no host), Watchman (free self-host, deferred), OpenSanctions (paid, deferred) — with the Snapshot row marked Active. Boundaries restated: possible string match only, not identity verification / determination, human review required, no paying customers. Docs only; `test_package_consistency` green.

- **feat(worker): activate the Snapshot upstream for `cis_secondary_sanctions` ([ADR 0020](docs/adr/0020-activate-snapshot-upstream-cis-secondary-sanctions.md)).** Sets `SNAPSHOT_INDEX_URL` as a declarative var in `wrangler.toml` for the `cis-secondary-sanctions` env (pointing at the published compact index) and deploys it. The live `cis-secondary-sanctions-a2a` endpoint now performs $0 server-side name screening — verified `live_retrieval_status: success`, `upstream: Snapshot`, exact match on a known SDN entity. This flips the profile's public posture from "no live retrieval" to "server-side screening against a fresh public-list snapshot" (hence the ADR); boundaries unchanged — possible string match only, not identity verification / determination, human review still required. Deactivate with `SNAPSHOT_DISABLED=1` + redeploy. Portfolio demo page copy and agent-card text updated to match.
- **feat(worker): $0 Snapshot upstream for CIS secondary-sanctions server-side name screening (ADR 0014).** Adds a third per-profile live-retrieval upstream for `cis_secondary_sanctions`, `Snapshot` (`deploy/cloudflare-worker/src/upstream_snapshot.js`), listed first ahead of Watchman (free self-host) and OpenSanctions (paid). Unlike those, it needs no external container: the worker fetches one compact public-list name index — `sanctions-name-index-compact.json`, published by the portfolio site's `scripts/sanctions_name_index.py` from OFAC SDN + consolidated, EU consolidated, and UK FCDO source files (11.3 MB full index → 2.76 MB compact, dropping the precomputed normalized string / type / id and de-duplicating authority+list into a `src` table) — and matches in-process. Matching is deliberately CPU-cheap for the Worker budget: exact normalized-name match plus significant-token overlap (>=2 shared tokens, >=0.82 ratio), **no** per-request Levenshtein (fuzzy stays browser-side). The parsed index is cached in module-global scope per isolate and re-fetched after a 6 h TTL; corporate-noise tokens (>1500 postings) are dropped to bound memory. Graceful degrade on unset `SNAPSHOT_INDEX_URL`, network/HTTP/timeout failure, or malformed index — the caller never fails. Wired into `PROFILE_LIVE_RETRIEVAL`, the agent-card `live_retrieval.upstream_options`, the deferral note, and the `matchAgainstActiveUpstream` dispatcher; results flow through the existing `auto_fetched_sources` + attribution path (attribution only surfaced when a match is actually merged). New contract tests (exact + token-overlap golden with module-cache reuse and a no-false-positive case; disabled-when-unset degrade; status/agent-card upstream ordering); worker suite 117/117 green; `verify:agent-card` green. **Off by default — activation is the go-live step:** `wrangler secret put SNAPSHOT_INDEX_URL --env cis-secondary-sanctions` (point it at the published compact index) then `wrangler deploy --env cis-secondary-sanctions`. Flipping it on flips the profile's public "no live retrieval" posture, so it still needs the ADR-0014 positioning update + the page copy refresh before going live; until activated the profile stays evidence-only and the demo's browser-side preview is unchanged.
- **docs(worker): ground the maritime indicators with supporting empirical research.** Added a "Supporting research (empirical context)" section to the gulf-maritime-exposure use-case doc and a `vessel_due_diligence_indicators` grounding paragraph (previously undocumented in prose, unlike the other MC checklists) to the Middle Corridor use-case doc. Both cite recent maritime-detection research — dark ship-to-ship transfers, dark AIS-off vessel trajectories, and AIS / GNSS spoofing — as empirical corroboration that the dark-fleet / STS / AIS-manipulation practices the workers flag are prevalent and hard to detect, which is why a documented evidence-readiness check is warranted. Explicitly framed as empirical context, **not** the regulatory basis (OFAC / EU / UK OFSI / UN guidance remains load-bearing): the workers presence-flag the evidence gap and implement none of the cited detection methods. Docs only — no schema, contract, indicator logic, decision path, or dual-copy path touched; boundary disclaimers preserved.
- **feat(worker): observe-only source-URL link-integrity lint on the Middle Corridor deal-risk response.** Cited `dated_sources[].url` values are now structurally classified — `well_formed`, `illustrative` (documented placeholder hosts such as example.com), or `malformed` (non-http(s) scheme, missing host, or a placeholder token like `tbd` / `n/a`). When at least one source carries a malformed URL the response gains an optional `link_integrity` block (`checked` / `well_formed` / `illustrative` / `flagged[]` with the offending url, reason, and source id/type); otherwise the field is omitted and existing output is byte-identical. The lint is structural only: it does NOT fetch URLs, verify that a page exists, perform live retrieval, or check content, and it does NOT change the triage recommendation, risk signal, operational decision, readiness score, or evidence gaps — proven by a contract test that runs the canonical `ready_for_human_review` fixture with and without a mutated URL and asserts every other field is unchanged. Additive optional schema property under top-level `additionalProperties: false`; dual-copy synced under `src/agenda_intelligence/data/`. First step toward source-citation-integrity checking; the live archive-presence variant remains deferred behind ADR 0014 and is not implemented here.
- **docs(worker): name the encoded sanctions frameworks in the Middle Corridor agent card.** The live `middle_corridor_deal_risk` agent card described its output generically ("sanctions-relevant / re-export jurisdiction flags"), so a technical evaluator reading the card or the Agenstry listing could not see the specific frameworks the deterministic engine actually encodes. The `card.description` and the `sanctions-adjacency-evidence-gate` skill description now name them: OFAC named-sector (EO 14024/14114) and newly-formed-counterparty red flags, EU re-export / circumvention-watch jurisdictions (incl. the 20th-package measures on Kyrgyzstan), and dual-use cargo screened against the EU/US Common High Priority List — plus an explicit "deterministic rule-based logic, no model in the decision path". Description text only; no schema, contract, skill id, tag, or dual-copy path touched; the "Presence-flagging and evidence triage only, not a sanctions determination" disclaimer is preserved verbatim. Worker suite 112/112 green; `verify:agent-card` green. **Activation:** `wrangler deploy --env middle-corridor-deal-risk-gate` — until then the live card and the Agenstry listing keep the prior wording.
- **fix(evidence-mode): tolerate terminal `[verify]` punctuation and require provenance for source-backed modes.** The post-hoc `check_evidence_mode_discipline` validator now accepts factual claims ending in `[verify]` followed only by trailing punctuation/whitespace, while still rejecting mid-sentence markers. It also treats `mixed` / `user_provided` memos with empty or missing `audit.provenance` as discipline failures, preserving `reasoning_only` as the valid source-free mode. Added generated schema-valid golden/failure fixtures plus direct regression tests. Docs now state the structural boundary explicitly: this validator cannot detect mislabeled `basis`, fabricated content, or determinative facts hidden inside `reasoning_only` prose; `[verify]` is a human-review flag, not a truth signal. Runtime wiring remains a human decision because the function is still post-hoc/test/eval-only and is not yet invoked by `validate_memo`, MCP, HTTP, or A2A.
- **feat(cis, market-entry): currency-refresh from a 2026-06-20 landscape pain-discovery.** A fresh scan of the three corridor verticals confirmed the existing frames still hold (same finding as prior rounds: pains real, already covered) but surfaced two regime moves worth sharpening to the current state. Both additive, presence-flag only (no score movement, ADR 0015 intact), mirrored in the Cloudflare Worker JS parity, with new Python + JS tests. (1) **CIS country-level anti-circumvention:** the EU's 20th package (2026-04) was the first activation of the country-level anti-circumvention tool, against Kyrgyzstan (restricted item categories to the country + regional FI transaction bans). New `COUNTRY_LEVEL_ANTI_CIRCUMVENTION` set (Kyrgyzstan), and `cis_secondary_sanctions_exposure` now adds a sharper `limitations` line when the counterparty is domiciled there — confirm the restricted item categories / onward destination and check correspondent exposure to any regional FI designated in that package. Distinct from, and sharper than, the existing softer circumvention-watch flag; no specific bank is named (durable, no maintenance liability). (2) **Market-entry currency-control 2026 mechanism:** Kazakhstan's 2026 currency-control rules (NB Resolution No. 29, in force 2026-04-19) make currency-contract registration mandatory at the USD 50,000 threshold for legal entities and let banks delay/refuse cross-border intercompany transfers lacking demonstrable economic substance. The `currency_control_and_repatriation_note` evidence-gap copy is sharpened to name the USD 50,000 threshold and economic-substance evidence for intercompany flows (capital, shareholder loans, royalties, management fees). Free-string output / code copy only — no schema, taxonomy structure, enum, or dual-copy path touched. `make ci` green; worker suite 112/112. **Activation:** `wrangler deploy --env cis-secondary-sanctions` and `--env kazakhstan-market-entry-readiness`.
- **chore(cis): de-stale "EU 14th package" wording to non-staling "EU sanctions package".** Companion to, and the deferred follow-up named in, the expert-review entry below. The CIS secondary-sanctions worker still referenced the "EU 14th package" (mid-2024) across descriptions, schema `description` fields, the emitted `top_exposure_dimensions` text, the three contract example fixtures, and docs; the EU is on its 20th package (April 2026), so the stale number read as unmaintained to a compliance audience seeing it in the agent card, MCP tool description, or the worker's own output. Replaced with the generic, non-staling "EU sanctions package" across README, worker JS (skill name / description / example + emitted dimension), MCP tool description, A2A adapter, request/response schemas (+ dual-copy under `data/`), the CIS contract fixtures, and the use-case / agenstry docs. **Non-breaking and deliberately minimal:** the skill id `eu-14th-package` is kept as an opaque stable slug (renaming it would be the only breaking part and risks external/Agenstry references for no user-visible benefit), so no version bump and no ADR are required — descriptive-text + free-string-output wording only, no schema shape / enum / endpoint / profile change. ADR-0014 left untouched (immutable history). `top_exposure_dimensions` is a free string array (not enum) and the contract fixtures validate against schema rather than by equality, so the wording change stays schema-valid. `make ci` green; worker suite 110/110. **Activation:** `wrangler deploy --env cis-secondary-sanctions`.
- **feat(middle-corridor): expert-review output fixes — end-user-statement gap on dual-use cargo, rail-aware corridor framing, 50% Rule prompt, screening-result wording.** A 2026-06-19 trade-compliance review of the live deal-risk gate surfaced four output-layer gaps, all fixed additively (no schema change, no dual-copy path touched, ADR 0003/0015 intact; score and signal stay structural). (1) **End-user-statement gap (the substantive one):** when the cargo is presence-flagged dual-use *and* no `end_user_or_reexport_evidence` is on hand, `limitations` now carries a distinct deal-state line ("…no end-user / re-export evidence is on hand; obtain a signed end-user statement before signature…") — the prior dual-use flag gave generic "obtain an EUS" advice but never said the file currently lacks one. Deliberately a `limitations` flag, not a scored required-before-go item, so it does **not** move `decision_readiness_score` (a test asserts the EUS-supplied vs. not-supplied score is identical). (2) **Rail-aware framing:** the corridor is rail + Caspian ferry, not maritime — `vessel_or_carrier_history` evidence-gap copy and the `carrier / vessel / rail-operator history gap` risk relabelled, and two rail prompts added to `customs_harmonization_indicators` (gauge-change/transload at Khorgos / Altynkol; Caspian demurrage / wagon-detention / ferry-slot at Aktau / Kuryk). (3) **50% Rule prompt:** the missing-beneficial-ownership exposure line now names the OFAC/EU 50 Percent Rule (aggregate blocked-person ownership) as the human-review step the file is not yet ready for. (4) **Screening wording:** "sanctions list extract" evidence-gap copy reframed to "sanctions screening result" (screening is a process producing a result, not a held document); the request-schema enum key `sanctions_list_extract` is unchanged. Mirrored in the Cloudflare Worker JS parity; new Python contract test (EUS-gap fires without evidence, clears with it, score-invariant) + JS worker parity test. **Deliberately NOT changed:** the engine's `EU 14th package` references (schemas, CIS contract example fixtures, `eu-14th-package` skill id, ADR-0014 history) were left in place — sweeping them to the current package (20th, Apr 2026) touches the frozen contract, dual-copied schemas, a skill id, and an immutable ADR, so it needs its own versioned change; the user-facing portfolio pages were already updated to non-staling wording. **Activation:** `wrangler deploy --env middle-corridor-deal-risk-gate`.
- **feat(middle-corridor): cargo-string dual-use / export-controlled presence flag (ADR 0015 deferred item).** A 2026-06-19 functional review of the live deal-risk gate found that the cargo field was inert: a deal declaring `microcontrollers and RF modules` — the single most material risk in a corridor-diversion deal — produced only the generic `sanctions adjacency` risk, never an export-control flag, even though ADR 0015 explicitly lists cargo-string dual-use detection as a legitimate, deferred, same-pattern presence flag. `middle_corridor_deal_risk` now scans the declared `cargo` string against a BIS/EU Common High Priority List (CHPL) term set (microelectronics, RF/transceiver, FPGA, GNSS/inertial, CNC/machine-tools, precision bearings, UAV, thermal/night-vision, carbon fibre, …) and, on a match, adds `"cargo includes a potential dual-use / export-controlled item"` to `top_risks`, a named `limitations` line ("…export-control escalation flag for human review, not a classification or licensing determination. Obtain an end-use / end-user statement…"), and surfaces `reexport_control_indicators` even when end-user evidence was supplied. Per the ADR 0015 boundary this is presence-flagging routed to human review — NOT an export-control classification, licensing determination, or live screening — and it deliberately does **not** move `decision_readiness_score` or `risk_signal`, which stay structural (a contract test asserts a dual-use vs. benign cargo yields the same score/signal). Surfaced through existing free-string response fields only, so **no schema change and no dual-copy path touched**; mirrored byte-for-wording in the Cloudflare Worker JS parity (`deploy/cloudflare-worker/src/index.js`). New Python contract tests (positive flag + score-invariance) and two JS worker parity tests; ADR 0003 freeze intact. **Activation:** `wrangler deploy --env middle-corridor-deal-risk-gate` — until then the live route keeps the prior output.
- **feat(market-entry): `route_to_committee` gate decision ([ADR 0019](docs/adr/0019-market-entry-route-to-committee-gate-decision.md)).** The market-entry gate previously collapsed `committee_review_ready` and `launch_commitment_ready` onto the same `escalate_before_signature` verdict, so a signature-grade file with open operational/sector gaps read as alarmingly as a fully complete one. Adds one value, `route_to_committee`, to the response `gate_decision` enum and remaps `committee_review_ready -> route_to_committee` (leaving `launch_commitment_ready -> escalate_before_signature`). Additive output-enum extension to the market-entry response schema only — no request-contract change, no touch to the frozen v1.0.x request/memo family, `x-schema-version` stays `1`. Mirrored in the Python service and the Cloudflare Worker JS parity; dual-copy `data/` response schema synced; new contract/service + worker tests assert both the committee and the complete-file mappings; worker redeployed.
- **chore(reporting): migrate the deal-risk PDF renderer off the deprecated fpdf2 `ln=` parameter** to `new_x=XPos.LMARGIN, new_y=YPos.NEXT` (fpdf2 >= 2.7, the declared `pdf`-extra floor). Output is identical; clears the local mypy deprecation diagnostics that appear when the optional `pdf` extra is installed (CI's `.[dev]` env does not install fpdf2, so this was never a CI failure).

- **feat(market-entry): real sector differentiation, tailored watch-next, and input-aware claim audit for the Kazakhstan market-entry readiness gate.** Live-testing the demo surfaced that the gate treated `sector` as cosmetic — every sector (renewable_energy, epc, infrastructure, data_center, technology_transfer, distribution, …) returned the same generic checklist — and that `watch_next` was a static 20-item dump while `claim_audit` ignored caller-supplied `known_blockers` / `known_assumptions`. Additive fix across both runtimes (Python service `services.kazakhstan_market_entry_readiness` and the Cloudflare Worker JS parity in `deploy/cloudflare-worker/src/index.js`): (1) a `sector_requirements` map in the source taxonomy folds sector-specific required evidence into the launch-commitment ceiling and the evidence-gap list, so a renewable file now surfaces grid-connection/offtake and land/site-control gaps, a technology-transfer file surfaces IP-ownership and export-control gaps, etc.; (2) `watch_next` is now built from the sector's indicators plus the indicators for tiers that still have gaps plus one always-on regulator signal (`sector_watch_indicators` / `tier_watch_indicators` in the taxonomy), de-duplicated — no longer a static dump; (3) `claim_audit` appends an `unsupported` blocker claim when the caller named blockers and an `assumption_only` claim when assumptions were supplied. Four new `source_type` enum values added additively to the request schema (`grid_connection_and_offtake_evidence`, `land_or_site_control_evidence`, `ip_ownership_and_licensing_evidence`, `export_control_classification_note`) with curated evidence-gap copy. No response-schema shape change; `gate_decision` / `readiness_label` enums unchanged (committee_review_ready and launch_commitment_ready still both route to `escalate_before_signature`, which the frozen enum constrains). Dual-copy `data/` schema + taxonomy updated in sync. New contract + service tests (sector gaps differentiate, watch-next tailored, claim audit reflects inputs, sector evidence caps launch commitment, every sector enum value has a requirement list) and JS-parity worker tests; Python **324 passed**, worker suite **106/106** green. Demo page (`kazakhstan-market-entry-readiness.html` on the portfolio site) exposes the new sector evidence categories.

- **feat(worker): Cloudflare Worker JS parity + dedicated env for the Kazakhstan market-entry readiness gate (deploy-ready).** Companion to the in-repo worker (next entry), which gave it a Python service / HTTP / A2A surface but no published endpoint. The deployed A2A Worker (`deploy/cloudflare-worker/src/index.js`) now carries a JS port of `kazakhstan_market_entry_readiness` so the gate can run as its own `*.workers.dev` endpoint like the other four. Adds the profile constants/URLs, the staged source-requirement tier arrays + stage→tier map + commitment-stage set, the curated signature-tier evidence-gap copy, `marketEntryReadinessResult` (deterministic gate decision / readiness label / evidence gaps / claim audit / owner actions / watch-next, byte-matching the Python wording), the request shape guard + enum validation (`marketEntryEnumErrors` over sector / decision_stage / counterparty role / `supplied_sources[].source_type`), the agent-card profile block (`applyMarketEntryReadinessProfile`), and the dispatch wiring in `agentProfile` (new `market_entry_readiness` profile, host `kazakhstan-market-entry-readiness-a2a`), `applyAgentProfile`, and the `message/send` handler. A new `[env.kazakhstan-market-entry-readiness]` in `wrangler.toml` (`AGENT_PROFILE = "market_entry_readiness"`) — the `kazakhstan` profile key was already taken by the Middle Corridor gate, so a distinct key was required. `run_provenance` is intentionally omitted worker-side (the response schema makes it optional; same deferral as the other workers' worker-side provenance). 5 new worker tests (agent card exposes the skill; `message/send` returns `proceed_to_validation` / `validation_ready` on the golden; empty-evidence-at-commitment-stage `stop`; bad `source_type` enum rejected; non-market-entry shape rejected), worker suite **102/102** green. Worker JS + config + test only; no Python service, schema, or dual-copy path touched. **Activation:** `wrangler deploy --env kazakhstan-market-entry-readiness` — the one remaining step, run from an account with Cloudflare credentials; until then the endpoint is configured but not live.
- **feat(market-entry-readiness): promote the Kazakhstan market-entry pack from contract-only to a live in-repo vertical worker.** The schemas, source taxonomy, use-case doc, and contract example shipped earlier (#144–#147) but had no executable surface; this adds the layer that makes it callable like the other four workers. New `kazakhstan_market_entry_readiness` service function in `services.py` grades a market-entry file against the staged source-requirement taxonomy (`required_before_validation` → `_signature` → stage-relevant operational tier), returning a `gate_decision` (`proceed_to_validation` / `pause_for_evidence` / `escalate_before_signature` / `not_decision_ready` / `stop`), a `readiness_label`, evidence gaps with owner/next-action/decision-blocked, a claim audit, owner actions, watch-next indicators from the taxonomy, and mandatory `human_review_required` + `boundary_notice`. The gate decision is deterministic from coverage and `decision_stage`, never green-lights signature (that stays human review), and hardens to `stop` when a commitment-stage file arrives with no validation-tier evidence. Wired into the existing deployed surfaces: HTTP `POST /v1/market-entry/readiness` (+ listed in `/readyz`) and A2A profile `kazakhstan_market_entry_readiness` (capability + aliases, agent-card skill, supported-contracts list, params builder, artifact text, dispatch). Tests: `tests/test_market_entry_readiness_service.py` exercises a golden request (→ `proceed_to_validation` / `validation_ready`, schema-valid, signature-tier gaps surfaced), an empty-evidence-at-commitment-stage `stop` case, an invalid-request rejection, the HTTP route (200 + 400), `/readyz`, and the A2A dispatch + agent card; the prior static contract test is unchanged. Internal evidence triage only — not legal, compliance, customs, tax, financial, investment, insurance, sanctions, or launch-authorization advice. Additive, non-breaking; no schema change (request/response schemas already shipped), no new dual-copy files, ADR 0003 freeze intact. **No Cloudflare deploy in this change:** unlike `gulf-maritime-exposure`, this worker has no dedicated published Worker URL yet — it runs on the shared service / HTTP / A2A layer; a standalone `workers.dev` endpoint is a separate follow-up requiring `wrangler deploy`.
- **feat(reporting): deal-risk evidence-readiness memo renderer + `deal-report` CLI (md/html/pdf).** Additive, non-breaking. New `agenda_intelligence.reporting` module renders a Middle Corridor deal-risk response (the structured `middle_corridor_deal_risk` / live A2A worker contract) as a branded evidence-readiness memo — the deliverable behind the concierge offer. Markdown and self-contained, print-to-PDF-ready HTML carry no third-party dependencies; PDF uses `fpdf2`, declared as the optional `pdf` extra (`pip install agenda-intelligence-md[pdf]`) so the core package stays dependency-light. New `agenda-intelligence deal-report <response.json> --format md|html|pdf [--out FILE]` CLI subcommand. Reformat only: it surfaces the worker's own `operational_decision` / score / evidence gaps / risks / flags / watch-next verbatim, invents nothing, performs no factual-truth verification, and rides the `not_advice_notice` + human-review disclaimer on every artifact (brand verdict colours: proceed green, hold / conditions amber, escalate red). Contract test in `tests/test_deal_report.py` (md/html across the golden responses; pdf guarded by the optional extra). No schema, service, or worker surface touched; ADR 0003 freeze intact.
- **fix(cis): surface the OpenSanctions attribution only when upstream data was actually used.** The `cis_secondary_sanctions` service and the deployed Cloudflare Worker appended the CC-BY OpenSanctions attribution notice ("Sanctions list matches via OpenSanctions…") to `limitations` on every run where the upstream adapter returned an attribution block — including the `disabled` / `degraded` / zero-match paths, where `auto_fetched_sources` is empty and no upstream data was used. That contradicted the adjacent "live retrieval not enabled" note and could read as a sanctions-list match that never happened. Both implementations now gate the attribution on actual use (`auto_fetched_sources` non-empty / `autoFetched.length`): CC-BY attribution is only required when the upstream data is redistributed, so the disabled / zero-match output is now both honest and license-correct. Two tests that asserted the buggy behaviour (`tests/test_cis_secondary_sanctions_contract.py`, `deploy/cloudflare-worker/test/worker.test.js`) are converted to regression guards — degrade note present, attribution absent. Python suite + worker (97/97) green. **Live activation:** the worker fix reaches the live `cis-secondary-sanctions-a2a` endpoint only after `wrangler deploy --env cis-secondary-sanctions` (no deploy-on-merge); the Python package path (MCP / HTTP / local) is fixed immediately.

- **feat(middle-corridor): operational booking decision on the deal-risk response (logistics-facing).** Additive, non-breaking. `middle_corridor_deal_risk` now emits an `operational_decision` object — `{decision, applies_to, rationale}` where `decision` is one of `proceed` / `proceed_with_conditions` / `hold` / `escalate` — derived from the existing `decision_readiness_score` (40/70 bands), `risk_signal`, `triage_recommendation`, and `decision_stage`. It restates the existing triage as the booking verb a forwarder / ops reader needs (do we quote, hold, or escalate?) without changing the score, the signal, the triage recommendation, or any other field. Boundary preserved: triage routing only, never a hard reject (a compliance/legal call) — the gate stops at hold/escalate — and human review remains required. New optional object on `middle-corridor-deal-risk-response.schema.json` (and packaged copy under `src/agenda_intelligence/data/`); Cloudflare Worker JS parity in `dealRiskContractResponseForRequest` plus a human-readable summary line; a worked `operational_decision` added to the response schema's `examples` block; one golden + one off-enum failure contract test added in `tests/test_middle_corridor_contract.py`, plus one worker parity test. ADR 0003 freeze intact (response-family additive field, not a request/memo change). **Activation:** `wrangler deploy --env middle-corridor-deal-risk-gate` (no deploy workflow runs on merge; until then the live route keeps the prior output).

- **feat(worker): Middle Corridor worker parity for the route sanctions-exposure and customs-harmonization layers.** The deployed Cloudflare Worker (`middle-corridor-deal-risk-gate-a2a`) now emits `route_sanctions_exposure_indicators`, `customs_harmonization_indicators`, and the optional `route_sanctions_matched_segments` (with its `limitations` line) at the live `/message/send` endpoint, matching the Python service contract below. Substring presence-flagging on the route string only; per ADR 0015 not a sanctions determination, live screening, or customs/legal advice. Worker JS + two parity tests (96/96 green); no schema or service-layer change.
- **feat(middle-corridor): route-level sanctions-exposure and customs-harmonization screening layers.** Additive, non-breaking. `middle_corridor_deal_risk` now ships two standing checklists on every response — `route_sanctions_exposure_indicators` (Iran-transit legs and Russia Northern Corridor overlaps grounded in OFAC Iran/Russia programs, sanctioned Caspian operators, onward connections into a sanctions-relevant jurisdiction) and `customs_harmonization_indicators` (permitting clarity, harmonized digital-customs coverage via eTIR vs. unharmonized national permitting) — plus an optional `route_sanctions_matched_segments` populated when the declared route text names a flagged segment, which also adds one `limitations` line. Substring presence-flagging on the route string only; per ADR 0015 this is evidence-gap triage routed to human review, NOT a sanctions determination, live screening, or customs/legal advice. Three new optional fields added to `middle-corridor-deal-risk-response.schema.json` (and packaged copy); two contract tests added. Existing fields and the decision-readiness score unchanged.
- **fix(worker): `wrangler dev --local` startup — move `PROBE_PROMPT_CHAR_THRESHOLD` out of the entry-module exports.** Found during a 2026-06-12 usage-instrumentation debugging pass: `wrangler dev --env middle-corridor-deal-risk-gate --local` failed to start because current workerd treats every named export of the entry module as a worker entrypoint and rejects non-function exports (`Incorrect type for map entry 'PROBE_PROMPT_CHAR_THRESHOLD': the provided value is not of type 'function or ExportedHandler'`). The deployed runtime tolerates the export, so production was unaffected — only local dev was broken. The constant moves to `deploy/cloudflare-worker/src/usage_constants.js`; `src/index.js` imports it and drops it from its export block; `test/worker.test.js` imports it from the new module. Behavior identical, 94/94 worker tests green, `wrangler dev --local` starts and serves. Worker JS + test only; no schema, service, or contract surface touched.

- **docs(canon): market-entry-readiness contract surfaced in AGENTS.md and llms.txt.** Output of a 2026-06-10 repo test-and-review pass (full local CI gate, 94/94 Worker JS tests, live smoke of all five A2A agent cards plus a Middle Corridor `message/send` round-trip — all green). The one gap found was discoverability: the Kazakhstan market-entry readiness contract (shipped across #144–#147) was documented in README.md but absent from the two canon surfaces agents actually read — AGENTS.md (canonical project contract) and llms.txt (agent-readable index, dual-copied). An agent reading AGENTS.md could not learn the contract exists, and the "vertical worker MUST ship with a service function" rule made the contract-only state look like a violation rather than a recorded decision. AGENTS.md gains a **Contract-only pack (not a vertical worker yet)** entry under "Vertical workers inside this repo" stating exactly what ships (schemas, taxonomy, use-case, examples, static contract test) and what does not (no service function, HTTP route, A2A profile, or MCP tool), with the boundary that the MUST-ship checklist applies the day it gains a service function. llms.txt gains the matching contract-only block after the MCP worker tools (both dual-copy locations, byte-identical). Documentation only; no schema, service, worker, or test surface touched; ADR 0003 freeze intact.

- **feat(market-entry-readiness): counterparty-integrity and bank-onboarding evidence types (pain pass 3).** Third practitioner pain-discovery pass (2026-06-10): the taxonomy modelled who a counterparty *is* (registry extract, beneficial ownership) but not whether engaging them is *clean*, and it assumed banking without the onboarding friction that actually gates operations. Two cross-sector, pre-signature blockers a foreign parent routinely under-scopes: (1) integrity / anti-corruption due diligence on distributors, agents, and government-facing intermediaries — under the FCPA (enforcement resumed mid-2025 after a pause) and the UK Bribery Act the foreign parent can carry liability for an intermediary's conduct, so a partner who touches customs, certification, or akimat without integrity DD is an unmanaged exposure; and (2) corporate bank-account / KYC onboarding — opening an account for a foreign-owned entity requires a full UBO pack (apostilled), source-of-funds and expected-turnover statements, and often physical presence, and until it clears the entity cannot pay suppliers or receive revenue. Adds two `source_type` enum values — `counterparty_integrity_due_diligence` and `bank_account_and_kyc_onboarding` — mapped into `required_before_signature`, plus two `watch_indicators`. Use-case minimum-evidence bullets and the contract example demonstrate both gaps. Presence-flagging and routing only — never a clearance, a fit-and-proper determination, or sanctions advice (that stays the CIS secondary-sanctions worker's contract); human review remains required. Schema + taxonomy dual-copied; `tests/test_market_entry_readiness_contract.py` extended with an integrity/banking enum-and-taxonomy guard. Additive, non-breaking; still a schema / source-taxonomy / use-case contract, not a deployed live worker; ADR 0003 freeze intact.
- **feat(market-entry-readiness): trademark / brand-protection and data-localization evidence types (pain pass 2).** Second practitioner pain-discovery pass (2026-06-10), surfaced by running a real brand-heavy distribution proposal through the contract: a foreign entrant plans heavy public brand promotion and customer/lead/app data capture, but the taxonomy had no evidence type for either intellectual-property protection or data-localization compliance — both commonly-missed, cross-sector, pre-public-launch blockers. Kazakhstan is a first-to-file trademark jurisdiction inside the EAEU regional system, and brand-squatting against foreign (notably Chinese) applicants has risen sharply, with most disputes surfacing within months of a brand's first promotion; separately, Kazakhstan personal-data localization can require citizen data to be stored in-country (including backups) and can apply even through a distributor without a local entity. Adds two `source_type` enum values — `trademark_or_brand_protection_filing` and `data_localization_and_privacy_note` — mapped into `required_before_showroom_or_public_launch` (both are needed before brand spend / data capture, not before signature), plus two `watch_indicators` (`third-party trademark filing or brand-squatting signal`, `personal-data localization or privacy rule change`). The use-case minimum-evidence list gains the matching bullets, and the contract example demonstrates both gaps. Presence-flagging and routing only — never an IP-clearance opinion or a data-compliance determination; human review remains required. Schema + taxonomy dual-copied; `tests/test_market_entry_readiness_contract.py` extended with an IP/data enum-and-taxonomy guard. Additive, non-breaking; still a schema / source-taxonomy / use-case contract, not a deployed live worker; ADR 0003 freeze intact.
- **feat(market-entry-readiness): cross-sector regulatory-setup evidence types + contract test + inline-example fix.** Output of a 2026-06-09 practitioner pain-discovery pass on the just-added Kazakhstan market-entry readiness contract (#144). The original `source_type` taxonomy leaned heavily on a mobility / EV go-to-market path (showroom, dealer, test-ride, battery, spare-parts) and under-covered the cross-sector regulatory-setup blockers a foreign company hits before commitment regardless of sector: permanent-establishment / tax-residency treatment (branches are treated as residents; the entry model can create a taxable presence), currency-control and profit-repatriation reporting (currency-contract registration and repatriation thresholds gate how money moves in and out), the foreign-worker quota and local-national employee ratio, local-content / procurement-localization (production-facility and pre-qualified-bidder requirements for government and quasi-government tenders), and special-economic-zone eligibility as a cost / hiring lever. Adds five `source_type` enum values — `permanent_establishment_or_tax_residency_assessment`, `currency_control_and_repatriation_note`, `work_permit_and_local_employment_quota_note` (mapped into `required_before_signature`), plus `local_content_or_procurement_localization_note` and `special_economic_zone_eligibility_note` (mapped into `helpful_context` / `supporting_sources`) — and four new `watch_indicators`. The use-case doc gains the matching minimum-evidence bullets, and the contract example request/response demonstrate the permanent-establishment and currency-control gaps concretely. Sanctions / secondary-sanctions exposure is deliberately **not** added here — that stays the CIS secondary-sanctions worker's contract (portfolio coherence). **Fixes** the use-case "Output shape" inline example, which was missing the schema-required `owner_actions` field, so an agent or practitioner copying it as a template would have emitted an invalid response. **Adds** `tests/test_market_entry_readiness_contract.py`: this contract-only worker (no service function yet) previously had zero CI schema-conformance coverage because `validate_public_examples.py` skips commercial fixture dirs — the new test validates the example and the inline-doc examples against the schemas, asserts the taxonomy stays a subset of the request enum, and guards the dual-copy sync (it is the check that would have caught the `owner_actions` bug). Schema + taxonomy dual-copied. Additive, non-breaking; still a schema / source-taxonomy / use-case contract, not a deployed live worker; ADR 0003 freeze intact (new v1 schema family, not a change to frozen schemas).
- **feat(worker): Cloudflare Worker JS parity for the Gulf price-cap attestation gap (deployed).** Closes the deferral from the preceding entry — ports the `price_cap_attestation_or_recordkeeping` handling to the deployed A2A Worker (`deploy/cloudflare-worker/src/index.js`) so the live `gulf-maritime-exposure-a2a` endpoint emits the same triage as the Python service. Adds the value to `GULF_SOURCE_TYPES` (the worker's `gulfEnumErrors` validation enum — without this the live route would reject a request supplying the new source type, the same enum-parity bug previously fixed for Middle Corridor); when `russia_oil_price_cap` is in `exposure_facets` and the attestation is not supplied, `gulfTopExposureDimensions` surfaces the per-loading attestation + itemized ancillary-cost recordkeeping gap and `watch_next` gains the price-cap attestation watch line, byte-identical to the Python wording. Not added to the worker readiness denominator (`GULF_MARITIME_HELPFUL_CONTEXT`), so `decision_readiness_score` is unchanged. 2 new worker tests (gap surfaces when facet present + attestation absent; supplying the attestation clears the gap and leaves the score unchanged), 94/94 worker tests green. Worker JS + test only; no Python service, schema, or dual-copy path touched. **Activation:** `wrangler deploy --env gulf-maritime-exposure` (deployed in this change).
- **feat(gulf_maritime_exposure): `price_cap_attestation_or_recordkeeping` evidence type + per-loading attestation gap surfacing.** Output of a 2026-06-08 practitioner pain-discovery pass against OFAC's Russian oil price-cap guidance (tiered attestation model, Dec 20 2023 update): a service provider must obtain a price-cap attestation from its counterparty *prior to each loading or lifting* and retain itemized ancillary-cost records — that attestation + recordkeeping process is the safe-harbor mechanism. The worker already scoped `russia_oil_price_cap` as an exposure facet but had no first-class evidence type for the attestation, no gap surfacing, and no watch indicator — a coverage hole in an existing facet that a technical evaluator inspecting the contract would notice. Adds `price_cap_attestation_or_recordkeeping` to the request `source_type` enum (dual-copied; the response schema does not constrain `source_type`, so it is untouched). When `russia_oil_price_cap` is in `exposure_facets` and that evidence is not supplied, `top_exposure_dimensions` surfaces `"per-loading price-cap attestation and itemized ancillary-cost recordkeeping not yet evidenced (OFAC tiered safe-harbor)"` and `watch_next` gains a `"price-cap attestation refusal, withdrawal, or itemized ancillary-cost gap"` line. Presence-flagging routed to human review only — never a determination that the cap was met or breached, and not a safe-harbor opinion. **Deliberately NOT added to `required_before_go` / `must_check`** (added to taxonomy `supporting_sources` / `helpful_context`), so the `decision_readiness_score` denominator and ADR 0003 comparability are preserved — a contract test asserts that supplying the attestation clears the gap note without moving the score. Schema + taxonomy dual-copied. 2 new contract tests (gap surfaces when facet present + attestation absent; supplying the attestation clears the gap and leaves the score unchanged). Additive, non-breaking; ADR 0003 freeze intact. **Deferred:** Cloudflare Worker JS parity for the live `gulf-maritime-exposure-a2a` endpoint — until a follow-up `wrangler deploy`, the live route keeps the prior output.
- **feat(mcp): all-errors validation, `get_schema` discovery tool, and `gulf_maritime_exposure` as the fourth MCP worker.** Output of an agent-consumer self-review of the live MCP surface (the channel an agent-integrator actually calls). Three fixes. (1) **All schema errors at once** — `validate_brief` / `validate_evidence` / `validate_memo` (and the vertical-worker request validation) returned only the *first* missing required field, forcing an agent constructing a payload to round-trip once per field. The three near-duplicate validators (`mcp_server._validate_json`, `services._validate_json`, `product._validate`) now use `jsonschema`'s `validator_for(schema).iter_errors(...)`, deterministically sorted by `(path, message)`, so `errors` lists every violation in one call. ImportError / schema-load-failure tri-state (`valid: None` with the reason in `errors`) is preserved exactly. (2) **`get_schema` MCP tool** (12th validation-layer tool) — closes the discover → construct → validate loop on the MCP surface: an agent could discover protocols/lenses/signals but not the *contracts* it had to satisfy. Returns a packaged JSON Schema by manifest key (`agenda_brief`), file name, or bare stem; omit `name` to list available schemas. The registry is read from `agent-manifest.json` (ADR 0013 authoritative schema registry), so it never drifts from `schemas/v1/`. Contract discovery only — does not validate, template, or verify truth. (3) **`gulf_maritime_exposure` as an MCP tool** — the fourth vertical worker was live on HTTP/A2A and present in `services.py` but was the one worker not exposed over stdio MCP; this brings worker parity on the MCP surface to 4/4. Manifest `mcp.tools` updated in both dual-copy locations from `TOOLS` directly (ADR 0012 parity invariant holds; names match code order, `input_schema` byte-equal). Tests: gulf golden round-trip + worker-list assertion extended, `get_schema` (named/aliases/list/unknown + stdio call), multi-error validation. MCP.md + counts (19→21 tools) updated. Python + docs only; no `schemas/v1/` contract, request/memo shape, or Worker JS touched; ADR 0003 freeze intact. **Deliberately not added:** a `list_workers` catalog tool — the workers are already first-class MCP tools (discoverable via `tools/list`) and their HTTP routes / A2A profiles / endpoints live authoritatively in `a2a_adapter.py` / `http_api.py`; a separate catalog would duplicate that and invite drift. **Activation:** the installed `agenda-intelligence-mcp` server must be reinstalled/redeployed to surface these (a stale install predating this change exposes 16 tools without the workers).
- **docs(examples/kazakhstan-middle-corridor): contract example fixtures for `counterparty.specified_sectors[]` and `counterparty.date_of_formation` flagging.** Two new example pairs under `examples/kazakhstan-middle-corridor/contract/` — `pre_signature_escalate_named_sector.{request,response}.json` and `pre_signature_escalate_newly_formed.{request,response}.json` — generated end-to-end through the live `middle_corridor_deal_risk` service function so each `response` is byte-identical to what the contract emits today. The first shows a KZ-domiciled consignee with `specified_sectors: ["manufacturing", "technology"]` triggering `"counterparty operates in an OFAC-named sector under EO 14024"` in `top_risks` + matching `exposure_layers.foreign_sanctions_exposure_layer` + EO 14024 / EO 14114 `limitations` line; the second shows a KZ-domiciled consignee with `date_of_formation: "2023-08-12"` triggering `"counterparty newly formed in a transshipment-risk jurisdiction"` and the matching exposure-layer / limitations entries. Both score `escalate_before_signature` / `medium_high`. Existing fixture-validation tests (`test_middle_corridor_request_fixtures_validate`, `test_middle_corridor_response_fixtures_validate`, `..._include_not_advice_notice`, `..._include_readiness_score`) auto-discover and exercise the new files, 31/31 green locally. Documentation / discoverability only; no schema, service, worker, or contract surface touched.
- **feat(worker): Cloudflare Worker JS parity for `counterparty.specified_sectors[]` and `counterparty.date_of_formation` OFAC FFI sanctions-exposure flagging.** Companion to the Python feature on the same fields (preceding entry). The deployed A2A Worker's JS port of `middle_corridor_deal_risk` did not know about the two new optional `counterparty` fields, so a caller hitting the live `message/send` endpoint with `specified_sectors[]` or `date_of_formation` got back the previous response without the new flags. Mirrors the Python service: adds `NAMED_SECTORS` (the OFAC FAQ 1148 / 1151 five sectors), `NEWLY_FORMED_COUNTERPARTY_CUTOFF` (`2022-02-24`), and `TRANSSHIPMENT_HUB_JURISDICTIONS` (Kazakhstan, China, Hong Kong, Cyprus) constants; adds `namedSectorCounterparties()` and `newlyFormedCounterparties()` helpers; extends `topRisksForStructuredRequest`, `exposureLayersForStructuredRequest`, and `dealRiskContractResponseForRequest` to surface `"counterparty operates in an OFAC-named sector under EO 14024"` and `"counterparty newly formed in a transshipment-risk jurisdiction"` in `top_risks` + matching `foreign_sanctions_exposure_layer` entries + matching `limitations` lines, byte-identical to the Python output. Worker JS only; no Python service, schema, dual-copy path, or `decision_readiness_score` / `risk_signal` / triage / counterparty-readiness touched. 4 new worker tests assert sector positive + sector-`other`-only negative + newly-formed positive + pre-2022 formation negative on structured `dealRiskContractResponseForRequest` round-trips, all matching the Python contract-test names and string assertions. Activation: `wrangler deploy --env middle-corridor-deal-risk-gate` (no deploy workflow runs on merge; until then the live route keeps the prior strings).
- **feat(middle_corridor_deal_risk): optional `counterparty.specified_sectors[]` and `counterparty.date_of_formation` for OFAC FFI sanctions-exposure flagging.** Two non-breaking additive optional fields on the request and response `counterparty` `$defs` (and dual-copied under `src/agenda_intelligence/data/schemas/v1/`), drawn from the OFAC Sanctions Advisory "Updated Guidance for Foreign Financial Institutions on OFAC Sanctions Authorities Targeting Support to Russia's Military-Industrial Base" (June 12, 2024) and OFAC FAQs 1148 / 1151. `specified_sectors[]` enumerates the five named sectors of the Russian Federation economy (`technology`, `defense_and_related_materiel`, `construction`, `aerospace`, `manufacturing`) plus an `other` value; a counterparty operating in any non-`other` value triggers a new `top_risks` entry `"counterparty operates in an OFAC-named sector under EO 14024"`, a matching `exposure_layers.foreign_sanctions_exposure_layer` line, and a `limitations` entry citing EO 14024 as amended by EO 14114. `date_of_formation` (ISO 8601 date); when on or after the 2022-02-24 cutoff (Russia's further invasion of Ukraine) **and** the counterparty's jurisdiction matches `HIGH_RISK_JURISDICTIONS`, `CIRCUMVENTION_WATCH_JURISDICTIONS`, or the new `TRANSSHIPMENT_HUB_JURISDICTIONS` list (Kazakhstan, China, Hong Kong, Cyprus — drawn from U.S. Treasury and BIS designations of third-country transshipment hubs), the response surfaces `"counterparty newly formed in a transshipment-risk jurisdiction"` mirroring the OFAC advisory's `"EXAMPLE OF HIGHER RISK CUSTOMER: A microelectronics exporter formed in March 2022 located in a high-risk jurisdiction"` red flag. Both are presence flags routed to human review — never a sanctions determination, never an end-use ruling. Neither field changes `decision_readiness_score` / `risk_signal` / `triage_recommendation`; neither alters existing high-risk / circumvention-watch flagging. Touches: request + response schemas + dual-copies, two new helpers (`_named_sector_counterparties`, `_newly_formed_counterparties`), extended signatures of `_middle_corridor_top_risks` and `_middle_corridor_exposure_layers`, 4 new contract tests (sector positive + sector-`other`-only negative + newly-formed positive + pre-2022 formation negative), and a use-case doc paragraph. ADR 0003 v1.0.x freeze intact — fields are optional and additive. **Deferred:** Cloudflare Worker JS parity for the live `message/send` endpoint, following the deferred-deploy pattern used for Caspian capacity language and `run_provenance`; until that ships the live route does not surface the new flags.
- **docs(use-cases/kazakhstan-middle-corridor): sync sample `top_risks` / `watch_next` to the new Caspian capacity / draft language.** The use-case doc's "Output shape" example block still carried the pre-fix strings (`"Caspian chokepoint dependency"` in `top_risks`, no Caspian-capacity item in `watch_next`), so the public-facing illustration disagreed with what the Python service and the deployed Worker now emit. Updates the example to `"Caspian crossing capacity and draft exposure"` and inserts `"Caspian ferry-slot, tonnage, or draft notice"` into the sample `watch_next` array, matching the now-live output. Docs only; no code, schema, or contract touched.
- **fix(worker): Cloudflare Worker JS parity for the Caspian capacity / draft language fix.** Companion to the Python text fix on the same templates (preceding entry). The deployed A2A Worker's JS port of `middle_corridor_deal_risk` carried the same generic strings — `topRisksForStructuredRequest` set `"Caspian chokepoint dependency"` and the `watch_next` template named only `"port delays or operator notices"` — so a caller hitting the live `message/send` endpoint still got the boilerplate wording after the Python service was fixed. Replaces the top-risk string with `"Caspian crossing capacity and draft exposure"` and inserts `"Caspian ferry-slot, tonnage, or draft notice"` into the Worker `watch_next` template, matching the Python output. Worker JS only; no Python service, schema, dual-copy path, or `decision_readiness_score` / `risk_signal` / triage touched. 1 new worker test asserts both strings on a structured `message/send` round-trip. Activation: `wrangler deploy --env middle-corridor-deal-risk-gate` (no deploy workflow runs on merge; until then the live route keeps the prior strings).
- **fix(middle_corridor_deal_risk): surface practitioner-named Caspian capacity language in `top_risks` and `watch_next`.** Output of a 2026-06-07 pain-discovery pass against a LinkedIn write-up of a Trans-Caspian Corridor practitioner discussion (CPCS / TRANSEXPEDITION / BBM Logistics / GreenLine / TransConsulting / Hegelmann / TURKSIB Magistral). Practitioners name three concrete Caspian failure modes — ferry-slot scarcity, ferry tonnage shortage, climate-driven sea-level / draft decline — that the worker already accepts as `port_operator_notice` / `rail_capacity_or_border_wait_source` evidence and triages under a generic "Caspian chokepoint dependency" risk and "port delays or operator notices" watch item. Generic wording did not echo the practitioner vocabulary back, so the output read as boilerplate rather than relevant. Replaces `"Caspian chokepoint dependency"` with `"Caspian crossing capacity and draft exposure"` in the hardcoded `top_risks` template and inserts `"Caspian ferry-slot, tonnage, or draft notice"` into `watch_next`. No schema change, no new field, no change to `decision_readiness_score` / `risk_signal` / triage / counterparty-readiness; two contract example fixtures + schema examples (dual-copied) updated to match the new output strings. Text-only relevance fix; ADR 0003 freeze intact.
- **feat(middle_corridor_deal_risk): deterministic `run_provenance` content-provenance stamp on responses (ADR 0018).** As generation gets cheaper, the scarce layer is verifiability of process, not the analysis text. The response was evidence-rich but did not record *which contract produced it from which input*, so a downstream reviewer (compliance committee, correspondent bank, auditor) handed the artifact could not confirm it is reproducible. New optional `run_provenance` object on `middle-corridor-deal-risk-response.schema.json` (dual-copied), emitted by a shared service-layer helper: `contract_version` (the `agenda_intelligence` package / ruleset version), `schema_id` (the response schema `$id`), and `input_digest` (`sha256:` over the canonicalized request JSON — UTF-8, keys sorted, no insignificant whitespace, so the same input + same contract reproduces the same digest). Digest is over the **request** (the reproducible relation "this output came from this exact input under this ruleset"), not the response. Deliberately carries **no timestamp** — wall-clock time is a transport concern (the A2A JWS envelope already timestamps, ADR 0017); the stamp stays purely deterministic so it is reproducible. Reproducibility / traceability only — explicitly not a signature of authenticity (that is the JWS transport layer), and not a factuality, clearance, or compliance attestation; the non-advice and human-review boundaries are unchanged. No change to `decision_readiness_score` / `risk_signal` / routing. Additive, optional → ships in a minor version under the ADR 0003 freeze (new optional field; existing responses and callers remain valid). 2 new contract tests (stamp emitted + schema-valid with correct version / schema_id / digest shape; digest is deterministic for the same request and changes when the input changes). **Deferred** (each its own change, recorded in ADR 0018): Cloudflare Worker JS parity for the live endpoint (the JS port must implement the same canonicalization to reproduce byte-identical digests, not a bare `JSON.stringify`), and extending `run_provenance` to the other three vertical workers via the same helper.
- **fix(worker): accept the four newer EDD source types on the live Middle Corridor A2A surface (enum parity).** The deployed Cloudflare Worker's `MC_SOURCE_TYPES` enum (used by `middleCorridorEnumErrors` to validate `dated_sources[].source_type`) was narrower than the Python `middle-corridor-deal-risk-request.schema.json`: it omitted `end_user_or_reexport_evidence`, `source_of_funds_or_wealth_evidence`, `pep_screening_evidence`, and `business_substance_evidence`. The response-side checklist logic (`reexport_control_indicators`, `source_of_funds_indicators`, `pep_screening_indicators`, `front_company_indicators`) and constants were already ported and surface correctly when evidence is *absent* — but a structured `message/send` request that *supplied* one of these types to mark the evidence present was rejected with an off-enum error before reaching the contract builder, so a caller could not suppress a checklist or present that evidence on the live endpoint. Adds the four values to the worker enum (now matching the schema). No change to `decision_readiness_score` / `risk_signal` (these types remain outside `required_before_go`), and the Python service / schemas were already correct and are untouched. 1 new test exercises the full `handleJsonRpc` enum-validation path (the existing omit-when-supplied tests call the builder directly and bypassed it): supplying all four types is accepted (`TASK_STATE_COMPLETED`, not invalid) and each corresponding checklist is omitted. Activation: `wrangler deploy --env middle-corridor-deal-risk-gate` (no deploy workflow runs on merge). Worker JS + test only; no Python, schema, or dual-copy path touched.
- **fix(services, http, product): distinguish "could not validate" from "invalid", and label keyless `analyze` as host-completion.** Two robustness fixes on error/edge paths; no success-path contract change. (1) `_validate_json`'s missing-jsonschema branch returned the reason under `error` (singular) while every caller read `errors` (plural), so a validation-infrastructure failure surfaced as `valid: False, errors: []` — indistinguishable from "invalid request, no reason given", and the vertical-worker wrappers collapsed `valid is None` into `False`. The branch now uses `errors`; a new `_validation_failure` helper makes the four vertical workers (`middle_corridor_deal_risk`, `agentic_interaction_trust`, `cis_secondary_sanctions_exposure`, `gulf_maritime_exposure`) and `audit_claims` propagate the tri-state (`True` / `False` / `None`) with the reason always in `errors`; response-side validation stops `bool()`-collapsing `None` to `False`. The HTTP shell now maps validation-unavailable (`valid is None`, a server fault) to **500**, keeping schema-invalid requests at **400**. (2) `analyze` now returns a `mode` field — `"host_completion"` when no model was invoked (ANTHROPIC_API_KEY unset / SDK absent; the caller completes from `system_prompt`) and `"server_completed"` when the model ran here — and the keyless skeleton's `memo_errors` message states plainly this is expected, not a failure. Python-only; no schema file, request/memo contract, dual-copy path, or Worker JS touched (the JS Worker does not use jsonschema). 9 new tests (tri-state helper + infra-reason surfacing + worker validation-unavailable; HTTP 500-vs-400 mapping; analyze `mode` both branches). Additive, non-breaking; ADR 0003 freeze intact.
- **docs: surface all live vertical-worker A2A endpoints in README + sync worker count.** All four vertical workers (Middle Corridor Deal Risk Gate, CIS Secondary-Sanctions Exposure, Agentic Interaction Trust Gate, Gulf Maritime Exposure) plus the general-triage wrapper are deployed and live on Cloudflare Workers, each serving its own profile agent-card; the README live-wrapper block listed only two. Adds the CIS / Agentic / Gulf live endpoints and their Agenstry listings to the live block, updates the intro inventory ("three" -> "four vertical workers"), and corrects the Status table deployment count (2 -> 5 workers). Also updates AGENTS.md (Gulf Worker JS parity is shipped + endpoint live) and llms.txt (adds `gulf_maritime_exposure` to the worker list). Docs only; no code, schema, or contract change.

- **feat(middle_corridor_deal_risk): `front_company_indicators` business-substance checklist + `business_substance_evidence` source type.** Closes a gap surfaced in a 2026-06-04 practitioner pain-discovery pass against the EU Sanctions Helpdesk red-flags guidance: the counterparty-legitimacy / front-company cluster (recently established or no business background, little or no web presence, addresses shared with multiple companies, goods that do not fit the line of business, contact only via an intermediary with broad power of attorney) was the one red-flag cluster the worker did not represent — the ownership *chain* and shell/layered-structure facets live on the `cis_secondary_sanctions` worker, but the Middle Corridor counterparty-substance signals did not. Same non-breaking pattern as `pep_screening_indicators` / `source_of_funds_indicators` (ADR 0015): new `business_substance_evidence` value added to the request + response `source_type` enums and the taxonomy `helpful_context` / `supporting_sources` (+ a `business substance or front-company concern` watch indicator); when that evidence is not supplied, the response surfaces an optional `front_company_indicators` checklist routed to human review — never a shell-company or ownership determination. **Deliberately NOT added to `required_before_go` / `must_check`**, preserving the `decision_readiness_score` denominator and ADR 0003 score comparability (a contract test asserts supplying the new source does not move the score). Worker JS kept in parity. Schemas + taxonomy dual-copied. Use-case doc updated. 4 new contract tests (Python + Worker: checklist surfaced + boundary wording; omitted + score-unchanged when supplied). Additive, non-breaking.
- **docs(glossary): anchor the attribution/citation/quotation vocabulary to the external literature.** Adds a glossary section mapping the portfolio's evidence mechanisms onto the unified taxonomy in a 2025 survey of evidence-based text generation with LLMs (arXiv:2508.15396): quotation → `verify-quotes` / `supporting_quotes`, citation → `evidence_ids`, attribution → `audit-claims` + `evidence_mode`. States which of the survey's seven evaluation dimensions the toolkit addresses (Attribution, Citation, Preservation) versus deliberately does not (Correctness = factuality; Retrieval / Relevance not scored), and places the runtime as post-hoc / in-context in the survey's timing scheme (with the `cis_secondary_sanctions` per-profile retrieval exception, ADR 0014). Restates the existing faithfulness-not-factuality boundary in field-standard vocabulary — no behavior, schema, or contract change. Docs only.
- **feat(verify-quotes): harvest span-level `supporting_quotes` and check them against source text.** Completes the deferred half of the span-grounding work: `verify_quotes` (MCP tool + `verify-quotes` CLI) now accepts an evidence-audit-shaped doc, not just an evidence pack. It harvests each `claims[].supporting_quotes` entry, resolves source text by the entry's `evidence_id` (caller-supplied `texts` map for the MCP tool; `--texts-dir` file or `--fetch` for the CLI, reusing the evidence item's `url`), and reports `present` / `absent` / `missing_source_text` for the span — each span result carries the originating `claim_id`. Summary gains `from_supporting_quotes` (count of span-derived checks). Evidence-pack `sources` / `evidence` items with a `quote` are still checked exactly as before (items without a `quote` are skipped, so an audit doc's `evidence[]` does not double-count). This closes the document→span faithfulness check end to end: `audit-claims` validates the structural link, `verify-quotes` checks the span text is actually present. Still presence-only — no factual-truth verification, no source-reputation scoring, no live discovery (CLI `--fetch` retrieves only already-specified `url`s). Backward-compatible (existing packs have no `claims`, so harvesting yields nothing); the CLI's empty-input guard now also accepts a `claims`-only doc. stdio tool description + `pack_json` schema hint updated. 2 new tests (MCP: 2 spans on one claim → 1 present + 1 absent, `from_supporting_quotes`=2, `claim_id` on every result; CLI: audit doc + `--texts-dir` → present span carries `claim_id`). Tool wiring + docs only; no schema-file, request/memo contract, or dual-copy path touched.
- **feat(evidence-audit): optional span-level `supporting_quotes` grounding on claims.** The claim→evidence link in `evidence-audit.schema.json` was document-level only: a claim cited `evidence_ids` but recorded no which-span-backs-it. Following the fine-grained-grounded-citation pattern (cf. FRONT, arXiv:2408.04568), each claim may now carry an optional `supporting_quotes` array of `{evidence_id, quote}` entries that name the exact span in cited evidence backing the claim. `audit_claims` validates this structurally only — it adds `grounded_claim_count` and a `span_orphans` list (flagging any `supporting_quote.evidence_id` not among that claim's `evidence_ids`, distinguishing "not in claim.evidence_ids" from "not in evidence"), mirroring the existing `orphan_evidence_refs` signal. A span orphan is a summary signal, not a schema error — the audit stays `valid`. The structural layer deliberately does NOT check that the quote text appears in the source (that is `verify-quotes`' job) and neither verifies factual truth; this raises the *faithfulness* check from document to span granularity, not factuality. Additive, non-breaking; ADR 0003 freeze intact (new optional field, no change to existing fields). Schema dual-copied to package data. 2 new contract tests (clean grounding → `grounded_claim_count` + empty `span_orphans`; orphan span → flagged, audit still valid). **Deferred:** wiring `verify-quotes` to harvest `supporting_quotes` and check the span text against source — a separate follow-up.
- **feat(worker): Cloudflare Worker JS parity for `gulf_maritime_exposure`.** Ports the fourth vertical worker to the deployed A2A Worker (the surface listings point to), so the live endpoint emits the same triage as the Python service. Adds the `gulf_maritime_exposure` profile detection (`AGENT_PROFILE` / `gulf-maritime-exposure-a2a` host), `applyGulfMaritimeProfile` agent card (skill, description, schema/taxonomy URLs, boundaries, commercial positioning), structured request extraction + enum validation, the JS port of the service logic (`gulfMaritimeExposureResult` and helpers — readiness, exposure signal, triage, top dimensions, chokepoint disruption watch — mirroring the Python exactly), `a2aResultForGulfMaritimeExposure`, and the `message/send` dispatch branch. New `wrangler.toml` env `gulf-maritime-exposure`. 3 new worker tests (card exposes gulf skill; message/send escalates before fixture with high signal — Python parity; non-gulf shape rejected). Worker JS + wrangler + tests only; no Python service, schema, or dual-copy path touched. Activation: `wrangler deploy --env gulf-maritime-exposure` (no deploy workflow runs on merge; the env was subsequently deployed and the endpoint is live).

- **feat(gulf_maritime_exposure): new vertical worker — contract core (Python).** Fourth vertical worker, built on the same service layer and evidence-discipline pattern as `middle_corridor_deal_risk` / `cis_secondary_sanctions`. Triages maritime sanctions and chokepoint-disruption exposure for a vessel or voyage transiting the Strait of Hormuz, Persian/Arabian Gulf, Gulf of Oman, Bab-el-Mandeb, or Red Sea: caller supplies vessel/voyage/cargo/counterparties + exposure facets (Iran-oil, Russia price-cap, dark-fleet, STS transfer, flag-hopping, P&I gap, AIS manipulation, ownership/control, dual-use cargo, chokepoint disruption) + dated sources; the worker returns an evidence-sufficiency triage (`insufficient_information` / `escalate_before_fixture` / `escalate_before_voyage` / `not_decision_ready` / `ready_for_human_review`), exposure signal, decision-readiness score, evidence gaps, top exposure dimensions, a chokepoint-specific disruption watch, and mandatory human-review escalation. No live retrieval (caller-supplied evidence only); does not resolve vessel ownership or verify identity — explicit boundary, not advice. Ships the full worker per the AGENTS.md vertical-worker checklist: new `schemas/v1/gulf-maritime-exposure-request|response.schema.json` (dual-copied to package data), `source-requirements/gulf-maritime-exposure.json` (dual-copied), `services.gulf_maritime_exposure` + helpers, HTTP route `POST /v1/gulf-maritime/exposure`, A2A profile `gulf_maritime_exposure` (capability + aliases + card skill + dispatch + artifact text), `docs/use-cases/gulf-maritime-exposure.md`, `examples/gulf-maritime-exposure/contract/` request+response fixtures, and an `examples/a2a/` round-trip fixture. Tests: 6 contract tests (taxonomy/constant parity, schema-example conformance, golden escalation with high signal, full-evidence routes to review, invalid-request rejection, no clearance wording) + an A2A round-trip case + updated capability-list assertions. No live retrieval (caller-supplied evidence only); does not resolve vessel ownership or verify identity — explicit boundary, not advice. Additive, non-breaking; ADR 0003 freeze intact (new schema family, not a change to frozen schemas). **Deferred:** Cloudflare Worker JS parity + a `wrangler` env for the deployed A2A endpoint (deploy-time follow-up; the Python service / HTTP / A2A surfaces are live in-package). Built as a portfolio / topical artifact — no paying customers, no pilots; demand-gated for go-to-market.

- **docs(middle-corridor): reposition as a pre-screening evidence triage layer.** Output of a 2026-06-02 competitive scan: the funded landscape splits into data/network-intelligence platforms and real-time screening engines/APIs, both of which own ground the worker cannot (proprietary lists, ownership graphs, name-matching, live retrieval). Repositions the worker — as a complement that sits *before* those tools, surfacing which due-diligence documents are still missing so the dossier is complete before the expensive screening/data step, rather than implicitly competing with them head-to-head. Agent-card `commercial_positioning` (Kazakhstan profile) and the use-case-doc proposition now lead with this framing and state plainly that it performs no screening, name-matching, or data retrieval and holds no lists or graph. Deliberately phrased at the category level — no competitor brand names are hardcoded into public card/repo text. Positioning text only; no schema, service, request/response contract, or score change. Live agent-card text updates on the next worker deploy.
- **feat(middle_corridor_deal_risk): `pep_screening_indicators` PEP checklist + `pep_screening_evidence` source type.** Closes the last "easy" gap from the 2026-06-02 practitioner-guidance field-map: politically-exposed-person (PEP) screening is a core FATF Recommendation 12 / 22 EDD element the worker did not represent. Modeled as an evidence gap, not a presence-flag — the worker cannot and must not determine PEP status itself (that would be a fabricated determination per the honesty rules), so it surfaces a checklist of what to screen, routed to human review. Same non-breaking pattern as `source_of_funds_indicators` / `reexport_control_indicators` / `vessel_due_diligence_indicators` (ADR 0015): new `pep_screening_evidence` value in the request + response `source_type` enums and the taxonomy `helpful_context` / `supporting_sources` (+ a `PEP status or political-exposure change` watch indicator); when that evidence is not supplied, the response surfaces an optional `pep_screening_indicators` checklist (counterparty + beneficial-owner screening, family / close associates, senior-management approval, enhanced SOF/SOW, ongoing monitoring). **Deliberately NOT added to `required_before_go` / `must_check`**, preserving the `decision_readiness_score` denominator and ADR 0003 score comparability (a contract test asserts supplying the new source does not move the score). Worker JS kept in parity. Schemas + taxonomy dual-copied. Use-case doc updated. 4 new contract tests (Python + Worker). Additive, non-breaking.
- **feat(middle_corridor_deal_risk): `source_of_funds_indicators` SOF/SOW checklist + `source_of_funds_or_wealth_evidence` source type.** Closes the next gap from the 2026-06-02 practitioner-guidance field-map: source-of-funds and source-of-wealth (SOF/SOW) is a core FATF Recommendation 10 EDD element (transaction-fund evidence, wealth origin, profile/size consistency, payer match) the worker did not represent. Same non-breaking pattern as `reexport_control_indicators` / `vessel_due_diligence_indicators` (ADR 0015): new `source_of_funds_or_wealth_evidence` value added to the request + response `source_type` enums and the taxonomy `helpful_context` / `supporting_sources` (+ a `source of funds or payer change` watch indicator); when that evidence is not supplied, the response surfaces an optional `source_of_funds_indicators` checklist routed to human review — never a financial determination or AML clearance. **Deliberately NOT added to `required_before_go` / `must_check`**, preserving the `decision_readiness_score` denominator and ADR 0003 score comparability (a contract test asserts supplying the new source does not move the score). Worker JS kept in parity. Schemas + taxonomy dual-copied. Use-case doc updated. 4 new contract tests (Python + Worker). Additive, non-breaking.
- **feat(middle_corridor_deal_risk): `reexport_control_indicators` end-use verification checklist + `end_user_or_reexport_evidence` source type.** Closes a gap surfaced in the 2026-06-02 practitioner-guidance field-map: end-user statements / certificates and no-re-export clause acceptance are a prescribed EDD/trade element (EU Sanctions Helpdesk red flags, US end-user diversion guidance) the worker did not represent as a first-class item — especially material for this re-export / diversion-exposed corridor. New `end_user_or_reexport_evidence` value added to the request + response `source_type` enums and to the taxonomy `helpful_context` / `supporting_sources` (with a new `end-user or onward-destination change` watch indicator). When that evidence is not supplied, the response surfaces an optional `reexport_control_indicators` checklist (signed end-user statement, no-re-export clause acceptance, end-use consistency, onward-destination disclosure, order-vs-destination match), mirroring the `vessel_due_diligence_indicators` pattern (ADR 0015): an evidence-gap checklist routed to human review, never an end-use or sanctions determination. **Deliberately NOT added to `required_before_go` / `must_check`**, so the `decision_readiness_score` denominator is unchanged and score comparability under the ADR 0003 freeze is preserved (a contract test asserts supplying the new source does not move the score). Worker JS kept in parity. Schemas + taxonomy dual-copied. Use-case doc updated. 4 new contract tests (Python: checklist surfaced + boundary + schema conformance; omitted + score-unchanged when supplied. Worker: same two parity assertions). Additive, non-breaking.
- **feat(middle_corridor_deal_risk): per-document `document_ledger` inside `counterparty_readiness`.** Driven by a 2026-06-02 practitioner-guidance pass (FATF / OFAC maritime guidance, ACAMS-style EDD checklists, EU Sanctions Helpdesk): EDD guidance prescribes tracking each required item with the date it was requested / received and maintaining a time-stamped chain of custody, so a flat `outstanding_documents` list under-serves the outward dossier view. New optional `document_ledger` sub-field (additive within the already-optional `counterparty_readiness` object; `schemas/v1/middle-corridor-deal-risk-response.schema.json`, dual-copied) emits one entry per required-before-go source type: `source_type`, `status` (`received` / `missing`), and `date_received` (the earliest supplied dated source of that type, when present). Derived from existing `dated_sources` — no new request fields, no change to `decision_readiness_score` / `risk_signal` / `status` counts. Status tracking only — explicitly not verification of any document's contents or authenticity; the boundary and human-review requirement are unchanged. Worker JS port kept in parity in the same change. Example artifact `07-counterparty-readiness.json` + use-case doc updated. 2 new contract tests (Python: ledger has one entry per required type, supplied source `received` with `date_received`, rest `missing` with none, received count reconciles with `supplied_count`, schema conformance; Worker: same parity assertions). Additive, non-breaking; ADR 0003 freeze intact.
- **feat(worker): Cloudflare Worker JS parity for `counterparty_readiness`.** Ports the outward dossier-completeness view (added to the Python service in the companion `counterparty_readiness` entry) to the deployed A2A Worker — the surface the Agenstry listing actually points to — so the live endpoint emits the same field. `counterpartyReadinessForStructuredRequest` mirrors the Python helper exactly: `status` derived from `dated_sources` / supplied required-before-go sources (`insufficient_information` / `incomplete` / `partial` / `complete_for_review`), `required_total` / `supplied_count` / `missing_count`, `outstanding_documents`, and the identical `presentable_note`. Wired into `dealRiskContractResponseForRequest`. Worker JS + tests only; no Python service, schema, or dual-copy path touched. 2 new worker tests (partial: counts reconcile + outstanding equals `minimum_sources_before_go` + clearance-wording boundary; complete_for_review when all required supplied). Activation: requires a manual `wrangler deploy --env middle-corridor-deal-risk-gate` (no deploy workflow runs on merge; until then the live route keeps the prior shape).
- **feat(middle_corridor_deal_risk): outward `counterparty_readiness` dossier-completeness view.** Driven by a 2026-06-02 market pain-discovery pass: the dominant stated pain for Kazakhstan / Central Asia counterparties under tightened enhanced due diligence is the *outward* one — "demonstrate to a bank / insurer who owns the business, who the partners are, where goods originate, how the deal is structured." The worker already encoded the right checklist (`required_before_go`) but framed its entire output for the *internal* analyst ("should we escalate before signature?"), so the second actor (the party that must present a dossier) got no first-class answer. New optional `counterparty_readiness` response field (`schemas/v1/middle-corridor-deal-risk-response.schema.json`, dual-copied) reframes the same evidence-gap picture outward: `status` (`insufficient_information` / `incomplete` / `partial` / `complete_for_review`), `required_total` / `supplied_count` / `missing_count`, `outstanding_documents` (the still-needed required-before-go source types), and a `presentable_note`. Derived entirely from the existing required-before-go contract and supplied sources — no new evidence logic, no change to `decision_readiness_score` / `risk_signal`. Additive, non-breaking; ADR 0003 freeze intact (optional field, minor surface). Dossier-completeness only — explicitly not clearance, approval, a sanctions determination, or compliance advice; human review still required. New example artifact `examples/kazakhstan-middle-corridor/07-counterparty-readiness.json` + README. 2 new contract tests (partial when sources missing: counts reconcile + outstanding equals `minimum_sources_before_go` + schema conformance; complete_for_review when all required supplied + clearance-wording boundary). Python service + schema + example only; the deployed Worker JS port is brought to parity in the companion worker entry above.
- **feat(worker): extend the per-profile Bearer access model to the Agentic Interaction Trust Gate (`agentic_interaction_trust`), off by default.** The Bearer enforcement path (`isProductionAuthorized`, 401 + `WWW-Authenticate: Bearer`, conditional `productionBearer` card requirement) was already profile-generic, but `productionAuthKey` resolved a secret only for the `kazakhstan` profile, so the trust gate's `message/send` route could never be gated. `productionAuthKey` now also reads the `AGENTIC_INTERACTION_TRUST_API_KEY` secret on the `agentic-interaction-trust` env; per-profile keys stay scoped (the Middle Corridor secret never gates the trust profile and vice-versa). When the secret is unset the route stays an open free demo and the card advertises no requirement (current state); `agent/card` discovery stays public regardless. Worker JS + tests only; no Python service, schema, or dual-copy path touched. The per-profile-key test was widened to assert both directions of scope and the new key resolution. Activation: `wrangler secret put AGENTIC_INTERACTION_TRUST_API_KEY --env agentic-interaction-trust` then `wrangler deploy --env agentic-interaction-trust` (no deploy workflow runs on merge; until then the route stays open).
- **feat(worker): explicit, enforceable Bearer access model for the Middle Corridor production route (`message/send`), off by default.** The deployed agent card previously declared only `optionalClientId` — an `X-Client-Id` header used purely for observability and abuse triage, never an access credential — and the worker enforced no authentication on any route. This graduates the security model to an explicit Bearer scheme without breaking the free live demo. The agent card now always *defines* `productionBearer` (`httpAuthSecurityScheme`, `scheme: bearer`) alongside `optionalClientId`, but only *advertises* it as a requirement (`security` / `securityRequirements` populated) when the operator actually configures the `MIDDLE_CORRIDOR_API_KEY` secret on the `middle-corridor-deal-risk-gate` env — so the card stays truthful in both states (open demo vs gated). Enforcement (`isProductionAuthorized`) mirrors the existing `STATS_TOKEN` precedent: `message/send` / `tasks/send` / `SendMessage` on the `kazakhstan` profile returns HTTP 401 with `WWW-Authenticate: Bearer` and a JSON-RPC `-32001` error when a key is set and the `Authorization: Bearer …` token is absent or wrong; when the secret is unset the route remains an open free demo (current state, no paying customers). `agent/card` discovery stays public regardless. Scoped to the `kazakhstan` profile only — the other three workers are unaffected (`productionAuthKey` returns `""` for them even if the env leaks). CORS `access-control-allow-headers` now includes `authorization`. Worker JS + tests only; no Python service, schema, or dual-copy path touched. 11 new worker tests (key resolution per profile, open-when-unset, Bearer match/mismatch, conditional card shape both states, 401 + `WWW-Authenticate`, success with valid Bearer, public `agent/card`). Activation: `wrangler secret put MIDDLE_CORRIDOR_API_KEY --env middle-corridor-deal-risk-gate` then `wrangler deploy --env middle-corridor-deal-risk-gate` (no deploy workflow runs on merge; until then the route stays open).

## [1.1.0] – 2026-06-01

- **feat(a2a): migrate the A2A wire contract to A2A protocol v1.0 (ADR 0017).** Both A2A surfaces — the Python `a2a_adapter` and the deployed Cloudflare Worker — advertised `protocolVersion: "1.0"` in the agent card while still emitting v0.3-shaped response bodies (`kind`-discriminated parts, lowercase `status.state`). The card claimed conformance the body did not meet — an honesty-rule violation and a strict-validator failure, and it left the Agenstry `protocol_version` (+10) score asserted rather than earned. This migrates the response wire to v1.0: parts are now member-discriminated with `mediaType` (`{"text": …, "mediaType": "text/markdown"}` / `{"data": …, "mediaType": "application/json"}`, no `kind`); `status.state` emits `TASK_STATE_COMPLETED` / `TASK_STATE_FAILED`; and the Python card gains `supportedInterfaces[]` (JSONRPC, `protocolVersion: "1.0"`) to match the Worker card already in production. **Inbound** request parsing is unchanged — it was already member-based, so both v0.3 and v1.0 request shapes are still accepted (back-compat); doc/example request payloads are updated to the v1.0 form. Scope is the A2A wire surface only: the `schemas/v1/` request/memo/product schemas and the ADR 0003 freeze are untouched, so this ships as a minor bump (1.0.2 → 1.1.0) with the breaking-for-A2A-consumers detail in ADR 0017. Worker and package versions realigned to 1.1.0 (the Worker had drifted to 1.0.1). Deferred (no consumer): streaming-event wrapper discrimination, cursor pagination, `google.rpc.Status` errors, OAuth/multi-tenancy/extension checks. Tests: 52 Python A2A/contract tests + 62 Worker tests updated and green. Activation: Worker change requires a manual `wrangler deploy` (no deploy workflow runs on merge).
- **feat(worker): Cloudflare Worker JS parity for the Middle Corridor jurisdiction flags, exposure decomposition, and vessel checklist.** The deployed A2A Worker (what the Agenstry listing points to) runs its own JS port of `middle_corridor_deal_risk`, which had drifted behind the Python service: it emitted neither the ADR 0015 high-risk jurisdiction flag, nor the re-export / circumvention-watch flag, nor `exposure_layers`, nor `vessel_due_diligence_indicators`. So features shipped in the Python package were not live on the A2A surface a practitioner would actually call. This ports all four to `deploy/cloudflare-worker/src/index.js` with identical wording and the same boundary discipline (presence-flagging routed to human review, never a determination; structural score / risk_signal unchanged): `HIGH_RISK_JURISDICTIONS`, `CIRCUMVENTION_WATCH_JURISDICTIONS` (high-risk takes precedence — no double-flag), `exposureLayersForStructuredRequest`, and the OFAC-grounded `VESSEL_DUE_DILIGENCE_INDICATORS` checklist surfaced when vessel/carrier history is missing. The Kazakhstan agent-card description and README are updated to reflect the now-live outputs, with the non-determination disclaimer. `dealRiskContractResponseForRequest` is exported for direct testing; 4 new worker tests (high-risk flag, circumvention/Armenia not-as-sanctioned, two-layer exposure + vessel checklist + clearance-wording boundary, vessel checklist omitted when history supplied). Worker JS + README only; no Python service, schema, or dual-copy path touched. Activation: requires a manual `wrangler deploy --env <middle-corridor>` (no deploy workflow runs on merge).
- **feat(worker): per-task cost accounting + budget thresholds in `/stats`.** The Worker tracked call counts, prompt chars, clients, and modules but had no per-task cost visibility. No LLM is called on the Worker path, so the only real per-request spend is paid live-retrieval upstreams; per ADR 0014 the OpenSanctions hosted API (€0.10/call) is the sole billable upstream (Watchman self-host and the deterministic triage path cost €0). Each usage event now records a `live_retrieval` block (`status`/`upstream`/`billable`/`cost_eur`); a call is billed only when a paid upstream actually returned data (`status: success`) — `degraded` (failed call) and `disabled` (no key) are not billed, conservative on the side of not over-reporting. `usageStats` aggregates `counters.billable_calls` and a new `cost` block: `estimated_cost_eur` (rounded), `billable_upstreams` breakdown, and a `budget` sub-block that compares daily spend against the optional plaintext var `USAGE_BUDGET_EUR_PER_DAY` and emits an `alert_level` of `none`/`50`/`75`/`90`. The Worker never blocks on budget — it only reports; when no cap is set, `budget.configured` is `false`. `scripts/stats.js` and the worker README document the new fields. 1 new contract test (6 billable + 1 degraded + 1 disabled → €0.60 est., plus 50% and 90% budget-tier assertions). Worker-only change; no schema, request/memo contract, or dual-copy path touched.
- **fix(mcp): constrain `category` tool args to the packaged enum + correct a stale slug.** The `source_plan` / `source_coverage` MCP tools took `category` as a free-form string, so a model could pass a hallucinated slug; the `source_plan` description also gave a non-existent example (`energy-markets` — the real slug is `energy`). `_tool_definitions()` now injects an `enum` of the packaged source-requirement category slugs onto any `category` property at the live `tools/list` surface. The enum is **computed** from the same data source as `list_source_categories` (the `source-requirements/` files), so it never drifts — no hardcoded list to keep in sync. The static `TOOLS` dict (mirrored into `agent-manifest.json` under the ADR 0012 parity invariant) stays a lighter catalog without the data-derived enum; the corrected description example is synced to both manifest copies. 1 new test asserts the live `category` enum equals the packaged slug set. No schema-file, request/memo contract, or transport change.
- **feat(middle_corridor_deal_risk): re-export / circumvention-watch jurisdiction flag + two-layer exposure decomposition.** Driven by a market pain-discovery pass against a public Kazakhstan trade-sanctions practitioner page whose stated pain is "a transaction can be fully compliant with Kazakhstani domestic law and simultaneously trigger [foreign] sanctions." Two additive, non-breaking changes (no request/memo contract change; ADR 0003 freeze intact). (1) A dogfood run surfaced that an intermediary counterparty in Armenia — a documented parallel-import / re-export corridor — was not flagged, because `HIGH_RISK_JURISDICTIONS` (ADR 0015) deliberately lists only comprehensively / sectorally sanctioned jurisdictions. Folding Armenia into that list would mislabel it as sanctioned. Instead, a separate, softer `CIRCUMVENTION_WATCH_JURISDICTIONS` set (Armenia, Georgia, Kyrgyzstan, Uzbekistan, Turkey, UAE + variants) now presence-flags re-export / diversion-watch counterparties via a distinct `top_risks` entry ("counterparty in a re-export / circumvention-watch jurisdiction") and a `limitations` line worded as "a diversion watch item for human review, not a sanctions determination." A high-risk-list match takes precedence (no double-flag). The structural `decision_readiness_score` / `risk_signal` are unchanged, per the ADR 0015 boundary. (2) New optional `exposure_layers` response field (`schemas/v1/middle-corridor-deal-risk-response.schema.json`, dual-copied) decomposes the risk picture into the two layers a practitioner separates: `domestic_legal_layer` (home-jurisdiction legal / licensing / documentation posture — explicitly not assessed by this product) and `foreign_sanctions_exposure_layer` (secondary / extraterritorial exposure signals). Structural decomposition only; never asserts clearance. 4 new contract tests (circumvention positive + high-risk-precedence + clean-jurisdiction negative control + exposure-layers separation & schema conformance).
- **feat(middle_corridor_deal_risk): vessel deceptive-shipping-practice (DSP) verification checklist.** Third market pain-discovery pass (marine / underwriter side: OFAC maritime guidance names the P&I insurer as responsible for spotting deceptive shipping practices). The worker handled the maritime leg only as a binary `vessel_or_carrier_history` source gap; it did not surface *what* a sanctions reviewer / underwriter actually checks. New optional `vessel_due_diligence_indicators` response field (`schemas/v1/middle-corridor-deal-risk-response.schema.json`, dual-copied) is populated when `vessel_or_carrier_history` is among the missing sources, with an OFAC-grounded checklist: AIS continuity / disablement, MMSI / name / IMO identity manipulation, certificate-of-origin integrity, undisclosed ship-to-ship transfers, and flag history. Additive, non-breaking; an evidence-gap checklist routed to human review — not vessel adjudication, AIS analysis, live retrieval, or insurance advice (ADR 0015 boundary). The structural `decision_readiness_score` / `risk_signal` are unchanged. 2 new contract tests (checklist surfaced when vessel history missing + schema conformance + boundary wording; negative control when vessel history supplied).

## [1.0.2] – 2026-05-31

Multi-surface presentation + deployment automation, plus a new vertical worker (`cis_secondary_sanctions`) and per-profile live retrieval (ADR 0014, with runtime activation deferred per the 2026-05-27 update). The v1.0 request/memo contract surface is unchanged; new schemas under `schemas/v1/` are additive per ADR 0003.

- **feat(mcp): expose the three vertical workers as MCP tools.** `middle_corridor_deal_risk`, `cis_secondary_sanctions_exposure`, and `agentic_interaction_trust` were callable over HTTP and A2A but not via the stdio MCP server, which exposed only the 11 validation + 5 product tools. They are now MCP tools (19 total), each taking a structured request matching its `schemas/v1/` contract and returning the same triage recommendation, decision-readiness score, evidence gaps, and mandatory human-review flag as the other surfaces. The local stdio transport runs the CIS worker with `allow_live_retrieval=False` (user-supplied evidence only). `agent-manifest.json` `mcp.tools` mirrors the new `TOOLS` entries (ADR 0012 invariant); dual-copied to packaged data; `llms.txt` tool list updated. 5 new contract tests (golden per worker + missing-argument tool error + tools/list coverage). No schema or request/memo contract change.

- **ADR 0015 + feat(middle_corridor_deal_risk): high-risk jurisdiction presence flag.** Third dogfood run (2026-05-28) on the flagship Deal Risk Gate: a `counterparties[].jurisdiction = "Russia"` on a dual-use cargo was not flagged — the most material fact in that case. ADR 0015 records the deliberate **structural-triage boundary**: workers may flag the *presence* of a known high-risk attribute (undisclosed UBO, sanctions-relevant jurisdiction) as an evidence/escalation signal routed to human review, but must NOT adjudicate substance or fold content into the structural `decision_readiness_score` / `risk_signal` (that would be a fabricated determination per the honesty rules + ADR 0006). This retroactively makes the 2026-05-28 cis UBO flag principled rather than ad-hoc. Implementation: `middle_corridor_deal_risk` now scans `counterparties[].jurisdiction` against a small explicitly-labeled sanctions-relevant list (Russia, Belarus, Iran, North Korea, Syria, Crimea, Donetsk, Luhansk + variants); a match surfaces a `top_risks` entry ("counterparty in a sanctions-relevant / high-risk jurisdiction") and a `limitations` line that names the counterparty and states explicitly it is "an escalation flag for human review, not a sanctions determination." The structural score is unchanged. 2 new contract tests (positive + negative control). Deferred under the same ADR principle (not done): free-text `notes` uncertainty scan, cargo dual-use detection. Explicitly rejected: content-aware scoring.

- **fix(cis_secondary_sanctions): surface undisclosed UBO + stop leaking internal env-var names.** Two dogfood findings (2026-05-28, running the worker on a synthetic CIS metals-trader case). (1) An undisclosed / unverified ultimate beneficial owner in the supplied `ownership_layers` is now detected (token scan: `undisclosed`, `unknown`, `nominee`, `tbd`, etc.) and surfaced both as an explicit `top_exposure_dimensions` entry ("undisclosed or unverified ultimate beneficial owner") and a `limitations` line ("the counterparty cannot be fully screened until the UBO is resolved"). Stays within the pre-compliance triage boundary — it flags an evidence gap, does not analyze ownership. (2) The user-facing `limitations` array no longer echoes internal env-var names (`OPENSANCTIONS_DISABLED` / `OPENSANCTIONS_API_KEY`); the degrade note is now derived from `live_retrieval_status` in user-safe language ("Live sanctions-list retrieval is not currently enabled / was unavailable; triage is based on user-supplied evidence only"). 3 new contract tests (UBO positive + negative control + env-leak guard). No schema or contract change; the response shape is unchanged (existing fields, new content only).

- **skill: temporal-premise check in `agenda-intelligence` SKILL.md.** Added a Core-rule instruction: check the question's temporal premise (asserted elapsed time / effective date / "since X" / "N-month effect") against the current date before analyzing, and re-anchor to the actual timeline rather than silently adopting the caller's date. Surfaced during dogfooding (2026-05-28): a memo prompt asserted a "12-month effect" when ~23 months had elapsed; the analysis caught it but the skill did not previously instruct it. New soft anchor `temporal-premise-check` in `evals/skill-improvement/anchors/agenda-intelligence.json` (12 anchors total, all present). Dual-copied to packaged data. No schema or contract change.

- **Structural skill-anchor gate for skill-improvement iterations** (`evals/skill-improvement/tools/eval_gate.py` + `evals/skill-improvement/anchors/agenda-intelligence.json`). Inspired by `microsoft/SkillOpt`'s validation-gate pattern but scoped to the actual failure mode of LLM-driven skill editing: silent removal of the discipline anchors the rubric depends on (e.g. dropping `Never imply live verification`, collapsing the signal-classification enum, or removing required default-output fields). The gate hard-rejects an edit when a critical anchor is missing, **before** any LLM-judge or human rubric scoring — exit 0 accept / 1 reject / 2 config error. 11 anchors declared, mapped onto the 7 rubric dimensions; each carries `severity` (`critical` / `soft`), `any_of` / `all_of` regex patterns, `rubric_dimensions`, and `rationale`. Current `skills/agenda-intelligence/SKILL.md` passes 11/11. 7 new pytest cases pin the contract: well-formed config, current skill passes, plus four regression scenarios (boundary anchor stripped, signal enum value removed, default output field renamed, signal-markers collapse-warning removed) — each must trigger reject. CI runs the gate via `tests/test_skill_anchors_gate.py`; drifts that slip past local iteration are blocked at merge time. Skill-improvement README updated with the gate workflow step.

- **Cloudflare Worker: JWS-signed agent cards + `/.well-known/jwks.json` (Agenstry conformance criterion `jws_signature`, +10).** Per Agenstry's 9-criterion conformance schema, the worker now serves agent cards with an ES256 detached JWS signature (RFC 7515 / 7797 / 8785). New module `deploy/cloudflare-worker/src/jws.js` provides JCS canonicalisation, base64url encoding, `signCardDetached()` and `publicJwkFromPrivate()` helpers built on Cloudflare WebCrypto (no external deps). New route `GET /.well-known/jwks.json` derives the public key from the operator-configured `AGENT_CARD_SIGNING_KEY` secret at request time and serves it as a JWKS document; `GET /.well-known/agent-card.json` calls `maybeSignCard()` which adds the compact detached JWS to `card.signature` (or returns the card unsigned when no key is configured — graceful default). `scripts/generate-signing-key.js` is a one-shot ES256 keypair generator that prints the private JWK + kid + activation steps. Worker README gains a "JWS-signed agent cards" section with the full setup flow and the verifier algorithm. Agent card also gains a `support` block (email, hours `Mon–Fri 09:00–18:00 Asia/Almaty`, timezone, response SLA — honest "best-effort, solo maintainer, not paid support"). 10 new tests cover JCS determinism, public-JWK derivation, JWKS document shape, sign+verify roundtrip, prior-signature stripping, no-op when key absent, and `support` block presence. Activation hand-off: `node scripts/generate-signing-key.js` → `wrangler secret put AGENT_CARD_SIGNING_KEY --env <each-env>` → `wrangler deploy --env <each-env>`. No code change required after that — `/jwks.json` and `card.signature` populate automatically.

- **ADR 0014 update (second 2026-05-27 entry) — Watchman added to the upstream whitelist as the free option.** Discovered via [github.com/topics/sanctions](https://github.com/topics/sanctions) that [`moov-io/watchman`](https://github.com/moov-io/watchman) is a production-grade open-source (Apache-2.0) self-hosted OFAC / EU / UK OFSI / UN sanctions search engine, used by Moov Financial. This invalidates the prior "self-host = toy-grade homebrew matching" argument. `LIVE_RETRIEVAL_PROFILES.cis_secondary_sanctions` now declares **two upstream options** (`upstream_options` array): Watchman (`activation_env_var: WATCHMAN_URL`, free) and OpenSanctions (`activation_env_var: OPENSANCTIONS_API_KEY`, paid €0.10/call). The runtime dispatcher picks the first active option (free before paid). New JS module `deploy/cloudflare-worker/src/upstream_watchman.js` mirrors the existing OpenSanctions adapter (thin client over `/v2/search`, KV cache with `watchman:` prefix on `AGENDA_USAGE`, AbortSignal timeout, graceful degrade, Apache-2.0 attribution). Agent cards and `/status.live_retrieval` now expose `active_upstream` (which option is currently wired, or `null`) and `upstream_options[*].active` (per-option flag), plus a per-option `cost_model` description. Python `a2a_adapter` mirrors the multi-option shape (new helpers `active_upstream_option(profile)` and `_is_upstream_option_active(option)`). Re-activation path: self-host watchman on free-tier container (~30 min, `moov/watchman` Docker image), `wrangler secret put WATCHMAN_URL --env cis-secondary-sanctions`, done — no code change, no redeploy. Tests: 6 new (3 Python: multi-option capability registration, env-var dispatch + Watchman-preferred-over-OpenSanctions ordering, agent-card active_upstream / per-option active fields; 3 JS: agent card with WATCHMAN_URL, dispatch preference when both env vars set, /status active_upstream flip).

- **ADR 0014 update (2026-05-27) — runtime activation deferred, capability preserved.** Discovered after the original ADR shipped that the OpenSanctions hosted API is paid (€0.10/call, pay-as-you-go) and not free as initially assumed. With zero confirmed buyers for `cis_secondary_sanctions` (`/stats` shows zero external non-probe traffic in the 7 days since shipping), per-call vendor fees are the classic sunk-cost trap. `LIVE_RETRIEVAL_PROFILES` in both `src/agenda_intelligence/a2a_adapter.py` and `deploy/cloudflare-worker/src/index.js` now declares **capability** rather than activation. New helper `is_live_retrieval_active(profile)` (Python) / `isLiveRetrievalActive(profile, env)` (JS) is env-derived and currently always returns `False` (no `OPENSANCTIONS_API_KEY` configured on any deployed worker). Agent cards and `/status` now expose `{capability_declared, active, ...}` instead of `{live_retrieval: True, ...}`; `boundaries.live_retrieval` reflects actual activation (currently `false` for `cis_secondary_sanctions`). When deferred, `/status.live_retrieval` includes a `deferral_note` explaining why. Re-activation is one `wrangler secret put OPENSANCTIONS_API_KEY` away — no schema change, no redeploy of code. Schemas, source-requirements, service function, A2A profile, deployed `cis-secondary-sanctions-a2a` Worker, and the SOURCE_POLICY upstream whitelist all remain in place. 4 new tests cover the env-aware shape (2 Python: `is_live_retrieval_active`, agent-card per-profile block; 3 JS: agent-card with/without key, /status flip with key).

- **New vertical worker: `cis_secondary_sanctions`** — second vertical worker under the `< 3` rule in AGENTS.md. Structured secondary-sanctions exposure evidence triage for CIS-domiciled counterparties (Kazakhstan, Uzbekistan, Kyrgyzstan, Tajikistan, Turkmenistan, Georgia, Armenia, Azerbaijan, Moldova). Targets enhanced due diligence in EU / UK / UAE / Singapore institutions screening counterparties against OFAC EO 14114, EU 14th sanctions package, UK OFSI, and FATF / EAG typologies. Ships with: new request/response schemas under `schemas/v1/cis-secondary-sanctions-{request,response}.schema.json` (with dual-copied packaged data), source-requirements taxonomy under `source-requirements/cis-secondary-sanctions.json`, service function `services.cis_secondary_sanctions_exposure`, HTTP route `POST /v1/cis-secondary-sanctions/exposure`, A2A capability `cis_secondary_sanctions_exposure` with the `cis_secondary_sanctions` product profile, three contract fixtures under `examples/cis-secondary-sanctions/contract/`, use-case doc at `docs/use-cases/cis-secondary-sanctions.md`, and 8 contract tests. Honest traction: zero paying customers, zero named pilots — shipped as a portfolio-grade vertical worker for technical evaluators and as a contract real practitioners can inspect.
- **ADR 0014 — per-profile live retrieval (OpenSanctions for `cis_secondary_sanctions`)** ([docs/adr/0014-per-profile-live-retrieval.md](docs/adr/0014-per-profile-live-retrieval.md)). The runtime default remains `live_retrieval: false`. The new `cis_secondary_sanctions` profile opts in to live retrieval against the OpenSanctions consolidated dataset (CC-BY 4.0) for counterparty name matches; matches are merged into the evidence pack as auto-fetched `dated_source` entries with attribution. Graceful degrade on any upstream failure (network error, 429, 5xx, timeout, missing API key) — response returned with `live_retrieval_status: degraded` (or `disabled`) and triage based on user-supplied evidence only. New module `src/agenda_intelligence/upstream_opensanctions.py` (thin urllib client, in-process TTL cache, attribution helper). Agent cards and `x_agenda_intelligence.per_profile_live_retrieval` now expose per-profile live-retrieval metadata; previously-deployed `agenda` and `kazakhstan` profile claims are unchanged. SOURCE_POLICY.md gains a "Per-profile live retrieval" section with the upstream whitelist and the success/degraded/disabled status taxonomy. Live retrieval requires an `OPENSANCTIONS_API_KEY` env var (free tier at https://www.opensanctions.org/api/); without it, the profile still functions on user-supplied evidence only.
- **Cloudflare Worker JS-side OpenSanctions live retrieval for `cis_secondary_sanctions` profile.** Mirrors the Python adapter for the Workers runtime. New JS module `deploy/cloudflare-worker/src/upstream_opensanctions.js` (fetch + `AbortSignal.timeout`, attribution helper, dataset-to-source-type mapping). Cache uses the existing `AGENDA_USAGE` KV namespace with the `opensanctions:` prefix (no new namespace). `wrangler.toml` gains an `env.cis-secondary-sanctions` stanza for the new `cis-secondary-sanctions-a2a` subdomain — operator runs `wrangler secret put OPENSANCTIONS_API_KEY --env cis-secondary-sanctions` before `wrangler deploy --env cis-secondary-sanctions`. Worker JS now: (1) detects `cis_secondary_sanctions` profile from host (`cis-secondary-sanctions-a2a`) or env (`AGENT_PROFILE=cis_secondary_sanctions`); (2) emits a per-profile agent card with `live_retrieval: {enabled: true, upstreams: [OpenSanctions], license: CC-BY-4.0}` block in `x_agenda_intelligence`; (3) exposes per-profile `live_retrieval` flag in `/status`, with `live_retrieval` sub-object listing upstreams + license + ADR link when enabled; (4) dispatches structured `cis_secondary_sanctions_exposure` requests from `message/send` to a JS port of `services.cis_secondary_sanctions_exposure` with OpenSanctions live retrieval and graceful degrade. `handleJsonRpc` is now `async`; tests updated to `await` it. The `agenda` and `kazakhstan` profile boundaries (`live_retrieval: false`) are preserved. 6 new worker tests under `deploy/cloudflare-worker/test/worker.test.js` covering profile detection, agent card shape, per-profile `/status` flags, dispatch with `OPENSANCTIONS_DISABLED=1`, and missing-structured-request failure mode.
- **Cloudflare Worker: HTML landing on `GET /` + new `GET /status` JSON endpoint** ([#66](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/66)). Browser visitors (Accept: text/html) now see a clean inline-styled landing page with agent name, live/version/A2A/profile badges, "what this is" with explicit non-advice + no-live-retrieval + no-factuality disclaimers, a profile-specific curl example, an endpoints list, and links to source / PyPI / Agenstry. API clients still get the JSON health payload. `GET /health` stays JSON-only regardless of Accept, so existing scripts and uptime checkers are unaffected. New `GET /status` returns a compact JSON status doc suitable for uptime monitors and presales discovery: name, version, profile, A2A protocol version, agent-card / message-send URLs, repository / package links, and the four boundary flags (`not_advice`, `live_retrieval`, `factual_verification`, `human_review_required`). Profile-aware: general worker surfaces strategic-risk triage framing; the kazakhstan worker surfaces Deal Risk Gate framing and escalation language.
- **AGENTS.md rewritten for multi-surface architecture** ([#63](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/63)). Project identity reframed from "MCP server + validation infrastructure" to "Product runtime + four surfaces". New **Vertical workers inside this repo** section legalizes the Middle Corridor Deal Risk Gate as a first-class artifact with a `< 3` spin-off rule for the next worker. The blanket "no new schemas / MCP tools / CLI subcommands without explicit approval" clause is replaced with a proportionate **Change discipline** rule: additive changes are allowed without prior approval if they ship behind a v1 schema, have a contract test, get a CHANGELOG entry, and respect the dual-copy invariant. Breaking changes to v1 schemas / public HTTP endpoints / A2A profiles still require an ADR and a version bump.
- **README aligned with multi-surface framing** ([#64](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/64), [#68](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/68)). Hero, fit-in-stack table, "What this is" list, and Status table now reflect MCP + HTTP + A2A + Cloudflare Worker as four delivery surfaces over one core service layer. New **Self-host via HTTP API** section for shops whose stack does not run MCP: six endpoints listed, one curl probe against the Middle Corridor `pre_signature_escalate.request.json` contract fixture, container build commands, and an honest "not a hardened internet-facing server" boundary. The Status row honestly states `no paying customers yet — illustrative usage only` per the new AGENTS.md honesty rules.
- **Hardened the README token guard in `scripts/validate.py`** ([#65](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/65)). The guard previously asserted the literal pre-multi-surface hero string and failed on `main` the moment #64 landed. The token now asserts the durable substring `"evidence-discipline layer for strategic intelligence agents"` so future hero polish does not break CI.
- **Automated MCP registry publish on tag push** ([#67](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/67)). New `.github/workflows/publish-mcp-registry.yml` triggers on `v*` tag push, syncs `server.json` version to the tag via `jq` (defensive against stale release commits), authenticates via GitHub OIDC (no PAT), and runs `mcp-publisher publish`. `workflow_dispatch` with a `version` input is available for manual catch-up runs. The v1.0.1 registry entry was published manually via local `mcp-publisher` on 2026-05-26 (during a GitHub Actions outage) to close the v0.8.2 → v1.0.1 drift before the automation went live.
- **Skill-improvement eval layer added for packaged runtime skills.** New `evals/skill-improvement/` introduces a lightweight SkillOpt-style loop for validation-gated edits to `skills/agenda-intelligence/SKILL.md`: JSONL cases, a manual rubric, baseline/after reports, and a local case validator. `docs/evaluation.md` now lists this as a separate eval layer from deterministic benchmarks and agent-eval deltas. The first accepted skill edit tightens composed regional + sector lens loading, source-as-data handling, stale/conflicting-source disclosure, signal classification versus marker semantics, and no-advice boundaries. No schemas, CLI, MCP, HTTP, or A2A contracts changed.

Operational changes outside the package itself (recorded here for audit, not for PyPI release notes):

- Branch protection on `main` across all four portfolio repos now enforces required CI checks before merge; `allow_auto_merge` is enabled at the repo level so `gh pr merge --auto --squash --delete-branch` waits for CI rather than fast-pathing.
- Agenstry agent cards verified live across all three Cloudflare Workers (general + kazakhstan + middle-corridor-deal-risk-gate) using `deploy/cloudflare-worker/scripts/verify-agent-card.js` after the landing-page deploy.

## [1.0.1] – 2026-05-23

Metadata-only patch release for MCP directories and agent registries.

- Expanded the 16 stdio MCP tool descriptions with clearer "when to use", input, output, and boundary guidance so directories such as Glama can present the server more accurately.
- Added non-validation `description` annotations to MCP `inputSchema` properties and mirrored them in both agent-manifest copies.
- No runtime behavior, schema validation semantics, CLI behavior, or tool names changed.

## [1.0.0] – 2026-05-23

First v1.0 release. Locks the contract surface defined by ADRs 0011–0013 per ADR 0003: future breaking changes to schemas, MCP tools, or the manifest contract fields (`name`, `version`, `schemas`, `mcp`, `cli`) require a v2.0 bump.

No new product behavior versus 1.0.0rc1; the RC was verified end-to-end via the post-release smoke workflow against the published PyPI wheel.

### Also included
- CI smoke regex relaxed to accept PEP 440 pre/post/dev versions ([#59](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/59)).

## [1.0.0rc1] – 2026-05-23

First release candidate for the v1.0 contract-freeze line. No new product behavior; this RC packaged the contract surface defined by ADRs 0011–0013 and the three follow-up fixes (#54, #55, #56) for end-to-end verification before the final v1.0.0.

The contract surface is: `name`, `version`, `schemas` (map of `{path, schema_version}` per ADR 0011), `mcp` (`{spec, tools[*]}` per ADR 0012), `cli`. See the manifest's `_contract_fields` and `_informational_fields` arrays for the authoritative split.

Pre-release publication: `pip install agenda-intelligence-md==1.0.0rc1` (default `pip install agenda-intelligence-md` still resolved to the latest stable, 0.9.3, at the time of release).

### Pre-v1.0 contract-freeze follow-ups

Three small fixes closing gaps left after PRs #50–#53 (ADR 0011–0013 contract freeze). No behavior change for callers; all changes are to the manifest contract surface or its CI guards.

- **fix(manifest): correct stale `cli` entrypoint string ([#54](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/54))** — ADR 0013 flagged the manifest `cli` field as still pointing at the backward-compat shim `scripts/agenda_intelligence.py`; the correction was scheduled for the ADR 0013 impl PR (#53) but missed. Both dual-copy manifests now point at the real entrypoint (`python3 -m agenda_intelligence.cli`). Informational string correction per ADR 0013, not a contract change.
- **fix(schemas): restore dual-copy parity for `agent-manifest.schema.json` ([#55](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/55))** — PR #52 added the schema only under `src/agenda_intelligence/data/schemas/v1/` without the paired top-level copy required by the dual-copy invariant in `CLAUDE.md`. Top-level copy restored and `test_packaged_schemas_match_top_level_schemas` is now bidirectional via set equality on filenames, so asymmetric adds fail CI in either direction.
- **feat(schemas): align `agent-manifest.schema.json` with ADR 0013 contract ([#56](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/56))** — The manifest schema predated ADR 0013 and still required the legacy shape (`entrypoint, protocols, lenses`); `validate-manifest` passed by accident. Rewritten to require the ADR 0013 contract surface (`name, version, schemas`, `mcp`, `cli`) plus `_contract_fields` / `_informational_fields` arrays. Adds `$id` per ADR 0011 and `x-schema-version` per repo convention. New tests pin the canonical contract-field set and lift `validate-manifest` into pytest so a stale schema fails CI directly.

## [0.9.3] – 2026-05-22

### Docs — v0.9 release gate closed (all 9/9 acceptance criteria ✅)

Two final v0.9 acceptance items shipped in this release.

#### Phase 4b — evidence-mode discipline extended to 5+5 with full docs ([#43](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/43))
- `tests/fixtures/evidence_mode/` now ships 5 golden and 5 failure fixtures (was 3+3). Two new golden cases cover vessel SDN attribution with caller-supplied source and EU CBAM regulatory `[verify]`-marker; two new failure cases cover sanctions designations and EU AI Act effective-date claims stated as bare facts. Fixtures are generated deterministically by `tests/fixtures/evidence_mode/build.py` from one baseline memo. Test count: 131 → 142.
- `docs/evidence-modes.md` — canonical reference for the three schema `evidence_mode` values (`reasoning_only`, `user_provided`, `mixed`), the post-hoc `check_evidence_mode_discipline` rule, and the full 5+5 fixture table. Clarifies relationship to the four-mode documentation labels in `docs/glossary.md`.
- `docs/rubric.md` — 10-dimension product-shell rubric (decision frame, routing, evidence mode, fact/assessment separation, mechanism specificity, actor incentives, watch-next indicators, source/audit integrity, no unsupported determinative claims, schema validity) plus 6-point human review checklist. Complements (does not replace) the deterministic heuristic scorer in `evals/rubric.md` and the reviewer checklist in `evals/human_checklist.md`. Not a CI gate in v0.9.

#### Phase 8 — 4-layer map deduplicated across the portfolio ([#44](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/44))
- The "Where this fits in the Agenda Intelligence stack" 4-row table is now canonical in this repo's `README.md` only. The three skill repos drop their local duplicates and link to the canonical anchor: [global-think-tank-analyst#10](https://github.com/vassiliylakhonin/global-think-tank-analyst/pull/10), [central-asia-caspian-hybrid-intelligence-skill#12](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill/pull/12), [gulf-middle-east-hybrid-intelligence-skill#11](https://github.com/vassiliylakhonin/gulf-middle-east-hybrid-intelligence-skill/pull/11).

#### ROADMAP
- All 9 v0.9 acceptance criteria now ✅. Sections marking criteria #4 (🟡 → ✅) and #8 (⬜ → ✅) updated with PR references.

No schema, CLI, or MCP tool changes. No new dependencies.

## [0.9.2] – 2026-05-21

### Docs — canon alignment with product-shell role
- `AGENTS.md` Project identity rewritten: this repo is the product entry point and evidence-discipline layer, not just an infrastructure layer. New section documents the four product MCP tools (`analyze`, `validate_memo`, `list_signals` / `get_signal`, `deep_dive` stub) and the geography routing term sets backing `analyze`. Vendored `skills/agenda-intelligence/**` now explicitly described as lighter derived copies; canonical reasoning and regional depth still live in the GTTA and vertical-specialist repos.
- `llms.txt` (and packaged copy under `src/agenda_intelligence/data/`) rewritten to match: drops the legacy "evidence and eval infrastructure layer" framing, lists the four product MCP tools, and documents the geography routing term sets verbatim.

### Added — AnalyzeRequest public example and routing-canon sync guard
- `examples/agenda-request.json` — minimal AnalyzeRequest for copy-paste integration; validated against `agenda-request.schema.json` by `scripts/validate_public_examples.py`, which gained a routing rule for `agenda-request.json` and `*.request.json` files.
- `tests/test_product_shell.py::test_routing_terms_documented_in_canon` — parametrised over `CA_CASPIAN_TERMS` / `GULF_ME_TERMS` / `EU_TERMS` / `SANCTIONS_TERMS`. Every term in the authoritative Python constants must appear verbatim in both `AGENTS.md` (Geography routing) and `llms.txt`. Test count: 121 → 125.

## [0.9.1] – 2026-05-21

### Added — `audience_detail` freeform field on agenda-request (ADR 0009)
- `schemas/agenda-request.schema.json` (and packaged copy) gains an optional `audience_detail` string (`minLength: 1`). The existing enum-bound `audience` field stays as the prompt-routable signal; `audience_detail` carries the caller's original framing (e.g. `"AI company leadership, product and compliance teams"`) so it is not silently coerced to the closest prototype.
- `_format_request_context` in `src/agenda_intelligence/product.py` renders `audience_detail` into the verified request-context block alongside `audience` when present.
- Additive change per ADR 0003: existing requests remain valid; no migration required.
- Closes the second observation from `evals/agent-eval/gtta-global-policy.md` about silent caller-intent loss at the `audience` boundary.
- 3 new unit tests in `tests/test_product_shell.py`. Test count: 118 -> 121.

### Added — EU geography and term routing in `route_modules`
- `src/agenda_intelligence/product.py` now routes geography `"EU"` / `"Europe"` (exact) and question text containing long-form EU terms (`european union`, `european commission`, `eu ai act`, `gdpr`, `cbam`, `cjeu`, `nis2`, `brussels`, `ecb`, `schrems`, etc.) to the `eu` regional specialist. The bare two-letter `"eu"` is matched only as an exact geography token to avoid false-positive substring hits inside words like `exposure` or `queue`.
- `MODULE_PATHS["eu"]` resolves to the existing `skills/agenda-intelligence/references/regional/eu.md` (already shipped in v0.9.0 and present in the packaged data mirror); this commit makes the lens reachable from `analyze` rather than only via the GTTA SKILL's load-list.
- `tests/test_product_shell.py` gains seven direct unit tests for `route_modules`, including a regression guard against substring false positives, an EU + sanctions composition case, and a module-content-loadable check. Test count: 111 -> 118.
- Closes the gap surfaced by `evals/agent-eval/gtta-global-policy.md` observation 3: the GTTA SKILL listed EU as a loadable lens but `route_modules` had no EU branch, so `meta.modules_used` never recorded EU even when the question was EU-centric.

## [0.9.0] – 2026-05-20

### Changed — v0.9 scope: agent-eval delta and product-shell narrative alignment
- ROADMAP `v0.9` rewritten from "verify-quotes network mode improvements" to "agent-eval delta and product-shell narrative alignment". Verify-quotes patches moved to a new `v0.9.x` deferred-patches section. v0.9 explicit non-goals: factual verification schema, source reputation scoring, live news gathering, crawler, `deep_dive` implementation, new MCP tools.
- README headline rewritten: drops "trusted geopolitical intelligence layer" framing for "MCP product shell and evidence-discipline layer for strategic intelligence agents". States no live retrieval and no factual verification as explicit non-goals before v1.0.
- ADOPTION MCP section now lists the product-shell tools (`analyze`, `validate_memo`, `list_signals`, `get_signal`, `deep_dive`) alongside the 11 validation tools, with a one-paragraph product-shell summary.
- `llms.txt` and packaged copy: `Source Acquisition Layer` renamed to `Source Planning Layer` to match CONTEXT canon. The `source_acquisition` manifest key is unchanged (compatibility wire name).

### Added — Agent-Eval Delta glossary and ADR 0008
- `CONTEXT.md` adds glossary entries for **Agent-Eval Delta** (per-case structural delta from the agent-integrator perspective; not factual, not aggregate, not a model-quality comparison) and **Practitioner Review** (optional, audience-gated). Two new rules in Flagged ambiguities make the boundary explicit.
- `docs/adr/0008-agent-eval-delta-is-structural-product-validation.md` records the validation-story decision for v0.9.
- `docs/agent-eval-methodology.md` tightened: live-source-backed examples map to `user_provided` or `mixed` for `analyze`; `live_source_backed` is intentionally absent from `agenda-request.schema.json` because live retrieval is upstream of Agenda Intelligence.
- `evals/agent-eval/` scaffolded with three case files (`gtta-global-policy.md` intended as the v0.9 full case; `ca-caspian-sanctions.md` and `gulf-me-hormuz-shipping.md` as stubs not to be cited until run).

### Added — Agent-eval case template
- README and evaluation docs now link the agent-eval methodology as the agent-first structural delta method.
- `evals/agent-eval/` now contains a README and reusable case template for skill-repo evals.

### Added — Request-context prompt guardrails
- `analyze` now injects a server-verified request context block into the system prompt, carrying question, decision context, audience, geography, time horizon, evidence mode, and depth.
- The prompt now explicitly tells the model not to invent citations when `evidence_mode` is `user_provided` or `mixed` but no source material is present in the request.

### Fixed — Product shell contract alignment
- README now describes the full 16-tool MCP surface in both the overview and MCP table.
- `analyze` now honors `output_format: markdown` by returning a server-rendered `rendered_memo` alongside the structured `memo`.
- `sanctions-sector` now uses the `sector_specialist` module role, and `agenda-memo.schema.json` accepts that role.

## [0.8.2] – 2026-05-20

### Added — Official MCP Registry ownership marker
- README footer adds `mcp-name: io.github.vassiliylakhonin/agenda-intelligence-md` so the official Model Context Protocol Registry (registry.modelcontextprotocol.io) accepts the published `server.json` against the PyPI package. No functional change.

## [0.8.1] – 2026-05-20

### Fixed — machine-verified audit replaces LLM self-grading
- `analyze` now overwrites `audit.validation_score` and `audit.validation_details` with values computed from six observable structural checks (schema valid, fact/assessment separation, unknowns acknowledged, modules match routing, watch_next present, evidence_mode within contract). The model can no longer self-assign a 0.99 audit score.
- The model's self-grade is preserved as `audit.self_assessed_score` for transparency, and `audit.machine_verified: true` flags the rewrite explicitly.
- `audit.provenance` (per-claim basis labels) is substantive content and is preserved as the model wrote it.

### Changed — system prompt enforces output format
- `assemble_system_prompt` appends a dedicated `===== OUTPUT FORMAT — STRICT =====` block that forbids markdown fences and surrounding prose, lists required keys, and provides a compact JSON skeleton. Improves first-pass parse rate for weaker host models.

### Added — schema fields for machine-verified audit
- `agenda-memo.schema.json`: optional `audit.machine_verified` (bool) and `audit.self_assessed_score` (number 0-1). Clarified that `validation_score` is structural only.

### Added — README quickstart explains `[llm]` extra
- Quickstart shows `pip install "agenda-intelligence-md[llm]"` + `ANTHROPIC_API_KEY` to enable direct API calls from `analyze`. Without it, `analyze` still returns the assembled `system_prompt` for the host model to complete.

### Tests
- `tests/test_product_shell.py::test_analyze_overrides_self_graded_audit_score` exercises the audit rewrite, the self-grade preservation, and the provenance pass-through.

## [0.8.0] – 2026-05-20

### Added — Agenda Intelligence product shell
- Five new MCP tools turning this repository into the product entry point: `analyze`, `validate_memo`, `list_signals`, `get_signal`, `deep_dive`. MCP tool count: 11 → 16.
- `analyze` validates the request against `agenda-request.schema.json`, routes geography to in-repo regional / sector references (Central Asia + Caspian, Gulf + Middle East, sanctions), assembles a system prompt from the bundled SKILL.md and reference files, and — when `ANTHROPIC_API_KEY` is set and the optional `anthropic` SDK is installed — calls the Anthropic API and validates the returned memo against `agenda-memo.schema.json`. Without an API key, returns a skeleton memo plus the assembled `system_prompt` so a host model can complete the analysis.
- `validate_memo` schema-checks memos against `agenda-memo.schema.json`.
- `list_signals` / `get_signal` expose a vendored snapshot of the Global Think Tank Analyst signal archive under `data/signals/`.
- `deep_dive` is a v2 stub returning a planned-status message.

### Added — Product request and memo schemas
- `schemas/agenda-request.schema.json` defines the input contract (question, decision_context, audience, geography, time_horizon, evidence_mode, depth, output_format).
- `schemas/agenda-memo.schema.json` defines the output contract (meta with modules_used and gtta_version, risk_summary, decision_frame, analysis with fact/assessment/assumption/unknown separation, scenarios with probability ranges, options, recommended_actions, failure_modes, watch_next, audit with validation_score and provenance).
- Both schemas are draft 2020-12, strict (`additionalProperties: false`), and include validated examples.
- `agent-manifest.json` gains a `product` block surfacing the request/response schemas, the five MCP tools, the signal source, and the explicit `live_source_retrieval: false` flag.

### Added — Optional LLM dependency
- `pip install agenda-intelligence-md[llm]` installs `anthropic>=0.40` so `analyze` can call the Anthropic API directly via `ANTHROPIC_API_KEY`. No new hard dependency.

### Added — Vendored signal archive
- `scripts/sync_signals.py` mirrors the GTTA `signals/` directory into `src/agenda_intelligence/data/signals/`, following the same dual-copy pattern as `schemas/` ↔ `data/schemas/`.
- `tests/test_signal_sync.py` enforces parity when a local GTTA checkout is present.

### Added — Product-shell integration tests
- `tests/test_product_shell.py` covers geography routing (Kazakhstan → CA-Caspian, global → GTTA only), validate_memo happy and negative paths, the LLM-invocation branch with mocked Anthropic responses, and signals / deep_dive coverage. Tests do not require network or credentials.

### Changed — Repository positioning
- README now leads with the product framing (Agenda Intelligence — trusted geopolitical intelligence layer for agentic workflows). The "What this is" list opens with the MCP product shell. Companion READMEs (Global Think Tank Analyst, Central Asia + Caspian, Gulf + Middle East) name Agenda Intelligence and document automatic activation rules.
- `MCP.md` documents the five new product-layer tools and updates the tool-count header (11 → 16).

### Added — Agenda brief data integrity notes
- Optional `data_integrity_notes` field added to `agenda-brief.schema.json` for prompt-injection, source-anomaly, stale/conflicting-source, retrieval-limit, or other integrity concerns surfaced by an analyst or agent.
- `data_integrity_notes` is a recording surface only: validators check field shape, but do not detect integrity risks or verify factual truth.

### CI & release
- GitHub Actions workflow dependencies moved to Node 24-compatible `actions/checkout@v6` and `actions/setup-python@v6`.
- PyPI publish steps now explicitly disable attestations while token-based publishing remains active, matching the documented Trusted Publishing migration path.

### Docs
- Use-case and integration docs now frame source plans as evidence expectations, not live retrieval or factual verification.
- MCP and adoption docs now list the full 16-tool surface, including the product-shell layer.

## [0.7.5] – 2026-05-20

### Added — Source-plan coverage diagnostics
- `source-coverage` CLI command and MCP `source_coverage` tool report covered and missing category-specific `must_check` source types.
- `source-categories` CLI command and MCP `list_source_categories` tool expose packaged source requirement categories for agents and CI.
- `source_coverage.required_source_details` explains which evidence source entries matched each required source type and which terms or aliases matched.
- Optional `source_category` field added to evidence packs so coverage diagnostics can select the packaged source plan without a separate category argument.
- `bench` now includes source-plan coverage diagnostics in Markdown and JSON output when evidence packs include `source_category`.

### Changed — Benchmark baseline
- Bundled source-backed baseline remains 20 cases, with 100% schema-valid, 100% evidence packs, and 100% claim-level audit.
- Baseline now also reports 100% source-category coverage, mean source-plan coverage of 14.8%, and 20 cases with diagnostic source-plan gaps.

### Boundary
- Source-plan coverage remains diagnostic before v1.0. It does not discover sources, score reputation, verify factual truth, replace analyst judgment, or redefine `validate-evidence` as category completeness.
- `source-coverage --strict` is opt-in and separate from base schema validation.

## [0.7.4] – 2026-05-17

### Added — Source Ingest skill
- New source-ingest skill: normalizes user-supplied documents (PDF, DOCX, XLSX, URL, article, transcript) into a structured source record with metadata, Axis A/B provenance tags, key-claims table, excerpts, and limitations.
- Live retrieval failure handling: fallback path when a URL fetch fails.
- Source-ingest routing references vertical source guides (Central Asia + Caspian, Gulf + Middle East) instead of duplicating regional source tier content.

### Added — Threat model
- `docs/threat-model.md` — explicit statement of what the validator catches and what it does not.
- Adversarial fixtures + pytest suite codifying the documented threat-model gaps.

### Added — Bench
- EU-CBAM case added to bundled bench; baseline now covers 5 source-backed cases (was 3).

### Docs
- Stack positioning synced across `pyproject.toml`, `llms.txt`, `agent-manifest.json`, and `ADOPTION.md`.
- `CLAUDE.md` scope tightened to evidence/eval infrastructure framing.
- `README.md`: stack-role tag, audience-first first screen, stack-context block, MCP framed as distribution surface.
- Bench baseline counts in docs aligned with committed benchmark output.

### Chore
- `.claudeignore` added with build, OS, and historical release-notes exclusions.

## [0.7.3] – 2026-05-14

### Added — Signal lifecycle
- Signal lifecycle tracker: schema, reference, and workflow for tracking
  observability signals across runs (`docs/signal-lifecycle.md`,
  `schemas/signal-tracker.schema.json`).

### Added — Provenance tags
- Per-claim inline provenance tags rendered in Markdown output, surfacing
  Axis-A source type and Axis-B action flags directly in generated reports.

### Added — Cases & lenses
- BIS AI Diffusion Rule flagship case study (`cases/bis-ai-diffusion`)
  with primary-source evidence.
- Gulf + Middle East added as the second vertical specialist in the
  Regional lenses set, alongside Central Asia + Caspian.

### Added — Evals
- Trust-layer evaluation parameters added to the human review checklist.

### Added — Docs & policy
- `AGENTS.md` and Claude Code working rules formalised.
- Release-artifact process documented.

### CI & packaging
- CI smoke-tests built package artifacts post-build.
- CI guard prevents tracked generated artifacts from re-entering the tree.
- `audit_claims` added to MCP smoke run (full 8-tool wire-protocol coverage).
- Packaged data assets kept in sync with top-level sources via test gate.

### Fixed
- README status block: stale MCP wording corrected.
- `cli.py`: flake8 E501 lint violation.

### Removed / cleaned
- Stale `experimental` labels removed from README docs table.
- Generated package artifacts no longer tracked in the repo.

## [0.7.2] – 2026-05-12

### Repositioned
- Project repositioned as **evidence & eval layer for strategic intelligence agents**.
  README rewritten: "What this is / What this is not", 60-second quickstart,
  status table, limitations, Mermaid architecture diagram.
- `docs/evaluation.md` rewritten around four explicit eval layers;
  factual truthfulness marked **not implemented**.

### Added — CLI
- `agenda-intelligence check` / `audit` / `report` / `eval` aliases for common workflows.
- `agenda-intelligence audit-claims <audit.json> [--strict] [--format json]` —
  validates claim-level evidence-audit JSON; `--strict` exits non-zero on orphan refs.
- `agenda-intelligence bench <dir> [--strict] [--min-score N] [--format json]` —
  discovers `*.brief.json` with sibling `.evidence.json`/`.audit.json`, runs
  validate + audit + score across all cases, emits Markdown or JSON report.
- `agenda-intelligence verify-quotes <pack.json> [--strict] [--texts-dir DIR]` —
  experimental local-text quote verification.
- `agenda-intelligence score` gains `--format json` and `--min-score N` flags.

### Added — Schemas & Examples
- Experimental `schemas/evidence-audit.schema.json` for claim-level evidence audit
  (`claim_id`, `claim_type`, `evidence_ids`, `support_level`, `uncertainty`, `risk_if_wrong`).
- Three flagship source-backed example sets with brief + evidence + claim-level audit:
  `eu-ai-act`, `red-sea-shipping`, `sanctions-routing`.

### Added — MCP
- `audit_claims` MCP tool (8th tool): validates claim-level audit JSON via wire protocol.
- `scripts/smoke_mcp.py` now exercises all 8 tools including `audit_claims` via full
  JSON-RPC cycle (initialize → tools/list → 3× tools/call).
- MCP wire-protocol verification added to `make ci`.

### Added — Evals & CI
- `agenda_intelligence.bench` module: `discover_cases`, `run_case`, `summarize`,
  `render_markdown`, `to_json` — deterministic, LLM-free structural harness.
- `evals/run_benchmark.py` script and committed baselines:
  `evals/baselines/source-backed.{md,json}`.
- `.github/workflows/bench.yml` — CI bench gate (`--strict --min-score 80`)
  with baseline drift check.
- 13 new pytest tests covering all new commands and MCP tool.
- `make ci` extended: MCP smoke + bench; `make ci-fast` for inner loop.
- `scripts/install-hooks.sh` pre-push hook (runs `make ci-fast` before every push).

### Added — Doctor & Config (from 0.7.2 base)
- `agenda-intelligence doctor` for local package and MCP self-diagnosis.
- `agenda-intelligence doctor --json` for machine-readable diagnostics.

### Bundled baseline
- 5 cases (eu-ai-act, eu-cbam, red-sea-shipping, sanctions-routing, bis-ai-diffusion), mean 87.0/100, 100% schema-valid, 100% with evidence, 100% with audit, 0 orphan refs.

## [0.7.1] – 2026-05-06
### Added
- `agenda-intelligence mcp-config --client` for generic, Claude Desktop, Cursor, and Codex local MCP config output.
- Client-specific MCP setup blocks in the integration docs.

## [0.7.0] – 2026-05-06
### Added
- MCP `score_output` tool for before/after protocol-marker quality scoring.
- Shared MCP smoke coverage now verifies `score_output` in addition to source-plan lookup.

### Changed
- The before/after evaluation script now uses the package scorer as its single source of rubric logic.

## [0.6.1] – 2026-05-06
### Added
- `agenda-intelligence mcp-config` for copy-pasteable MCP stdio client configuration.
- Post-release smoke coverage for `agenda-intelligence-mcp`.

## [0.6.0] – 2026-05-06
### Added
- `agenda-intelligence-mcp` console command for a minimal stdio MCP server.
- MCP JSON-RPC handlers for `initialize`, `ping`, `tools/list`, and `tools/call`.
- MCP tool exposure for `validate_brief`, `validate_evidence`, `get_protocol`, `list_lenses`, `get_lens`, and `source_plan`.

## [0.5.5] – 2026-05-06
### Added
- `agenda-intelligence --version` for direct CLI version checks.

### Fixed
- Release and manual publish workflows now clean `dist/` and `build/` before building, preventing old tracked artifacts from being rechecked or reuploaded.

## [0.5.4] – 2026-05-06
### Fixed
- Package version drift: `agenda_intelligence.__version__`, package metadata, and both manifests now report the same release version.
- README GitHub Release install snippet now tracks the current release artifact.

### Added
- Regression coverage for package/manifest/README version consistency.

## [0.5.3] – 2026-05-05
### Added
- Evaluation toolkit: rubric, LLM judge prompt, human checklist, sample cases.
- Heuristic 0-100 JSON brief scoring via `agenda-intelligence score brief.json`.
- Evidence-linked scoring via `agenda-intelligence score brief.json --evidence evidence-pack.json`.
- Source‑backed examples (EU AI Act, sanctions routing, Red Sea shipping).
- Use‑case docs for policy monitoring, sanctions compliance, market risk, founder operating context.
- Tutorial for end‑to‑end quickstart (5‑10 min “aha” moment).
- Demo output section in README.
- `start` command now the primary onboarding CLI entry‑point.

### Changed
- Version drift eliminated: `pyproject.toml` (0.5.3), `agent‑manifest.json` (0.5.3), packaged manifest data (0.5.3), removed `setup.cfg`.
- Top-level and packaged agenda brief schemas are now kept in sync.
- MCP read tools now return packaged protocol, lens, and source-plan data instead of stubs.
- README cleaned: removed old release notes, consolidated into a single coherent document.
- MCP transport/server marked as planned while read-only Python tool functions are documented as implemented.

## [0.5.1] – 2026‑05‑05
### Fixed
- Version sync across files.
- `setup.cfg` removed to avoid trust smells.
- Agent‑manifest version updated to 0.5.1.
- README wheel link updated to v0.5.1.

## [0.5.0] – 2026‑05‑04
### Added
- Source Acquisition Layer: `source‑plan`, `source‑types`, `list‑source‑packs` commands.
- `start` command for guided analysis.
- `memory‑search` for AnalysisBank.
- Expanded `source‑requirements/` with more categories.
- CI workflow updates.

## [0.4.0] – 2026‑04‑28
### Added
- Source Acquisition Layer (initial) – tells agents which source types to check before making claims.
- `source‑plan` command (stub).
- `technology‑ai`, `sanctions`, `regulation`, `elections`, `conflict‑security`, `energy`, `trade`, `financial‑market`, `regional‑risk` source requirement files.
- AnalysisBank memory cards (failures & successes).
- Regional lenses: Central Asia & Caspian, Middle East, EU.
- Sector lenses: sanctions, export controls.
- Revised `Agenda‑Intelligence.md` protocol (v0.4.0) with stronger evidence discipline.

## [0.3.0] – 2026‑04‑20
### Added
- Agent‑first package contracts: `agent‑manifest.json`, JSON schemas for briefs, evidence packs, memory cards.
- CLI validation commands: `validate‑brief`, `validate‑evidence`, `validate‑manifest`.
- `list‑lenses`, `get‑lens`, `get‑protocol` commands.
- `score` command (stub) for before/after evaluation.

## [0.2.0] – 2026‑04‑12
### Added
- AnalysisBank reasoning memory layer: stores reusable patterns from good/bad outputs.
- `analysis‑bank/` directory with failures and successes.
- `eval_before_after.py` script for before/after scoring.
- Sample `before‑after/` examples.

## [0.1.0] – 2026‑04‑05
### Added
- Initial release of `Agenda‑Intelligence.md` protocol.
- Core reasoning workflow: signal classification, what changed, why it matters, who is affected, main uncertainty, watch‑next indicators.
- Basic CLI skeleton (`agenda‑intelligence`).
- `examples/` folder with sample briefs.
- `schemas/` folder with JSON schemas.
- `skills/agenda‑intelligence/` OpenClaw skill wrapper.
