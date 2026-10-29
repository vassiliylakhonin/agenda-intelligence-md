# From a risk question to an evidence review

This is an offline demonstration, using invented cases and no credentials, payment or hosted quota. From a checkout with Node 20+ and the Python package installed (`python -m pip install -e .`):

```sh
examples/strategic-orientation/demo.sh
```

First, the actual local Worker handles the question through `strategic_risk_triage`. `orientation.status` is `EVIDENCE_NOT_ASSESSED`; `selected_gate` is a keyword-based suggestion and `next_one_thing` describes the structured input. Other gates may also be relevant; verify the choice. The same Worker then runs the Middle Corridor gate with an empty pack and again with two **explicitly synthetic** references. It rejects those records for source coverage, so the missing categories do not disappear. This is deliberate: a fictional document cannot establish a real-world source.

Second, the separate local Output Verification adapter checks the same fictional memo twice. Two missing citations become linked to two invented excerpts and the route changes from `revise` to `human_review`. The claims are retained. This demonstrates reference and quote checks, not the selected Middle Corridor gate, sanctions screening, source authenticity or factual truth. Human review remains mandatory; invented excerpts prove nothing about a real transaction.

## Hosted use

The existing free-text call remains compatible. Existing detailed fields remain in the response; `orientation` appears first in the JSON, and an at-a-glance section precedes the detailed A2A text. This is a concise entry point, not a response-size reduction or a new `brief` parameter.

```sh
curl -sS https://agendamcp.dpdns.org/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"strategic_risk_triage","arguments":{"text":"Middle Corridor cargo from Aktau to Baku before signature"}}}'
```

Read `result.structuredContent.orientation`. The status always means that evidence has **not** been assessed; it is not a score, finding of missing documents, or permission. The suggested gate's agent card explains its structured request. Evaluation of a new hosted dossier may require admission or payment; discovery and the offline demo do not change those terms. Never send confidential evidence to a public demonstration.

## Add to a review workflow

For local answer/source review, after installing the package:

```sh
agenda-intelligence review-answer path/to/report-and-sources.json --strict --format json > review-result.json
```

A nonzero exit, malformed output, unavailable service, refused admission, quota exhaustion, or unassessed orientation must stop the workflow for investigation; none is a pass. A zero exit only means the adapter did not require revision. Route the exact reviewed artifact and its source set to a designated human, record their independent decision against that artifact, and require that approval before publication or commercial action. If the artifact or sources change, rerun and obtain a new approval. Do not treat `next_action: review`, a readiness score, or absence of gaps as permission.

For an agent calling a hosted gate, check HTTP and JSON-RPC success, `isError`, evaluation/admission status and the gate-specific response before routing to a human. Follow the [hosted MCP client](../hosted-mcp/) for admission and retry handling. Never treat a payment challenge or network error as an evaluated result. No automated external action is provided by this example.

## Pilot measurement

With participants who independently agree to test, record the number of eligible attempts, successful evaluations, refusal/error reasons, time to first usable review, whether the next step was understood, and human-reported missed gaps or unnecessary holds. Separate owner tests and probes from external participants; do not infer users or paying customers from anonymous caller hashes. Capture baseline and version, avoid collecting source contents in analytics, and compare a small set of real, permissioned tasks before making reliability or adoption claims. No participants are recruited by this example.
