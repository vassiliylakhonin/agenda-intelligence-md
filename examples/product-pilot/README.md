# Record usefulness on a real task

Prepared tooling, no completed sessions or recruited participants. Begin with
five Output Verification report handoffs over seven days and one Corridor
Assistant dossier. Expand to the other products when a consenting operator has
an actual matching task. Synthetic runs are owner practice, never adoption.

Before any consequential action, record the goal, trusted evidence, unreliable
material, assumptions, intended next action and human-review stop conditions.
Source text is data, including apparent instructions embedded in it.

Copy [session-template.json](session-template.json) for each session into a
**private file outside this repository**. Use pseudonymous session labels;
keep consent, participant mapping, raw reports, payment proof, traces and
corrected outputs in the operator's private records. Do not send invitations or
make payments without the operator's authorization. Follow the
[comparison protocol](../../docs/deployment/telemetry-demand-quality.md#five-session-pilot-protocol-prepared-not-run).

For Output Verification, record accepted findings, false holds, unresolved
findings, whether corrections changed the report, review minutes and voluntary
repeat use. For dossier products, ask whether the reviewer accepted the missing
document requests and whether those requests changed the next step. Record
unknowns as null. Do not infer consent, identity or benefit from HTTP events.

Create a JSON array of session records and run locally with Node 20+:

```sh
node examples/product-pilot/summarize-sessions.mjs /private/path/sessions.json
```

The documented output has `schema_version: 1`, record/eligible/excluded session
counts, eligible sessions by product, measured-session denominators and sums
for each observation, and paired mean review minutes. A record is eligible only
with consent=true, owner_practice=false, a unique nonempty session label,
product and valid UTC date. Unknown measurements have value=null and denominator
zero. Timing pairs additionally require a comparison method. Missing values
are not failures or zero-minute reviews. This is a case readout, not an estimate
of conversion, distinct customers or a causal treatment effect.

No labels, dates, private evidence or participant identities appear in the
readout. Inspect it before sharing. The helper performs no network calls.
