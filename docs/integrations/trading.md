# Trading and Market-Risk Integration

This guide shows a minimal market-risk pipeline. The external system brings the market event and source material; Agenda Intelligence MD validates the brief contract, checks evidence structure, diagnoses source-plan coverage, and produces a heuristic score.

Agenda Intelligence MD does not fetch live news, verify whether a market claim is true, predict prices, recommend trades, or trigger orders.

## Prerequisites

- Python 3.9+
- Agenda Intelligence MD installed
- An external market-data, news, RSS, or broker-news source
- Optional Slack webhook, email sender, or dashboard endpoint

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install agenda-intelligence-md
```

## Pipeline

1. Your upstream system receives or fetches a market event.
2. Your agent or analyst drafts an `agenda-brief.json` and `evidence-pack.json`.
3. Agenda Intelligence MD validates the JSON contracts.
4. `source-coverage` diagnoses whether the evidence pack covers the selected source plan.
5. `score` gives a heuristic protocol score for review routing.
6. Your downstream system posts the brief to Slack, email, a case file, or a risk dashboard.

## CLI Example

```bash
agenda-intelligence start financial-market
agenda-intelligence validate-brief path/to/agenda-brief.json
agenda-intelligence validate-evidence path/to/evidence-pack.json
agenda-intelligence source-coverage path/to/evidence-pack.json --category financial-market
agenda-intelligence score path/to/agenda-brief.json --evidence path/to/evidence-pack.json --min-score 70
```

## Python Wrapper Sketch

```python
import json
import subprocess


def run(*args: str) -> str:
    result = subprocess.run(args, capture_output=True, text=True, check=True)
    return result.stdout


brief_path = "path/to/agenda-brief.json"
evidence_path = "path/to/evidence-pack.json"

run("agenda-intelligence", "validate-brief", brief_path)
run("agenda-intelligence", "validate-evidence", evidence_path)

coverage = run(
    "agenda-intelligence",
    "source-coverage",
    evidence_path,
    "--category",
    "financial-market",
    "--format",
    "json",
)

score = run(
    "agenda-intelligence",
    "score",
    brief_path,
    "--evidence",
    evidence_path,
    "--format",
    "json",
    "--min-score",
    "70",
)

payload = {
    "coverage": json.loads(coverage),
    "score": json.loads(score),
}
```

## Review Routing

Use score and source-coverage output to route work, not to automate trading decisions:

| Signal | Suggested routing |
|---|---|
| Low score | Send back for brief revision. |
| Missing required source coverage | Send to analyst or compliance review. |
| Unsupported or weakly supported claims | Weaken the claim or mark it explicitly. |
| High-impact market claim | Require human review even when structure passes. |

## Boundary

This integration is for informational and educational use. It does not constitute investment, financial, legal, compliance, or trading advice. Agenda Intelligence MD is a structural validation and evidence-discipline toolkit; it does not verify factual truth, predict market outcomes, recommend trades, or replace professional judgment.
