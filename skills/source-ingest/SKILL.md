---
name: source-ingest
description: Normalize a raw source — PDF, DOCX, XLSX, URL, article text, or transcript — into a structured source record compatible with SOURCE_POLICY.md evidence modes and per-claim provenance tags. Use before analysis when the user provides a document and you need to extract metadata, classify source type, pull key excerpts, and surface limitations before handing off to the agenda-intelligence or global-think-tank-analyst workflow.
---

# Source Ingest

Use this skill to process a raw source into a normalized record before analysis.

Do not skip this step when the user provides an external document that will be used as evidence. Running analysis directly on an unprocessed source risks attributing the wrong source type, missing date/author context, and carrying in unsupported claims.

## When to use

- User provides a PDF, DOCX, XLSX, or file path.
- User pastes a URL or article text.
- User shares a transcript (speech, meeting, interview, briefing).
- You are about to run agenda-intelligence or a policy-risk memo and the evidence base is user-provided or a specific retrieved document.

## When not to use

- General web browsing without a specific document.
- Reasoning-only analysis where no source is being ingested.
- You are writing or editing a memo that is already sourced.

## Output format

Produce a source record in this shape:

```markdown
## Source record

**Title:** [Full title or best approximation if absent]
**Author / publisher:** [Name, institution, or "Unknown"]
**Date:** [Publication or document date, YYYY-MM-DD or YYYY-MM if only month known]
**Document type:** [official-doc | regulatory-filing | court-record | company-filing | research-report | media-article | think-tank-report | transcript | dataset | other]
**URL or file:** [URL or filename]
**Retrieval / received date:** [YYYY-MM-DD — when you accessed or received it]
**Language:** [Language of the source]

### Axis A classification (SOURCE_POLICY)
**Source type:** [primary | secondary | user-provided]
- `primary` — official document, legal text, regulator statement, sanctions list, court record, company filing, parliamentary record, treaty text, directly accessed.
- `secondary` — think-tank report, media article, analyst commentary, research note.
- `user-provided` — provided by the user in this session, not independently verified.

### Axis B flags
[Add if applicable]
- `[verify]` — if a key claim should be confirmed against the original before operational use.
- `[stale-risk: YYYY-MM]` — if the document is dated and the covered facts may have changed.

### Key claims (extracted)

For each material claim in the document, produce one line:

| Claim | Page / section | Provenance | Action flag |
|---|---|---|---|
| [Quoted or closely paraphrased claim] | [p. N or §N] | [primary / secondary / user-provided / inference] | [verify / stale-risk: YYYY-MM / none] |

Limit to 5–10 claims most relevant to the user's task. Do not list everything.

### Key excerpts (quoted)

> "[Direct quote from source, including enough context to be intelligible.]"
> — [Author if named], [Title], [Date], [Page or section if known]

Include 2–5 excerpts that are most likely to be cited in the downstream analysis.

### Source limitations

State what this source does and does not establish:

- **Establishes:** [What factual claims are directly supported by this document.]
- **Does not establish:** [What the document cannot support — scope limits, missing data, what it does not screen or verify.]
- **Potential bias or framing:** [Publisher orientation, advocacy position, or conflict of interest if relevant.]

### Routing

Based on the document's topic, suggest which source-requirements pack and skill references to load next:

- **Source-requirements:** [e.g., source-requirements/sanctions.json, source-requirements/energy.json]
- **Skill reference:** [e.g., references/sector/sanctions.md, references/regional/central-asia-caspian.md]
- **Suggested evidence mode for downstream memo:** [live-source-backed | user-provided | illustrative source packet | reasoning-only]
```

## Source type decision rules

If the document is an official legal text, regulatory filing, sanctions list, court record, or government statement: → `primary`.

If the document is a research report, think-tank publication, media article, or analyst note: → `secondary`.

If the document was provided by the user and cannot be independently verified in this session: → `user-provided` (even if it originated as a primary source — the chain of custody is user-mediated).

When in doubt, choose `user-provided` and note that the original source type should be verified.

## Claim extraction rules

- Quote claims directly where possible; paraphrase only when a direct quote would be too long.
- Do not add claims that are not in the document.
- Do not upgrade an assessment or opinion in the document to a fact.
- If the document contains quantitative data (tables, statistics, XLSX), extract the most relevant figures as claims with their table/sheet reference.
- If the document is a transcript, extract direct statements by named speakers; label speaker role.

## Limitation note

This skill extracts and structures what a document says. It does not verify that the document itself is authentic, unaltered, or authoritative. It does not perform sanctions screening, legal analysis, or operational due diligence. Operational use requires qualified professional review.
