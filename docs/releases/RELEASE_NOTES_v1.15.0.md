# v1.15.0 — Local RAG Output Verification

Install `agenda-intelligence-md==1.15.0` and pass a cited answer plus original
retrieved chunk texts to `review_rag_answer` or `agenda-intelligence review-answer`.
The adapter assembles the existing evidence packet and returns line-level
reference, quote, number and lexical-support findings with repair actions.

See the [standalone quickstart and contract](../integrations/rag-output.md).
No checkout, wallet, model API key or account is required for your own local
check. The optional [LangGraph example](../../examples/langgraph-output-verification/README.md)
shows bounded correction and recheck before human handoff; it adds no core dependency.

Every nonblank answer line remains a review unit. Unknown citations and uncited
content survive assembly; duplicate source IDs, malformed input and size bounds
fail. Citations apply to a whole line, not automatically extracted atomic facts.
Lexical overlap is heuristic, source authenticity/freshness are unverified,
factuality stays unassessed and all successful results still require human review.

The release also includes the previously merged canonical A2A examples and
free-trial admission diagnostics. Hosted admission, prices and trial allowances
are unchanged. Maintained release metadata and generated provenance versions
are synchronized; existing service outcomes and evidence are preserved.

Validation: 1,042 Python tests passed, 2 skipped; 840 Worker tests passed;
lint/typecheck, public commands, package consistency and MCP smoke passed.
Wheel CI and post-release smoke exercise the installed adapter and strict CLI
in isolated mode. Synthetic test results do not establish customer adoption
or human usefulness. The [pilot protocol](../../examples/product-pilot/README.md)
keeps owner/agent practice separate from consenting human observations.
