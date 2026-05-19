# Agent integration sketch

A minimal cycle for embedding Agenda Intelligence MD into an LLM agent. The
toolkit gives you small contract checkpoints; the agent itself stays in your stack.

## Loop

```
1. event in              -->  agent receives a policy/risk update
2. list_source_categories --> agent selects a packaged source category
3. source_plan(category) -->  agent fetches must_check + watch_indicators
4. agent drafts brief    -->  conforms to agenda-brief.schema.json
5. validate_brief        -->  schema check; agent fixes structural errors
6. validate_evidence     -->  evidence-pack schema check
7. (optional) source_coverage  category must_check coverage diagnostic
8. (optional) audit-claims  evidence-audit.schema.json (claim-level)
9. score_output          -->  heuristic 0-100; gate or branch on threshold
10. emit                 -->  brief + evidence + audit JSON
```

## CLI variant

If the agent shells out instead of importing the package:

```bash
agenda-intelligence source-categories --format json > categories.json
agenda-intelligence source-plan technology-ai > plan.json
# ... agent drafts brief.json + evidence.json + (optional) claims.json ...
agenda-intelligence validate-brief brief.json
agenda-intelligence validate-evidence evidence.json
agenda-intelligence source-coverage evidence.json --format json > coverage.json
agenda-intelligence audit-claims claims.json --format json > audit.json
agenda-intelligence score brief.json --evidence evidence.json \
    --format json --min-score 70 > score.json
```

Non-zero exit on any step blocks emission. `--min-score` exits 2 when below
threshold, distinct from validation failures (exit 1).

## Python variant

```python
from agenda_intelligence import mcp_server as ai
from agenda_intelligence.eval import score_brief

categories = ai.list_source_categories()
plan = ai.source_plan("technology-ai")
brief = my_agent.draft_brief(event, plan["plan"])
evidence = my_agent.draft_evidence(brief)
evidence["source_category"] = "technology-ai"

assert ai.validate_brief(brief)["valid"], "structural fix needed"
assert ai.validate_evidence(evidence)["valid"], "evidence-pack fix needed"

result = score_brief(brief, evidence_pack=evidence)
if result["score"] < 70:
    brief = my_agent.revise(brief, hints=result["dimensions"])
```

## MCP variant

For agents that talk MCP, the package ships a stdio server:

```bash
agenda-intelligence-mcp
```

Exposed tools: `validate_brief`, `validate_evidence`, `get_protocol`,
`list_lenses`, `get_lens`, `list_source_categories`, `source_plan`,
`source_coverage`, `score_output`. See
[`MCP.md`](../../MCP.md) and [`mcp.md`](mcp.md) for client configs.

## What the agent owns

- Choosing `category` for `source_plan`, optionally using `list_source_categories`.
- Drafting brief and evidence text.
- Deciding `support_level` honestly.
- Re-drafting on failure.

## What the toolkit owns

- Schema contracts.
- A heuristic, transparent score.
- A pass/fail signal a CI pipeline can trust.

## What neither owns

- Factual truthfulness of claims. This stays with the analyst (or a future
  truthfulness layer that retrieves and checks cited text).
