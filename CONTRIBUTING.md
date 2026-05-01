# Contributing to Agenda Intelligence

## Project Philosophy
- **Markdown is the source of truth.** All documentation, specifications, and examples live in Markdown files.
- **Python tooling** provides validation, generation, and integration. Keep the Python layer lightweight and focused on the protocol.
- **Avoid framework bloat.** The project should stay a simple, composable protocol, not a heavy framework.

## Development Setup
```bash
git clone https://github.com/vassiliylakhonin/agenda-intelligence-md
cd agenda-intelligence-md
pip install -e ".[dev]"
pytest
```

## Validation Commands
```bash
agenda-intelligence validate-manifest
agenda-intelligence validate-brief examples/agenda-brief.json
agenda-intelligence validate-evidence examples/source/evidence-pack.json
```

## Adding Schemas
- Preserve backward‑compatibility where possible.
- Add both **valid** and **invalid** fixtures.
- Update the test suite to cover new cases.

## Adding Lens Packs
- Keep lenses concise and focused on failure modes and watch‑next indicators.
- Update the manifest if a new lens pack is required.

## Adding Examples
- Clearly label synthetic or demo examples.
- Do not claim live verification unless the sources were actually retrieved.
- Include a source plan and evidence pack when relevant.

## Evaluation Policy
- Heuristic scoring measures adherence to the protocol, **not** truthfulness of the content.

## Pull Request Checklist
- `python -m compileall .` passes.
- `pytest` passes.
- CLI validation commands succeed.
- Documentation is updated when behavior changes.

---
*File added via automated contribution assistance.*