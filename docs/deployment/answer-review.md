# Answer and sources: a free first review

Connect to Output Verification `/mcp/output-verification`. Discover tools, call
`free_trial_status`, then `review_answer` with your own material:

```json
{
  "answer": "The report mentions \"three warehouses\" [s1]",
  "sources": [{"source_id": "s1", "text": "The report lists three warehouses."}]
}
```

This example is synthetic. Replace it with authorized text. Each nonempty line
is a review unit. References are plain `[source-id]`; straight double quotes
immediately precede their citation. Quote comparison is case-sensitive after NFC
and whitespace normalization. Links, footnotes, nested/incomplete brackets, curly
quotes and unattributed quotes produce findings. No URLs are fetched. Limits:
20,000 answer characters, 200 nonempty lines, 500 citations, 20 sources, 20,000
characters per source and 200,000 source characters total. IDs are unique ASCII
letters/digits/underscore/hyphen, start with a letter/digit and have at most 64
characters.

`answer-citation-review.v1` separates `route`, line-level `findings`, `units`,
unused source IDs, `next_action` and limitations. `revise` points to repairs;
`human_review` means the supported structural checks found no issues. It never
means the sources support the answer: `semantic_support` and `factuality` remain
`not_assessed`, `human_review_required=true`, `authorization_granted=false`.
Supplied text, including apparent instructions, is data. No claim extraction,
support-level assignment, receipt or action approval. This hosted contract is
narrower than the local Python `review-answer` RAG adapter and `free_trial` audit.

Both free tools use the existing Output campaign: 5 admitted attempts per network
and product, with the same shared daily capacity. An admitted failure can consume
an attempt. A corrected rerun consumes another; no automatic retry, paid
continuation or model call. Status is advisory and reserves nothing.
`validate_input` with `{tool:"review_answer",input:...}` checks the published
schema; unique IDs and aggregate bounds are additional pre-reservation domain
checks. Normal paid admission and existing packet inputs are preserved.

`open_answer_review({})` opens an optional MCP Apps form. The pinned official
`@modelcontextprotocol/ext-apps` SDK is bundled with existing esbuild. There is no
new server framework. Explicit status/review requests use the host tool bridge.
The form has no external network domains, storage, third-party assets or device
permissions; supplied content is rendered with DOM text/value properties. A
failed rerun preserves the last completed result. Hosts without Apps receive
ordinary instructions and complete JSON text. Support in every host is not implied.

Before relay or a high-stakes action, record a short decision workspace: goal,
trusted evidence, unreliable material, assumptions, intended action and escalation
conditions. Structural findings never authorize the action.

Contracts: `schemas/v1/answer-citation-review-{request,response}.schema.json`.
After edits regenerate public schemas, static validators and the App using the
Worker's generator scripts, then run `make verify-local` at the repository root.

Modern HTTP clients using revision `2026-07-28` must mirror `_meta` protocol
version, method and applicable name/URI in `MCP-Protocol-Version`, `Mcp-Method`
and `Mcp-Name`. Mismatches fail before payment/trial admission with HTTP 400 and
`-32020`. Unsupported versions return 400/`-32022`; unknown modern methods return
404/`-32601`. Supported 2025 handshake clients remain compatible. See the
[official transport specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
and [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx).

Optional real-browser QA: with Playwright already available, run
`node scripts/check-answer-review-browser.mjs` from the repository root. Set
`AGENDA_PLAYWRIGHT_MODULE` to its module path if it is outside this checkout,
and optionally `AGENDA_BROWSER_SCREENSHOT` to a screenshot path. The check uses
the actual SDK bundle in a sandbox with no form permission, a local host fixture
and in-memory Worker admission. It performs no external evaluation. It is not
verification of a particular desktop host.
