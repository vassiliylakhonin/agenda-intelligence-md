# AI-retrievable evidence-readiness profiles

Status: discovery-method note.
Date: 2026-06-29.
Mode: `build-to-learn`.

This note turns the ChatGPT source-selection observations from Suganthan Mohanadasan's network-traffic article into operating rules for Agenda Intelligence MD's current commercial discovery wedge: **AI vendor evidence-readiness for regulated procurement**.

It is not an SEO plan, ranking promise, traffic strategy, or claim of market traction. It is a source-readiness discipline for public evidence artifacts that should be easy for humans and AI agents to retrieve, inspect, cite, and challenge.

## Why this matters

Agenda Intelligence MD's first wedge is not "more vertical workers." The smallest useful artifact is an **AI Vendor Evidence-Readiness Profile** built from public RFP language, vendor claims, standards, and documentation.

If the profile is hard for AI systems to fetch, parse, or cite, it fails its own evidence-readiness standard. A buyer, reviewer, or agent should be able to answer:

- What buyer decision is this profile about?
- Which source pack did it use?
- Which claims are supported, weak, missing, or not assessable?
- Which reviewer owns the next action?
- What boundary prevents this from becoming legal, compliance, security, or procurement advice?

## External signal used

Suganthan's article is useful as directional evidence about AI retrieval behavior:

- ChatGPT can fetch more pages than it cites; `fetched`, `mentioned`, and `cited` are different states.
- Source choice can involve multiple retrieval pipelines and fan-out searches, not only the final visible citations.
- Plain, crawlable, text-heavy pages are safer than content that depends on JavaScript, images, or PDFs alone.
- Specific query phrasing and claim-level relevance matter; a page can be relevant to a domain but still not become a cited source for a particular answer.
- The author's numeric findings should be treated as directional, not universal, because the observed window and query set were limited.

Source: <https://suganthan.com/blog/how-chatgpt-picks-sources/>

## Operating rules for Agenda Intelligence profiles

### 1. Make the artifact claim-addressable

Each profile should include stable, explicit sections with predictable headings:

- `Market gate`
- `Source pack`
- `Buyer questions implied by the artifact`
- `Vendor or system claims`
- `Control and standard mapping`
- `Evidence-readiness decision`
- `Missing evidence`
- `Human-review packet`
- `Boundary notes`
- `Follow-up signal`

Avoid burying the evidence decision in narrative prose. AI retrieval is more likely to preserve tables and headings when the information architecture is obvious.

### 2. Use source IDs everywhere

The `Source pack` should assign stable IDs such as `S1`, `S2`, and `S3`. Claim rows should reference source IDs when possible:

| Claim | Evidence present | Source IDs | Evidence gap | Readiness |
|---|---|---|---|---|
| "Audit-ready reporting" | RFP requires audit trails and retention | S1 | Need log schema, retention control, export sample | missing |

This makes citations easier to audit. A reviewer should not need to infer which public source supports a claim.

### 3. Publish a crawlable text version before richer formats

The primary version should be plain Markdown or simple HTML:

- no client-side rendering requirement;
- no image-only tables;
- no PDF-only artifact when a text version can exist;
- absolute public links for source URLs;
- short descriptive file names using the buyer/use-case phrase.

PDFs may be useful for humans, but they should not be the canonical retrieval surface.

### 4. State what the page is not

Every public profile should include boundary text that retrieval systems can quote or summarize:

- no vendor approval or rejection;
- no legal, compliance, procurement, security, financial, insurance, or sanctions advice;
- no factual-truth verification;
- human review required.

This protects the wedge from drifting into an advisory product and makes it easier for AI systems to describe the artifact accurately.

### 5. Keep one strong profile per buyer workflow

Do not fragment a single review into many thin pages. A profile should be strong enough to answer one concrete buyer workflow:

- public-sector AI governance platform RFP;
- healthcare AI governance platform RFP;
- insurance AI governance / AIS Program third-party review;
- healthcare model-card or assurance packet review.

Thin pages may be fetched, but they are less likely to be cited for evidence-readiness because they do not resolve a concrete claim.

### 6. Separate public signal from buyer behavior

Each profile should keep this distinction visible:

- **Observed public signal:** public RFP language, public vendor claims, public standards, public guidance.
- **Inference:** what this may imply about buyer pain.
- **Unknown:** budget owner, willingness to pay, private workflow, vendor response quality.
- **Traction:** redacted file, second artifact request, paid concierge interest, budget-owner intro, or concrete workflow correction.

Public retrieval success is not market validation.

## Profile publication checklist

Before publishing or sharing a profile, check:

- The title names the buyer workflow, not a generic category.
- The first 150 words say `evidence-readiness`, `human-review packet`, and the decision moment.
- The source pack has stable source IDs and public URLs where possible.
- Claim rows distinguish `supported`, `weak`, `missing`, and `not assessable`.
- Missing evidence rows name owner actions.
- Boundary notes are present.
- Follow-up signal rows are still blank or honestly marked.
- The profile links back to the profile pack and template.
- The profile is discoverable from `README.md`, `llms.txt`, or another index page.

## Retrieval eval prompts

Run these prompts manually in ChatGPT or another retrieval-enabled AI system after publishing a profile. Record only observed behavior, not impressions.

| Prompt | Expected retrieval target | Pass signal | Fail signal |
|---|---|---|---|
| `AI vendor evidence-readiness profile regulated procurement` | Profile pack or template | Agenda Intelligence profile pack is fetched or cited | Generic AI governance pages only |
| `public-sector AI governance RFP evidence gaps` | TXShare profile | Missing-evidence table is cited or summarized | Generic public-sector AI policy content |
| `healthcare AI governance platform RFP evidence readiness` | UTHSA profile | UTHSA profile is fetched or cited | Healthcare AI ethics pages only |
| `what evidence should an AI governance platform vendor provide for procurement review` | Template or concrete profile | Claim/evidence/missing-owner structure appears | Product comparison or vendor ranking |
| `AI procurement human review packet missing evidence vendor claims` | Profile pack or discovery wedge | Human-review packet language appears | Legal/compliance advice framing |
| `site:github.com/vassiliylakhonin/agenda-intelligence-md AI Vendor Evidence-Readiness Profile` | Repository docs | Correct repo docs appear | No repository result or unrelated files |

Record:

- searched: yes / no / unknown
- fetched: yes / no / unknown
- cited: yes / no
- mentioned but not cited: yes / no
- wrong source cited:
- useful query wording:
- missing public page or index:

## Decision rule

Improve retrieval only enough to support discovery.

Continue if AI systems can retrieve the profile pack and real reviewers respond with behavior: redacted files, second profile requests, paid concierge review interest, budget-owner intros, or concrete workflow corrections.

Stop optimizing publication if the only signal is traffic, citations, likes, or "interesting" feedback.

