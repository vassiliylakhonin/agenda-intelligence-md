# Evaluation

Agenda-Intelligence.md does **not** evaluate truthfulness of claims. It evaluates:

1. **Protocol adherence** – does the brief follow the required sections?
2. **Schema validity** – JSON matches the schemas.
3. **Source coverage** – are required sources present?
4. **Heuristic scoring** – for before/after examples, a simple heuristic counts
   structural markers (e.g., "Before:", "After:", "Improvement:").

The heuristic is intentionally simple; real evaluation would require a separate
LLM‑based judge or human review.

## Scoring command

```bash
agenda-intelligence score examples/before-after/technology-ai.md
```

Output includes a numeric score and a short explanation.