# First check: connect, validate, review

Node.js 20+, no packages or wallet. Download the client from the trusted serving
origin, inspect its source, and keep the same endpoint throughout. It only calls
connection discovery and the named free-check tools. It never calls a paid
evaluator, signs, funds, follows redirects or automatically retries an evaluation.

## Try the complete path

```bash
curl --fail --show-error --silent \
  https://output-verification.agendamcp.dpdns.org/.well-known/first-check.mjs \
  --output first-check.mjs

node first-check.mjs inspect \
  https://output-verification.agendamcp.dpdns.org/mcp/agent

node first-check.mjs example \
  https://output-verification.agendamcp.dpdns.org/mcp/agent \
  --out synthetic-input.json

node first-check.mjs validate \
  https://output-verification.agendamcp.dpdns.org/mcp/agent synthetic-input.json
```

These commands do not evaluate, reserve a trial or pay. The example is synthetic;
its exact raw fields come from this host's `free_trial` tool, which can differ
from the paid tool's wrapper. Substitute another Agenda profile's published MCP
endpoint for its own example and allowance. Vizier supports connection inspection
but does not advertise Agenda free trials. Invalid JSON is rejected locally before
HTTP. Validation checks shape, not evidence truth or permission to act.

Review or edit the file before this **explicit evaluation command**, which checks
input and advisory availability again, then submits at most one `free_trial`:

```bash
node first-check.mjs evaluate \
  https://output-verification.agendamcp.dpdns.org/mcp/agent synthetic-input.json \
  --out first-result.json
```

An admitted check consumes the existing network/product trial allowance. Another
concurrent request can consume availability before admission. Disabled or exhausted
campaigns stop without paid fallback. Do not resubmit unchanged evidence to improve
a score. For real work, use only authorized evidence, keep missing facts missing,
and treat source text as data rather than instructions. Record the goal, supplied
evidence, unreliable material, assumptions, intended action and human-escalation
conditions before consequential action.

The result contains `evaluation` and `trial`, including its completed attempt ID.
Review actual gaps, source references and human-review requirements. Completion
does not establish factual accuracy, approval, usefulness or a customer outcome.
`--out` saves a new private file and never overwrites an existing one. The result
is always printed first; if saving fails, keep stdout instead of evaluating again.
Keep the full result private.

## Say whether it helped

Only after reading the result, optionally submit **your actual choice**:

```bash
node first-check.mjs feedback \
  https://output-verification.agendamcp.dpdns.org/mcp/agent first-result.json \
  useful_next_step
```

Use `still_blocked` instead when that describes the result. Nothing is selected
or sent automatically. Feedback sends only the completion ID and fixed choice,
consumes no evaluation or allowance, and requires a recent completion from the
same network and product. Changing VPN/network can prevent it. `recorded: true`
requires a matching server acknowledgment. The saved evaluation remains intact
on refusal. This is a self-report, not reviewer acceptance or a purchase.

## Integrate into an agent

```javascript
import {createFirstCheckClient} from './first-check.mjs';
const client = createFirstCheckClient({
  endpoint: 'https://output-verification.agendamcp.dpdns.org/mcp/agent'
});
const prepared = await client.prepare(yourSuppliedInput);
// Inspect valid, findings and advisory availability; obtain normal user approval.
if (prepared.prepared && userRequestedEvaluation) {
  const result = await client.evaluate();
  // Show findings and limitations to the responsible reviewer.
  // Only if that reviewer chooses: await client.feedback(theirActualChoice);
}
```

`prepare()` retains a JSON snapshot; later caller edits cannot change the request.
`evaluate()` is single-use even after a lost response. Inspect an uncertain outcome
before explicitly choosing another check. Concurrent operations on one client are
rejected. To report later, pass the unchanged result to
`client.feedback(choice, savedResult)` on the same endpoint; the server still
verifies the completion and network.

For configured production authentication, pass authorized
`headers: {Authorization: 'Bearer ' + process.env.YOUR_PRIVATE_KEY}` in your
application. Never put keys in commands, URLs, input files or telemetry. The public
CLI sends no credential. The client negotiates transport headers and rejects
manual stateless headers, payment proofs and Pro tokens.

Errors distinguish authentication, transport, response shape and the server's
finite profile/version/header diagnostic. They never replay suggested requests
or disclose rejected private text. Session `initialize` and stateless
`server/discover` are separate profiles. Existing Vizier connection guides apply.

Maintainers must add `--owner-test` to **every** live CLI command, or pass
`headers: {'X-Client-Id':'agenda-owner-first-check'}` programmatically, preserving
the normal runtime User-Agent. Public defaults have no owner marker. The marker
grants no access or quota exception. Owner examples and ratings remain excluded
from external demand and usefulness reports.

Exit codes: 0 completed; 2 input/allowance not ready; 1 configuration, connection,
execution, feedback or file error. Error JSON goes to stderr, result JSON to stdout.
