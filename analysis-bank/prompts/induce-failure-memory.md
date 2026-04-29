# Induce Failure Memory

You are extracting reusable reasoning memory from a failed or weak agenda-analysis output.

## Task
Given the user question, the weak output, and evaluator notes, extract at most 3 memory cards that would prevent the same failure in future tasks.

## Rules

- Identify the reasoning failure before writing the memory.
- Prefer recovery procedures over criticism.
- Do not store stale facts, private data, or full transcripts.
- Include when not to apply the memory.

## Output format

Use `analysis-bank/MEMORY_FORMAT.md`.
