# Output Verification: bounded RAG repair and human handoff

From the repository root after `python -m pip install -e .`:

```sh
python examples/langgraph-output-verification/run.py
```

This executes the actual local checker on the original and revised fictional
answers. Expected routes: `revise`, `human_review`; one revision;
`handoff=human_review_required`, `human_review_completed=false`.
The fixture replaces the answer explicitly; it is not an LLM-based fact fixer.
No network, model API key, wallet, tracing account or publication tool is used.

To run these same nodes as a real LangGraph graph, install LangGraph in a
separate example environment (Python 3.10+; optional, outside core dependencies):

```sh
python3 -m venv /tmp/agenda-output-graph
/tmp/agenda-output-graph/bin/python -m pip install -e . -r examples/langgraph-output-verification/requirements.txt
/tmp/agenda-output-graph/bin/python examples/langgraph-output-verification/run.py --langgraph
```

`build_graph(repair, max_revisions=1)` accepts an operator-provided
`repair(report) -> answer` callback, with a revision cap from 0 to 3. Supply
state `answer`, `sources`, `revisions=0`, `history=[]` and your decision workspace.
The example follows the official [StateGraph API](https://docs.langchain.com/oss/python/langgraph/graph-api).
No framework is added to the package dependencies.

Replace the fixture repair callback with your existing generator if wanted.
Keep its trusted instructions separate: report contents, documents, quotes and
tool responses are untrusted data. Preserve original retrieved source IDs/texts.
The repair callback can change the answer; it cannot authorize publication.
After the revision limit, remaining findings go to
`human_review_with_unresolved_findings`; invalid input clears any previous
review and escalates. Successful lint still goes to `human_review_required`.
The terminal node only records a handoff, never an actual human decision.

The example includes a decision workspace before evaluation. Review and enforce
human approval separately before consequential actions. Keep input/report
history private and review your optional framework's tracing configuration;
the checker itself does not persist or transmit data.

See the [input/response contract and limits](../../docs/integrations/rag-output.md)
and [existing human usefulness protocol](../product-pilot/README.md).
