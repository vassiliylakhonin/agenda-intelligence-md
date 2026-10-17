# Evaluation action contract

Hosted fleet evaluation results expose four additive fields:

| Field | Meaning |
| --- | --- |
| `next_action` | `block` for an explicit blocking verdict/local violation, `insufficient` for missing evidence, otherwise `review` |
| `decision_kind` | `evidence_review` |
| `authorization_granted` | Always `false`; review does not authorize execution or a commercial/compliance decision |
| `score_kind` | `risk`, `evidence_readiness`, or `not_scored`; scores are not interchangeable |

Original verdicts, operational decisions, reasons, gaps and human-review notices remain the detailed contract. A batch preserves its strongest blocking child outcome; an invalid child requires more evidence. Unknown checks must never be read as a clean result. The legacy threshold Bankability screen remains caller-supplied, illustrative, and routed to review.

Python profile services expose these fields where their versioned response schemas define them. Hosted REST evaluations, MCP structured content and A2A response artifacts reuse the same routing metadata. Discovery, receipt verification, errors and quota responses are not evaluation decisions.

Output Verification checks every declared quote of at least eight normalized characters against supplied nonempty source content. An absent quote is unsafe even beside another matching quote. Missing source text is an evidence gap, not a proven mismatch. Matching a literal quote still proves neither the document's authenticity nor the claim's truth.

Explicit `ILLUSTRATIVE ONLY`, `synthetic test/example/fixture/only`, placeholder records and reserved example URLs cannot establish documentary coverage. Unmarked metadata is still unverified; removing a marker does not authenticate a source. Existing fixture filenames are stable identifiers, not promises of their resulting readiness.

CIS `screening_assessment` distinguishes fresh name screening from stale/unassessed checks. Unassessed `name_matches` is null, not zero; identity and ownership stay unverified. Financial Guard `check_status` separates local heuristics from AML, which it does not assess.

Vizier is a separate authorization service. Its compatible normalized action contract lives in `policy_results[rule_id=integration.authority.trusted].details.action_contract`; `allow` remains possible with the existing trusted-integration or valid-grant rules. Integration enforcement is required.

This release does not add A2A trial dispatch or standard x402 client settlement. Existing native MCP and HTTP trials, payment rules, limits and prices remain in place.
