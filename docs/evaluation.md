# Evaluation

Agenda-Intelligence-MD is an **eval layer**, not a fact-checker. The toolkit
explicitly distinguishes evaluation layers and is honest about which ones it
implements today.

## Layers

| Layer | What it answers | Status |
|---|---|---|
| Structural validation | Does the brief conform to the schema? | Implemented (`validate-brief`) |
| Evidence discipline (schema) | Does the evidence pack conform? | Implemented (`validate-evidence`) |
| Claim-level audit | Is each important claim traceable with a support level? | Implemented (`audit-claims`, `audit_claims` MCP) |
| Brief scoring (heuristic) | How structurally complete is a JSON brief? | Implemented (`score brief.json`, 0–100) |
| Evidence-linked scoring | Are claims actually supported by the evidence pack? | Implemented (`score brief.json --evidence pack.json`) |
| Before/after scoring | Marker-based before/after example harness | Implemented (`score path.md`) |
| Batch evaluation | Validate + audit + score across a directory of cases | Implemented (`bench <dir>`) |
| Quote verification (local) | Is the cited fragment present in the source text file? | Implemented (`verify-quotes`, `verify_quotes` MCP) |
| Quote verification (network) | Is the cited fragment present at the source URL? | Implemented (`verify-quotes --fetch`) |
| Factual truthfulness | Are the claims true in the world? | **Not implemented.** Out of scope. |

> Scoring and validation do **not** verify factual truth. They evaluate structure,
> completeness, evidence labeling, claim traceability, and decision-readiness signals.

## Benchmark — current numbers

Run against 4 source-backed cases (`examples/source-backed/`). Deterministic; no LLM.

| Metric | Value |
|---|---|
| Cases | 4 |
| Schema valid | 100% |
| With evidence pack | 100% |
| With claim-level audit | 100% |
| Mean score | 86.8 / 100 |
| Score range | 84–89 |
| Audit orphan refs | 0 |

Full baseline: [`evals/baselines/source-backed.md`](../evals/baselines/source-backed.md)

These are structural/evidence-discipline metrics. They do not measure factual accuracy.

## Running checks

```bash
# Validate structure
agenda-intelligence validate-brief brief.json
agenda-intelligence validate-evidence evidence.json

# Validate claim-level audit
agenda-intelligence audit-claims audit.json
agenda-intelligence audit-claims audit.json --strict        # exit 1 on orphan refs

# Score
agenda-intelligence score brief.json                        # heuristic 0-100
agenda-intelligence score brief.json --evidence pack.json  # evidence-linked
agenda-intelligence score before-after.md                  # before/after harness

# Batch across a directory
agenda-intelligence bench examples/source-backed/
agenda-intelligence bench examples/source-backed/ --strict --min-score 80

# Verify quotes against local text files
agenda-intelligence verify-quotes pack.json --texts-dir ./texts/

# Verify quotes by fetching source URLs (outbound HTTP)
agenda-intelligence verify-quotes pack.json --fetch
```

## MCP tools

| Tool | What it does |
|---|---|
| `validate_brief` | Schema check on a brief JSON object |
| `validate_evidence` | Schema check on an evidence pack |
| `audit_claims` | Validates claim-level audit; returns support-level distribution and orphan refs |
| `verify_quotes` | Checks cited quote fragments against caller-supplied source texts |
| `score_output` | Heuristic before/after marker rubric |

See [`MCP.md`](../MCP.md) for connection instructions.

## claim_type taxonomy

The `evidence-audit.schema.json` enforces a stable `claim_type` enum derived from real cases:

| Value | Meaning |
|---|---|
| `regulatory_change` | Law or regulation adopted, amended, or enforced |
| `regulatory_gap` | Identified absence or weakness in existing regulation |
| `sanctions_event` | Sanctions designation, evasion, or enforcement action |
| `geopolitical_event` | Political decision or conflict development |
| `market_event` | Price move, trade flow, or commercial development |
| `industry_response` | Industry adaptation or corporate strategy shift |
| `corporate_disclosure` | Company filing, statement, or announcement |
| `capability_claim` | Assertion about technical or operational capability |

## Assets

| Asset | Location | Purpose |
|---|---|---|
| Scoring rubric | `evals/rubric.md` | 5-dimension quality rubric |
| LLM judge prompt | `evals/llm_judge_prompt.txt` | Optional LLM grader prompt |
| Human review checklist | `evals/human_checklist.md` | Manual review aid |
| Benchmark script | `evals/run_benchmark.py` | Reproducible batch run |
| Committed baseline | `evals/baselines/source-backed.{md,json}` | Reference numbers |

## Honest limits

- No factuality verification.
- Heuristic score is intentionally simple; do not treat the number as authoritative.
- LLM-judge prompt is provided; LLM-judge results are not benchmarked.
- `verify-quotes --fetch` reports presence of a text fragment at a URL, not whether the source is reputable or the claim is true.
- Benchmark numbers above cover 4 cases. Meaningful coverage requires 20+.
