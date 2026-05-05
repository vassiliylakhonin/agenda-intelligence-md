# Evaluation

Agenda‑Intelligence.md currently evaluates **form and structure**, not truthfulness. The evaluation toolkit is being expanded to cover **quality**.

## Current evaluation layers

| Layer | What it checks | Status |
|-------|------------------|--------|
| **Protocol adherence** | Required sections (bottom‑line, signal, watch‑next, etc.) | ✅ CLI `validate‑brief` |
| **Schema validity** | JSON conforms to `schemas/agenda‑brief.schema.json` | ✅ CLI `validate‑brief` |
| **Source coverage structure** | Evidence packs can record claim-level support status, sources, limits, unsupported claims, and missing sources | ✅ CLI `validate‑evidence` |
| **Brief scoring** | Heuristic 0-100 structural score for JSON briefs across the public rubric dimensions | ✅ CLI `score` |
| **Before/after scoring** | Marker-based before/after example harness | ✅ CLI `score` |

## New quality‑focused assets (v0.5.1+)

| Asset | Location | Purpose |
|-------|----------|--------|
| **Scoring rubric** | `evals/rubric.md` | 5‑dimension quality rubric (relevance, evidence support, completeness, actionability, clarity) |
| **LLM judge prompt** | `evals/llm_judge_prompt.txt` | Optional prompt to let an LLM grade a brief |
| **Human review checklist** | `evals/human_checklist.md` | Structured checklist for manual review |
| **Sample cases** | `evals/cases/*.json` | Baseline cases with expected scores |
| **Benchmark set** | `evals/benchmark_set.json` | Baseline benchmark for tracking progress toward v0.7 |

## How to run the current checks

```bash
# 1. Validate structure

agenda-intelligence validate-brief examples/agenda-brief.json

# 2. Validate evidence-pack structure

agenda-intelligence validate-evidence examples/source/evidence-pack.json

# 3. Score a JSON brief

agenda-intelligence score examples/agenda-brief.json

# 4. Score a before/after markdown example with the current heuristic harness

agenda-intelligence score examples/before-after/eu-ai-act.md
```

The JSON brief scorer returns a 0‑100 structural quality score with dimension
feedback for relevance, evidence support, completeness, actionability, and
clarity. It does **not** verify factual truthfulness. Before/after markdown
examples still use the older marker-based harness.

## Roadmap for “prove quality”

| Milestone | Version | Status |
|-----------|---------|--------|
| Quality rubric + LLM judge + human checklist | v0.5.1 | ✅ Done |
| Heuristic JSON brief scorer | v0.6 | ✅ Done |
| Benchmark set for reproducible quality checks | v0.7 | Planned (see `ROADMAP.md`) |
| Automated CI quality gate using the evaluation toolkit | v0.8 | Planned |
| Source-backed truthfulness evaluation | v0.7‑v1.0 | In progress |

> **Note:** The project does **not** yet evaluate factual truthfulness. It focuses on *structural quality* and *source discipline* — the foundation for any truth‑checking layer that may be added later.
