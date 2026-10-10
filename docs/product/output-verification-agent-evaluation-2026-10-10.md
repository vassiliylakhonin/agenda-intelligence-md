# Output Verification: owner-agent evaluation, 2026-10-10

The published `agenda-intelligence-md==1.15.0` installs and completes the
API/strict-CLI repair/recheck workflow outside a checkout on Python 3.9.6 and
3.12.14. This establishes technical installation, not customer adoption.

## Method and scope

One owner agent selected five practical documentation questions, wrote an
answer to each, froze those answers before checker execution, then assessed
the findings against the same primary sources. Each original answer has three
cited lines. Each source was a complete document fetched at the immutable
commit linked below. The installed distribution was fetched from PyPI in a new
environment, with Python isolated mode used for the API and CLI checks.

This is a deliberately small, non-independent machine evaluation. The same
agent selected, answered and assessed the tasks. There were no recruited users,
human ratings, customer reports, measured time savings or voluntary repeat use.
All five records are owner practice and contribute zero eligible human-pilot
sessions. Source contents were data, never executable instructions.

## Original tasks and findings

| Task and immutable primary source | Original route | Agent assessment |
| --- | --- | --- |
| [Python venv: create, activate and relocate](https://github.com/python/cpython/blob/58ed60b7415e218ce3d608302e39b5e55bfb0e88/Doc/library/venv.rst) | human_review | No finding; source supports the answer. |
| [JSON Schema: numeric bounds and required properties](https://github.com/json-schema-org/json-schema-spec/blob/fb0db2135a1224bd60a0a9ada75bf9d2e36c0b4a/specs/jsonschema-validation.md) | human_review | No finding; source supports the answer. This is the linked specification snapshot, not a claim about every dialect. |
| [MCP 2025-11-25: initialize before normal requests](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/c518f7a927cff918bce35d3522fcdb046d264d7c/docs/specification/2025-11-25/basic/lifecycle.mdx) | revise | One false hold: the correct restriction on pre-response requests was flagged for polarity mismatch. Raw Markdown line breaks separate the negation from later context. |
| [Workers: request-body and isolate memory limits](https://github.com/cloudflare/cloudflare-docs/blob/0017e51a284d1be4341ada9f9005850a7b47dc7b/src/content/docs/workers/platform/limits.mdx) | revise | Two false holds: body-size numbers were present in table rows but lacked enough same-line context; a correct per-isolate/per-invocation distinction triggered polarity mismatch. |
| [LangGraph: state, updates and conditional edges](https://github.com/langchain-ai/docs/blob/cd302e5548df094a85b34dfb6eb23823c66614f4/src/oss/langgraph/graph-api.mdx) | revise | One false hold on a correct routing paraphrase: lexical coverage was 0.714, below the supported threshold. |

Four of the fifteen original answer units required review despite being
source-supported in the owner's assessment. This is an observed count on these
selected examples, not an estimate of production precision or recall. The
original answers contained no agent-confirmed errors, so they establish no
natural-error detection rate.

## Separate, deliberately seeded probes

One incorrect variant per task tested a known boundary. These were deliberately
inserted errors, not hallucinations observed in the original task answers.

| Seeded fault | Result |
| --- | --- |
| venv activation incorrectly described as mandatory | No finding; human_review |
| JSON Schema maximum incorrectly described as exclusive | No finding; human_review |
| MCP ordinary requests incorrectly allowed before initialize response | No finding; human_review |
| Workers memory changed from 128 MB to 900 MB | revise; unmatched number |
| Fabricated LangGraph quotation claiming compilation is optional | revise; absent quote and unsupported lexical overlap |

The checker flagged two seeded faults and produced no finding on three
semantic contradictions. Every result still required human review and reported
`factuality_status=not_assessed`. Neither `human_review` nor strict CLI exit zero
means the answer is true or semantically entailed by its source.

## Recheck and product implications

Sources remained unchanged during recheck. LangGraph was restated closer to
the source; MCP was expressed as waiting for the initialize response before
normal requests (the earlier explicit ping exception was no longer spelled
out). Workers plan limits were split into separate cited table-row quotations,
and memory size and scope became separate answer units. All five revised
answers reached `human_review`. This demonstrates a bounded formatting and
wording repair, not correction of false original facts or completion of human
review.

The immediate supported use is checking citation references, explicit quote
matches and suspicious numeric mappings before a reviewer sees an answer.
Integration guidance should recommend focused source chunks and one fact per
line, preserve originals, and explain false holds. A subsequent correctness
change should evaluate Markdown tables and wrapped normative prose without
loosening the numeric-context or polarity safeguards globally. Broader semantic
verification needs its own explicit interface and independently assessed
dataset; raising lexical overlap scores would not establish entailment.

The operator's local records retain frozen requests, source hashes, API/CLI
outputs, revised requests and machine assessments. Full third-party documents
and those private records are not committed to this repository. Each immutable
source link permits a repeat fetch for a new evaluation.
