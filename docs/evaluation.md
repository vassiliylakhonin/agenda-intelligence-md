# Evaluation

Agenda‑Intelligence.md currently evaluates **form and structure**, not truthfulness. The evaluation toolkit is being expanded to cover **quality**.

## Current evaluation layers

| Layer | What it checks | Status |
|-------|------------------|--------|
| **Protocol adherence** | Required sections (bottom‑line, signal, watch‑next, etc.) | ✅ CLI `validate‑brief` |
| **Schema validity** | JSON conforms to `schemas/agenda‑brief.schema.json` | ✅ CLI `validate‑brief` |
| **Source coverage** | Every claim backed by a source in the evidence pack | ✅ `evidence_mode` in brief |
| **Heuristic scoring** | Simple before/after marker count (e.g., “Before:”, “After:”) | ✅ CLI `score` |

## New quality‑focused assets (v0.5.1+)

| Asset | Location | Purpose |
|-------|----------|--------|
| **Scoring rubric** | `evals/rubric.md` | 5‑dimension quality rubric (relevance, evidence support, completeness, actionability, clarity) |
| **LLM judge prompt** | `evals/llm_judge_prompt.txt` | Optional prompt to let an LLM grade a brief |
| **Human review checklist** | `evals/human_checklist.md` | Structured checklist for manual review |
| **Sample cases** | `evals/cases/*.json` | Baseline cases with expected scores |
| **Benchmark set** | `evals/benchmark_set.json` | Baseline benchmark for tracking progress toward v0.7 |

## How to run a quality check (min‑viable)

```bash
# 1. Generate or obtain a brief
echo '{ "bottom_line": "..." }' > brief.json

# 2. Validate structure
agenda-intelligence validate-brief brief.json

# 3. Score (heuristic + optional LLM judge)
agenda-intelligence score brief.json
```

Output: numeric score (0‑100) and dimension‑wise feedback.

## Roadmap for “prove quality”

| Milestone | Version | Status |
|-----------|---------|--------|
| Quality rubric + LLM judge + human checklist | v0.5.1 | ✅ Done |
| Benchmark set for reproducible quality checks | v0.7 | Planned (see `ROADMAP.md`) |
| Automated CI quality gate using the evaluation toolkit | v0.8 | Planned |
| Full MCP tools for programmatic evaluation | v0.7‑v1.0 | In progress |

> **Note:** The project does **not** yet evaluate factual truthfulness. It focuses on *structural quality* and *source discipline* — the foundation for any truth‑checking layer that may be added later.