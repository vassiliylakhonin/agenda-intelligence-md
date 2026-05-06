# Roadmap

## v0.5 – Developer readiness
- Full packaging and installable CLI
- JSON‑schema validation for briefs & evidence packs
- Tests and CI

## v0.6 – Agent integration / MCP
- Stdio MCP transport around the existing Python tool functions
- Integration examples for agent-speaking environments

## v0.7 – Quality proof / benchmark set
- MCP `score_output` tool for before/after protocol-marker scoring
- Demo examples with live source plans (now include source‑backed evidence)
- Evaluation documentation expanded (new `evals/` assets, rubric, LLM judge prompt, human checklist)
- Benchmark set (`evals/benchmark_set.json`) for reproducible quality tracking
- Source-backed truthfulness checks beyond the current structural scorer

## In progress
- Keep top-level and packaged manifests/schemas in sync through CI tests
- Add comprehensive docs for each integration platform (Claude, Codex, Cursor, MCP)
