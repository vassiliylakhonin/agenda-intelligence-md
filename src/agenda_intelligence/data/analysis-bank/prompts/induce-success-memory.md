# Induce Success Memory

You are extracting reusable reasoning memory from a successful agenda-analysis output.

## Task
Given the user question, the final output, and any evaluation notes, extract at most 3 memory cards that would help future agents solve similar tasks.

## Rules

- Prefer concrete, actionable reasoning procedures over abstract principles.
- Do not copy stale facts, exact source text, private data, or one-off claims.
- Generalize the lesson beyond the specific case.
- Include boundary conditions so the memory is not over-applied.

## Output format

Use `analysis-bank/MEMORY_FORMAT.md`.
