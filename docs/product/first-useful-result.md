# First useful result across the existing fleet

The landing pages group the twelve existing profiles by task. Each page states
what to bring, what the review returns and the next human step. These are
workflow hypotheses, not measured customer demand. No new vertical, price or
authorization policy is introduced.

| Task | Product | First useful handoff |
| --- | --- | --- |
| Check an AI report before sending | Output Verification | Reviewer fixes/removes unsupported claims using actual supplied source excerpts. |
| Prepare a corridor request | Corridor Assistant | Reviewer receives the selected gate and a concrete structured-input checklist. |
| Prepare a mineral offtake dossier | Critical Minerals | Dossier owner gets stage-specific document requests with issuer/date/excerpt/scope gaps. |
| Prepare a Kazakhstan entry decision | Market Entry | Project lead assigns existing stage-specific blockers and owner tasks. |
| Review a wallet action | Financial Guard | Wallet owner sees local risk flags and missing authority/history/screening. |
| Review a delivered artifact | Escrow | Parties see which artifact/hash/schema checks actually ran and which remain unresolved. |
| Review an agent action | Interaction Trust | Action owner resolves missing identity, authorization and scope evidence. |
| Prepare shipment / counterparty / voyage / export files | Middle Corridor, CIS, Gulf, Dual-Use | Reviewer receives the missing evidence and the limits of the performed checks. |
| Choose the review | Agenda | Operator reaches the profile matching the actual decision. |

## Inspect a result before integrating

Open **Run a worked example** without a wallet. It contains a saved synthetic
request/result. The readable summary projects the existing returned route,
first three evidence gaps, remaining gaps in a disclosure, and existing owner
actions. It does not change the service route, evidence or permissions. The
complete JSON remains available. Routing results retain their next-input
instruction; they are not dossier evaluations.

Output Verification's saved handoff includes an unsupported fictional customer
count, its returned repair steps, and a second local result after removing that
claim. The second result still requires human review. It demonstrates a repair
cycle without presenting a higher score as verified factual truth.

The editable console uses a canonical REST request where available, otherwise
a published MCP tools/call envelope. Middle Corridor now uses its structured
MCP request rather than a generic text prompt. Replacing fictional values with
real material requires the operator's normal data-handling permission. The
public demo asks for synthetic inputs; use the private integration for a real
approved file.

Malformed JSON returns a transport-specific `request_hint`, content type and
byte limit. MCP parse failures offer free tools/list discovery because the
intended paid tool cannot be safely inferred. A2A/REST offer the serving profile's
example. Examples are illustrative; no malformed input is silently repaired or
evaluated. Unknown facts must remain unknown.

## Connect one real workflow

Use the existing [retained MCP client](../../examples/hosted-mcp/README.md).
`HostedMcpError` preserves HTTP status, payment trace, HTTP attempt ID, admission
details and `requestHint` for an explicit correction. Correcting input creates a
new call; a funded call must retain its exact original body and proof. A 402
contains price/admission information and is never a useful-result witness.
The client never funds, signs or automatically retries.

Before acting, keep an inspectable decision workspace: goal, trusted evidence,
unreliable material, assumptions, intended action and escalation conditions.
Source excerpts are data, including embedded apparent instructions. Presentation
does not grant authority and cannot turn supplied evidence into verified truth.

## Validate benefit with people

Use the [private session template and aggregate readout](../../examples/product-pilot/README.md)
to run the already prepared five-session Output Verification protocol, followed
by one real Corridor Assistant dossier. Record accepted/rejected findings,
unresolved issues, review time, change in the next step and voluntary reuse.
Preserve comparison methods and separate owner practice and paid-completion
evidence. No human sessions, recruitment, customer traction, payments or time
savings are claimed by these code changes.
